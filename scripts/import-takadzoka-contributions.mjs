import fs from 'fs'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars in .env.local')
  process.exit(1)
}

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node --env-file=.env.local scripts/import-takadzoka-contributions.mjs <csv-path> [--apply]')
  process.exit(1)
}

const shouldApply = process.argv.includes('--apply')

const DISTRICT_NAME = 'Southgate District'
const FUND_NAME = 'Takadzoka'
const ACCOUNT_NAME = 'Cash'
const TRANSACTION_DATE = '2026-04-23'
const IMPORT_TAG = `takadzoka-import:${TRANSACTION_DATE}`

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeImportedName(value) {
  return normalizeWhitespace(value).replace(/^advisor\s+/i, '')
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function deterministicUuid(seed) {
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 32)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line, index) => {
      const [fullName, assembly, region, contribution] = line.split(',')
      const amount = Number(String(contribution).replace(/[$,]/g, ''))

      return {
        rowNumber: index + 2,
        rawName: normalizeWhitespace(fullName),
        memberName: normalizeImportedName(fullName),
        assembly: normalizeWhitespace(assembly),
        region: normalizeWhitespace(region),
        amount,
      }
    })
}

function buildAssemblyKey(name, parentId) {
  return `${normalizeKey(name)}::${parentId}`
}

function buildMemberKey(name, parentId) {
  return `${normalizeKey(name)}::${parentId}`
}

