import { useEffect } from 'react'
import { runAutoTransition } from '@/lib/autoTransition'

export function useAutoTransition() {
  useEffect(() => {
    runAutoTransition().catch(console.error)
  }, [])
}
