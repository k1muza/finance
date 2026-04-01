'use client'

import { useState } from 'react'
import { useContributions } from '@/hooks/useContributions'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { PlusCircle, Trash2 } from 'lucide-react'

interface ContributionsListProps {
  personId: string
  onChange?: () => Promise<void> | void
}

const today = () => new Date().toISOString().split('T')[0]

export function ContributionsList({ personId, onChange }: ContributionsListProps) {
  const { data, loading, total, add, remove } = useContributions(personId)
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ amount: '', note: '', date: today() })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async () => {
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount greater than 0')
      return
    }
    setSaving(true)
    try {
      await add({ amount, note: form.note.trim() || null as unknown as string, date: form.date })
      setForm({ amount: '', note: '', date: today() })
      setAdding(false)
      void onChange?.()
      toast.success('Contribution added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await remove(id)
      void onChange?.()
      toast.success('Contribution removed')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Contributions</h2>
          <p className="text-sm text-slate-400">
            Total: <span className="text-cyan-400 font-semibold">{formatCurrency(total)}</span>
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <PlusCircle className="h-4 w-4" /> Add Contribution
          </Button>
        )}
      </div>

      {adding && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">New Contribution</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Amount (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <Input
              label="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Registration fee"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 py-4">Loading…</p>
      ) : data.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-500 text-sm">No contributions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Note</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.note ?? <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold text-cyan-400">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="text-slate-500 hover:text-red-400 transition disabled:opacity-40"
                      title="Delete contribution"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
