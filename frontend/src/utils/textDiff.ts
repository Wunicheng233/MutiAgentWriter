import { diffChars } from 'diff'

export interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

export function computeDiff(oldText: string, newText: string): DiffPart[] {
  const diff = diffChars(oldText, newText)
  return diff.map(part => {
    const result: DiffPart = { value: part.value }
    if (part.added) result.added = true
    if (part.removed) result.removed = true
    return result
  })
}

export function renderDiffHtml(oldText: string, newText: string): string {
  const diff = computeDiff(oldText, newText)

  return diff.map(part => {
    if (part.added) {
      return `<span style="background-color: rgba(0, 180, 0, 0.3); padding: 2px 4px; border-radius: 3px;">${part.value}</span>`
    }
    if (part.removed) {
      return `<span style="background-color: rgba(255, 0, 0, 0.3); text-decoration: line-through; padding: 2px 4px; border-radius: 3px;">${part.value}</span>`
    }
    return `<span>${part.value}</span>`
  }).join('')
}
