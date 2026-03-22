'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Expense } from '@/types'

export interface RegionBreakdown {
  region_id: string
  region_name: string
  people_count: number
  total: number
}

export interface DepartmentBreakdown {
  department_id: string
  department_name: string
  people_count: number
  total: number
}

export interface GenderBreakdown {
  gender: 'male' | 'female' | 'other' | null
  count: number
  total: number
}

export interface DaySummary {
  date: string
  label: string | null
  sessions_count: number
  events_count: number
}

export interface ReportData {
  totalContributions: number
  totalExpenses: number
  netBalance: number
  totalPeople: number
  byRegion: RegionBreakdown[]
  byDepartment: DepartmentBreakdown[]
  byGender: GenderBreakdown[]
  days: DaySummary[]
  totalSessions: number
  totalEvents: number
  expenses: Expense[]
}

export function useReport(districtId?: string | null) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)

    // 1. Regions in scope
    let regionsQ = supabase.from('regions').select('id, name').order('name')
    if (districtId) regionsQ = regionsQ.eq('district_id', districtId)
    const { data: regions } = await regionsQ
    const regionIds = (regions ?? []).map((r) => r.id)

    if (districtId && regionIds.length === 0) {
      setData({
        totalContributions: 0, totalExpenses: 0, netBalance: 0, totalPeople: 0,
        byRegion: [], byDepartment: [], byGender: [],
        days: [], totalSessions: 0, totalEvents: 0, expenses: [],
      })
      setLoading(false)
      return
    }

    // 2. People in scope
    let peopleQ = supabase.from('people').select('id, gender, region_id, department_id')
    if (regionIds.length > 0) peopleQ = peopleQ.in('region_id', regionIds)
    const { data: people } = await peopleQ
    const personIds = (people ?? []).map((p) => p.id)

    // 3. Contributions for those people
    let contribQ = supabase.from('contributions').select('person_id, amount')
    if (personIds.length > 0) contribQ = contribQ.in('person_id', personIds)
    else contribQ = contribQ.eq('person_id', 'none')
    const { data: contributions } = await contribQ

    // 4. Departments (global list)
    const { data: departments } = await supabase.from('departments').select('id, name').order('name')

    // 5. Expenses for district
    let expQ = supabase.from('expenses').select('*').order('date', { ascending: false })
    if (districtId) expQ = expQ.eq('district_id', districtId)
    const { data: expenses } = await expQ

    // 6. Schedule
    let daysQ = supabase.from('days').select('id, date, label').order('date')
    if (districtId) daysQ = daysQ.eq('district_id', districtId)
    const { data: days } = await daysQ
    const dayIds = (days ?? []).map((d) => d.id)

    let sessQ = supabase.from('sessions').select('id, day_id')
    if (dayIds.length > 0) sessQ = sessQ.in('day_id', dayIds)
    else sessQ = sessQ.eq('day_id', 'none')
    const { data: sessions } = await sessQ
    const sessionIds = (sessions ?? []).map((s) => s.id)

    let evQ = supabase.from('events').select('id, session_id')
    if (sessionIds.length > 0) evQ = evQ.in('session_id', sessionIds)
    else evQ = evQ.eq('session_id', 'none')
    const { data: events } = await evQ

    // --- Aggregate ---

    const personContrib: Record<string, number> = {}
    for (const c of contributions ?? []) {
      personContrib[c.person_id] = (personContrib[c.person_id] ?? 0) + c.amount
    }

    const totalContributions = Object.values(personContrib).reduce((a, b) => a + b, 0)
    const totalExpenses = (expenses ?? []).reduce((a, e) => a + e.amount, 0)

    // By region
    const regionMap: Record<string, { name: string; people_count: number; total: number }> = {}
    for (const r of regions ?? []) regionMap[r.id] = { name: r.name, people_count: 0, total: 0 }
    for (const p of people ?? []) {
      if (p.region_id && regionMap[p.region_id]) {
        regionMap[p.region_id].people_count++
        regionMap[p.region_id].total += personContrib[p.id] ?? 0
      }
    }

    // By department (only people in scope)
    const deptMap: Record<string, { name: string; people_count: number; total: number }> = {}
    for (const d of departments ?? []) deptMap[d.id] = { name: d.name, people_count: 0, total: 0 }
    for (const p of people ?? []) {
      if (p.department_id && deptMap[p.department_id]) {
        deptMap[p.department_id].people_count++
        deptMap[p.department_id].total += personContrib[p.id] ?? 0
      }
    }

    // By gender
    const genderMap: Record<string, { count: number; total: number }> = {}
    for (const p of people ?? []) {
      const g = p.gender ?? 'unknown'
      if (!genderMap[g]) genderMap[g] = { count: 0, total: 0 }
      genderMap[g].count++
      genderMap[g].total += personContrib[p.id] ?? 0
    }

    // Sessions / events per day
    const sessPerDay: Record<string, number> = {}
    const evPerDay: Record<string, number> = {}
    const evPerSess: Record<string, number> = {}
    for (const e of events ?? []) evPerSess[e.session_id] = (evPerSess[e.session_id] ?? 0) + 1
    for (const s of sessions ?? []) {
      sessPerDay[s.day_id] = (sessPerDay[s.day_id] ?? 0) + 1
      evPerDay[s.day_id] = (evPerDay[s.day_id] ?? 0) + (evPerSess[s.id] ?? 0)
    }

    setData({
      totalContributions,
      totalExpenses,
      netBalance: totalContributions - totalExpenses,
      totalPeople: (people ?? []).length,
      byRegion: Object.entries(regionMap)
        .map(([id, v]) => ({ region_id: id, region_name: v.name, people_count: v.people_count, total: v.total }))
        .sort((a, b) => b.total - a.total),
      byDepartment: Object.entries(deptMap)
        .filter(([, v]) => v.people_count > 0)
        .map(([id, v]) => ({ department_id: id, department_name: v.name, people_count: v.people_count, total: v.total }))
        .sort((a, b) => b.total - a.total),
      byGender: Object.entries(genderMap)
        .filter(([, v]) => v.count > 0)
        .map(([g, v]) => ({
          gender: (g === 'unknown' ? null : g) as 'male' | 'female' | 'other' | null,
          count: v.count,
          total: v.total,
        }))
        .sort((a, b) => b.total - a.total),
      days: (days ?? []).map((d) => ({
        date: d.date,
        label: d.label,
        sessions_count: sessPerDay[d.id] ?? 0,
        events_count: evPerDay[d.id] ?? 0,
      })),
      totalSessions: (sessions ?? []).length,
      totalEvents: (events ?? []).length,
      expenses: (expenses ?? []) as Expense[],
    })
    setLoading(false)
  }, [districtId]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  return { data, loading, refresh: load }
}
