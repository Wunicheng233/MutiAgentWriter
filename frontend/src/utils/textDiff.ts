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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim()
}

export function renderDiffHtml(oldText: string, newText: string): string {
  const oldPlain = htmlToPlainText(oldText)
  const newPlain = htmlToPlainText(newText)

  const diff = computeDiff(oldPlain, newPlain)

  return diff.map(part => {
    const safeValue = escapeHtml(part.value).replace(/\n/g, '<br>')
    if (part.added) {
      return `<span style="background-color: rgba(0, 180, 0, 0.3); padding: 2px 4px; border-radius: 3px;">${safeValue}</span>`
    }
    if (part.removed) {
      return `<span style="background-color: rgba(255, 0, 0, 0.3); text-decoration: line-through; padding: 2px 4px; border-radius: 3px;">${safeValue}</span>`
    }
    return `<span>${safeValue}</span>`
  }).join('')
}
