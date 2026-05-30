import { ChequeList } from '@/components/cheques/ChequeList'

export default function Cheques() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Cheques</h2>
      <ChequeList />
    </div>
  )
}
