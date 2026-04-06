import { redirect } from 'next/navigation'

export default function DeprecatedFinanceSettingsPage() {
  redirect('/dashboard/expenses/transactions')
}
