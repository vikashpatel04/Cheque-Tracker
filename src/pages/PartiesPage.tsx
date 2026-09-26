import { Routes, Route } from 'react-router-dom'
import { PartyDetail } from '@/components/parties/PartyDetail'
import Parties from './Parties'

export default function PartiesPage() {
  return (
    <Routes>
      <Route index element={<Parties />} />
      <Route path=":id" element={<PartyDetail />} />
    </Routes>
  )
}