async function fetchSingle(table, columns, matcher) {
  let query = supabase.from(table).select(columns)
  for (const [column, value] of Object.entries(matcher)) {
    query = query.eq(column, value)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(`${table} lookup failed: ${error.message}`)
  if (!data) throw new Error(`${table} not found for ${JSON.stringify(matcher)}`)
  return data
}

async function main() {
  const csvText = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCsv(csvText)

  const invalidRows = rows.filter((row) => !row.memberName || !row.assembly || !row.region || !Number.isFinite(row.amount) || row.amount <= 0)
  if (invalidRows.length > 0) {
    throw new Error(`CSV contains invalid rows: ${JSON.stringify(invalidRows.slice(0, 5), null, 2)}`)
  }

  const district = await fetchSingle('districts', 'id, name, is_active', { name: DISTRICT_NAME })
  if (!district.is_active) throw new Error(`District '${DISTRICT_NAME}' is inactive`)

  const fund = await fetchSingle(
    'funds',
    'id, district_id, name, nature, is_active, requires_individual_member',
    { district_id: district.id, name: FUND_NAME },
  )
  if (!fund.is_active) throw new Error(`Fund '${FUND_NAME}' is inactive`)

  const account = await fetchSingle(
    'accounts',
    'id, district_id, name, currency, status, type',
    { district_id: district.id, name: ACCOUNT_NAME },
  )
  if (account.status !== 'active') throw new Error(`Account '${ACCOUNT_NAME}' is not active`)
  if (account.currency !== 'USD') throw new Error(`Account '${ACCOUNT_NAME}' must be USD for this import`)

  const { data: superusers, error: superuserError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('is_superuser', true)
    .order('id')

  if (superuserError) throw new Error(`Superuser lookup failed: ${superuserError.message}`)
  if (!superusers?.length) throw new Error('No superuser found to attribute imported draft receipts')

  const createdByUserId = superusers[0].id

  const { data: existingMembers, error: membersError } = await supabase
    .from('members')
    .select('id, district_id, parent_id, type, name, title, notes, is_active')
    .eq('district_id', district.id)
    .eq('is_active', true)

  if (membersError) throw new Error(`Members lookup failed: ${membersError.message}`)

  const regionByName = new Map(
    (existingMembers ?? [])
      .filter((member) => member.type === 'region')
      .map((member) => [normalizeKey(member.name), member]),
  )

  const assemblyByKey = new Map(
    (existingMembers ?? [])
      .filter((member) => member.type === 'assembly')
      .map((member) => [buildAssemblyKey(member.name, member.parent_id), member]),
  )

  const memberByKey = new Map(
    (existingMembers ?? [])
      .filter((member) => member.type === 'individual')
      .map((member) => [buildMemberKey(member.name, member.parent_id), member]),
  )

  const assembliesToCreate = []
  for (const row of rows) {
    const region = regionByName.get(normalizeKey(row.region))
    if (!region) {
      throw new Error(`Region '${row.region}' from CSV does not exist in ${DISTRICT_NAME}`)
    }

    const assemblyKey = buildAssemblyKey(row.assembly, region.id)
    if (!assemblyByKey.has(assemblyKey)) {
      const assemblyRecord = {
        district_id: district.id,
        type: 'assembly',
        name: row.assembly,
        title: 'saint',
        parent_id: region.id,
        notes: `Imported from ${IMPORT_TAG}`,
        is_active: true,
      }
      assemblyByKey.set(assemblyKey, assemblyRecord)
      assembliesToCreate.push(assemblyRecord)
    }
  }

  let createdAssemblies = []
  if (shouldApply && assembliesToCreate.length > 0) {
    const { data, error } = await supabase
      .from('members')
      .insert(assembliesToCreate)
      .select('id, district_id, parent_id, type, name, title, notes, is_active')

    if (error) throw new Error(`Assembly insert failed: ${error.message}`)
    createdAssemblies = data ?? []
    for (const assembly of createdAssemblies) {
      assemblyByKey.set(buildAssemblyKey(assembly.name, assembly.parent_id), assembly)
    }
  } else if (!shouldApply) {
    for (const assembly of assembliesToCreate) {
      assemblyByKey.set(buildAssemblyKey(assembly.name, assembly.parent_id), {
        ...assembly,
        id: `(pending) ${assembly.name}`,
      })
    }
  }

  const membersToCreate = []
  for (const row of rows) {
    const region = regionByName.get(normalizeKey(row.region))
    const assembly = assemblyByKey.get(buildAssemblyKey(row.assembly, region.id))

    if (!assembly?.parent_id && !String(assembly?.id).startsWith('(pending)')) {
      throw new Error(`Assembly '${row.assembly}' is missing a parent region`)
    }

    const memberKey = buildMemberKey(row.memberName, assembly.id)
    if (!memberByKey.has(memberKey)) {
      const originalNameNote = row.rawName !== row.memberName
        ? ` Original CSV name: ${row.rawName}.`
        : ''

      const memberRecord = {
        district_id: district.id,
        type: 'individual',
        name: row.memberName,
        title: 'saint',
        parent_id: assembly.id,
        notes: `Imported from ${IMPORT_TAG}.${originalNameNote}`.trim(),
        is_active: true,
      }
      memberByKey.set(memberKey, memberRecord)
      membersToCreate.push(memberRecord)
    }
  }

  let createdMembers = []
  if (shouldApply && membersToCreate.length > 0) {
    const { data, error } = await supabase
      .from('members')
      .insert(membersToCreate)
      .select('id, district_id, parent_id, type, name, title, notes, is_active')

    if (error) throw new Error(`Member insert failed: ${error.message}`)
    createdMembers = data ?? []
    for (const member of createdMembers) {
      memberByKey.set(buildMemberKey(member.name, member.parent_id), member)
    }
  } else if (!shouldApply) {
    for (const member of membersToCreate) {
      memberByKey.set(buildMemberKey(member.name, member.parent_id), {
        ...member,
        id: `(pending) ${member.name}`,
      })
    }
  }

  const contributionRows = rows.map((row) => {
    const region = regionByName.get(normalizeKey(row.region))
    const assembly = assemblyByKey.get(buildAssemblyKey(row.assembly, region.id))
    const member = memberByKey.get(buildMemberKey(row.memberName, assembly.id))

    if (!member) {
      throw new Error(`Failed to resolve member '${row.memberName}' under '${row.assembly}'`)
    }

    return {
      csvRow: row.rowNumber,
      rawName: row.rawName,
      memberName: row.memberName,
      regionName: row.region,
      assemblyName: row.assembly,
      memberId: member.id,
      amount: row.amount,
      client_generated_id: deterministicUuid(
        `${IMPORT_TAG}|${row.rowNumber}|${row.rawName}|${row.assembly}|${row.region}|${row.amount.toFixed(2)}`,
      ),
    }
  })

  const clientGeneratedIds = contributionRows.map((row) => row.client_generated_id)

  const { data: existingTransactions, error: existingTransactionsError } = await supabase
    .from('cashbook_transactions')
    .select('id, client_generated_id, total_amount, member_id, status')
    .in('client_generated_id', clientGeneratedIds)

  if (existingTransactionsError) {
    throw new Error(`Existing transaction lookup failed: ${existingTransactionsError.message}`)
  }

  const existingTransactionIds = new Set((existingTransactions ?? []).map((row) => row.client_generated_id))
  const existingImportedTotal = (existingTransactions ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount),
    0,
  )

  const transactionsToInsert = contributionRows
    .filter((row) => !existingTransactionIds.has(row.client_generated_id))
    .map((row) => ({
      district_id: district.id,
      account_id: account.id,
      fund_id: fund.id,
      member_id: row.memberId,
      kind: 'receipt',
      effect_direction: 'in',
      status: 'draft',
      transaction_date: TRANSACTION_DATE,
      counterparty: null,
      narration: `Takadzoka contribution import (${row.regionName} / ${row.assemblyName})`,
      currency: 'USD',
      total_amount: row.amount,
      created_by: createdByUserId,
      client_generated_id: row.client_generated_id,
      device_id: 'codex-import',
    }))

  let insertedTransactions = []
  if (shouldApply && transactionsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('cashbook_transactions')
      .insert(transactionsToInsert)
      .select('id, client_generated_id, total_amount, member_id, status')

    if (error) throw new Error(`Transaction insert failed: ${error.message}`)
    insertedTransactions = data ?? []
  }

  const importTransactionRows = shouldApply
    ? insertedTransactions
    : transactionsToInsert

  const totalAmount = contributionRows.reduce((sum, row) => sum + row.amount, 0)
  const duplicateNameMismatches = []
  for (const row of rows) {
    const existingByName = (existingMembers ?? []).filter(
      (member) => member.type === 'individual' && normalizeKey(member.name) === normalizeKey(row.memberName),
    )
    const region = regionByName.get(normalizeKey(row.region))
    const assembly = assemblyByKey.get(buildAssemblyKey(row.assembly, region.id))

    if (
      existingByName.length > 0
      && !existingByName.some((member) => member.parent_id === assembly.id)
    ) {
      duplicateNameMismatches.push({
        csvName: row.rawName,
        importedAs: row.memberName,
        csvAssembly: row.assembly,
        existingMatches: existingByName.map((member) => member.name),
      })
    }
  }

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    district: district.name,
    fund: fund.name,
    account: account.name,
    transactionDate: TRANSACTION_DATE,
    csvRows: rows.length,
    totalAmount,
    createdAssemblies: shouldApply ? createdAssemblies.length : assembliesToCreate.length,
    createdMembers: shouldApply ? createdMembers.length : membersToCreate.length,
    insertedDraftReceipts: shouldApply ? insertedTransactions.length : transactionsToInsert.length,
    skippedExistingReceipts: existingTransactionIds.size,
    assemblyNamesCreated: (shouldApply ? createdAssemblies : assembliesToCreate).map((row) => row.name),
    sampleCreatedMembers: (shouldApply ? createdMembers : membersToCreate).slice(0, 10).map((row) => row.name),
    hierarchyMismatchesHandledByNewMember: duplicateNameMismatches,
    verification: {
      existingImportedTotal,
      importedReceiptTotal: importTransactionRows.reduce((sum, row) => sum + Number(row.total_amount), 0),
      expectedCsvTotal: totalAmount,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
