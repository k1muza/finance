'use client'

import { useState } from 'react'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { DepartmentCard } from '@/components/departments/DepartmentCard'
import { DepartmentModal } from '@/components/departments/DepartmentModal'
import { DepartmentExpandModal } from '@/components/departments/DepartmentExpandModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Department } from '@/types'
import { Plus } from 'lucide-react'

export default function DepartmentsPage() {
  const { isAdmin, districtId } = useAuth()
  const { data: departments, loading, create, update, remove, refresh } = useDepartments(districtId)
  const [modal, setModal] = useState<{ open: boolean; dept: Department | null }>({ open: false, dept: null })
  const [expand, setExpand] = useState<{ open: boolean; dept: Department | null }>({ open: false, dept: null })
  const [confirm, setConfirm] = useState<{ open: boolean; dept: Department | null }>({ open: false, dept: null })
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const handleSave = async (values: { name: string; hod: string }) => {
    try {
      if (modal.dept) {
        await update(modal.dept.id, values)
        toast.success('Department updated')
      } else {
        await create(values)
        toast.success('Department created')
      }
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDelete = async () => {
    if (!confirm.dept) return
    setDeleting(true)
    try {
      await remove(confirm.dept.id)
      toast.success('Department deleted')
      setConfirm({ open: false, dept: null })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Departments</h1>
          <p className="text-sm text-slate-400 mt-1">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setModal({ open: true, dept: null })}>
            <Plus className="h-4 w-4" /> New Department
          </Button>
        )}
      </div>

      {loading ? (
        <PageSpinner />
      ) : departments.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No departments yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              onManage={() => setExpand({ open: true, dept })}
              onEdit={() => setModal({ open: true, dept })}
              onDelete={() => setConfirm({ open: true, dept })}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <DepartmentModal
        open={modal.open}
        onClose={() => setModal({ open: false, dept: null })}
        onSave={handleSave}
        initial={modal.dept}
      />

      <DepartmentExpandModal
        open={expand.open}
        onClose={() => setExpand({ open: false, dept: null })}
        department={expand.dept}
        onRefresh={refresh}
        districtId={districtId}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, dept: null })}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Delete "${confirm.dept?.name}"? Members will be unassigned.`}
        loading={deleting}
      />
    </div>
  )
}
