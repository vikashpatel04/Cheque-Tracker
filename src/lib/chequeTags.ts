export type ChequeTag = 'RE_PRESENTED' | 'FROM_RETURN' | 'WRITTEN_OFF'

export function extractTags(notes: string | null): ChequeTag[] {
  if (!notes) return []
  const tags: ChequeTag[] = []
  if (notes.includes('[RE_PRESENTED]')) tags.push('RE_PRESENTED')
  if (notes.includes('[FROM_RETURN]')) tags.push('FROM_RETURN')
  if (notes.includes('[WRITTEN_OFF]')) tags.push('WRITTEN_OFF')
  return tags
}

export function stripTagLines(notes: string | null): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !['[RE_PRESENTED]', '[FROM_RETURN]', '[WRITTEN_OFF]'].some((t) => line.startsWith(t)))
    .join('\n')
    .trim()
}

export const TAG_LABELS: Record<ChequeTag, string> = {
  RE_PRESENTED: 'Re-presented',
  FROM_RETURN: 'From Return',
  WRITTEN_OFF: 'Written Off',
}

export const TAG_CLASSES: Record<ChequeTag, string> = {
  RE_PRESENTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  FROM_RETURN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  WRITTEN_OFF: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}
