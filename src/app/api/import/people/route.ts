import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseCsv } from '@/lib/csv'

function getRowValue(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return NextResponse.json({ imported: 0, updated: 0, errors: [] })

    const supabase = createServerClient()
    const districtId = (formData.get('district_id') as string | null)?.trim()

    // Build region name -> id lookup (scoped to active district, case-insensitive).
    let regionQuery = supabase.from('regions').select('id, name')
    if (districtId) regionQuery = regionQuery.eq('district_id', districtId)
    const { data: regions } = await regionQuery
    const regionByName: Record<string, string> = {}
    for (const region of regions ?? []) {
      regionByName[region.name.toLowerCase()] = region.id
    }

    // Build department name -> id lookup (case-insensitive).
    const { data: departments } = await supabase.from('departments').select('id, name')
    const deptByName: Record<string, string> = {}
    for (const department of departments ?? []) {
      deptByName[department.name.toLowerCase()] = department.id
    }

    // Build a lookup so exported CSVs can be imported back without creating duplicates.
    let peopleQuery = supabase
      .from('people')
      .select('id, name, region:regions(id, name)')
    if (districtId) peopleQuery = peopleQuery.eq('district_id', districtId)
    const { data: people } = await peopleQuery

    const peopleByNameAndRegion: Record<string, string> = {}
    for (const person of people ?? []) {
      const region = Array.isArray(person.region) ? (person.region[0] ?? null) : person.region
      const key = `${normalizeLookupValue(person.name)}::${normalizeLookupValue(region?.name)}`
      peopleByNameAndRegion[key] = person.id
    }

    let imported = 0
    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = getRowValue(row, 'name', 'Name')
      if (!name) {
        errors.push('Skipped row: missing name')
        continue
      }

      let regionId: string | null = null
      const regionName = getRowValue(row, 'region', 'Region')
      if (regionName) {
        regionId = regionByName[regionName.toLowerCase()] ?? null
        if (!regionId) {
          errors.push(`${name}: region "${regionName}" not found - skipping region assignment`)
        }
      }

      let departmentId: string | null = null
      const deptName = getRowValue(row, 'department', 'Department')
      if (deptName) {
        departmentId = deptByName[deptName.toLowerCase()] ?? null
        if (!departmentId) {
          errors.push(`${name}: department "${deptName}" not found - skipping department assignment`)
        }
      }

      const personLookupKey = `${normalizeLookupValue(name)}::${normalizeLookupValue(regionName)}`
      const matchedPersonId = getRowValue(row, 'id', 'ID') || peopleByNameAndRegion[personLookupKey] || ''
      const isUpdate = matchedPersonId !== ''
      const genderValue = getRowValue(row, 'gender', 'Gender')

      const personRecord = {
        ...(isUpdate ? { id: matchedPersonId } : {}),
        name,
        phone: getRowValue(row, 'phone', 'Phone') || null,
        gender: (['male', 'female', 'other'].includes(genderValue) ? genderValue : null) as 'male' | 'female' | 'other' | null,
        district_id: districtId || null,
        region_id: regionId,
        department_id: departmentId,
      }

      const { data: personData, error: personError } = await supabase
        .from('people')
        .upsert(personRecord, { onConflict: 'id' })
        .select('id')
        .single()

      if (personError) {
        errors.push(`${name}: ${personError.message}`)
        continue
      }

      const personId = personData.id
      if (isUpdate) updated++
      else imported++
      peopleByNameAndRegion[personLookupKey] = personId

      const contributionValue = getRowValue(row, 'total_contribution', 'contributions', 'Contributions')
      const total = parseFloat(contributionValue)

      await supabase
        .from('contributions')
        .delete()
        .eq('person_id', personId)
        .eq('note', 'sheet_import')

      if (!isNaN(total) && total > 0) {
        await supabase
          .from('contributions')
          .insert({
            person_id: personId,
            amount: total,
            note: 'sheet_import',
            date: new Date().toISOString().slice(0, 10),
          })
      }
    }

    return NextResponse.json({ imported, updated, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
