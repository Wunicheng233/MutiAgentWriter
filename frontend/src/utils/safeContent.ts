const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const SAFE_MARKDOWN_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:']
const SAFE_HTML_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])
const SAFE_HTML_ATTRS = new Set(['href', 'title', 'target', 'rel', 'class'])
const AUTO_PARAGRAPH_MIN_LENGTH = 140
const AUTO_PARAGRAPH_MAX_LENGTH = 220

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char])
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true

  try {
    return SAFE_MARKDOWN_LINK_PROTOCOLS.includes(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function renderInlineMarkdown(value: string): string {
  const withLinks = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const normalizedHref = href.replace(/&amp;/g, '&')
    if (!isSafeHref(normalizedHref)) {
      return label
    }
    return `<a href="${escapeAttribute(normalizedHref)}" class="underline text-[var(--accent-primary)]" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  return withLinks
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

export function plainTextToSafeHtml(text: string): string {
  return splitNovelTextIntoParagraphs(text)
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function splitLongNovelParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim()
  if (trimmed.length <= AUTO_PARAGRAPH_MAX_LENGTH) return [trimmed]

  const sentences = trimmed.match(/[^。！？!?；;]+[。！？!?；;”’」』）)]*|.+$/g) || [trimmed]
  const paragraphs: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const next = sentence.trim()
    if (!next) continue

    if (current && current.length + next.length > AUTO_PARAGRAPH_MAX_LENGTH) {
      paragraphs.push(current)
      current = next
      continue
    }

    current += next
    if (current.length >= AUTO_PARAGRAPH_MIN_LENGTH) {
      paragraphs.push(current)
      current = ''
    }
  }

  if (current) paragraphs.push(current)

  return paragraphs.flatMap(item => {
    if (item.length <= AUTO_PARAGRAPH_MAX_LENGTH) return [item]
    const chunks: string[] = []
    for (let index = 0; index < item.length; index += AUTO_PARAGRAPH_MAX_LENGTH) {
      chunks.push(item.slice(index, index + AUTO_PARAGRAPH_MAX_LENGTH))
    }
    return chunks
  })
}

function splitNovelTextIntoParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(splitLongNovelParagraph)
}

export function renderSafeMarkdown(text: string): string {
  const lines = text.split('\n')
  const renderedLines: string[] = []
  let tableOpen = false

  const closeTable = () => {
    if (tableOpen) {
      renderedLines.push('</tbody></table>')
      tableOpen = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      closeTable()
      continue
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1)
      const isSeparator = cells.every(cell => /^[\s\-:]+$/.test(cell.trim()))
      if (isSeparator) continue

      if (!tableOpen) {
        renderedLines.push('<table class="border-collapse my-3 w-full bg-[var(--bg-secondary)] rounded border border-[var(--border-default)] overflow-hidden"><tbody>')
        tableOpen = true
      }
      renderedLines.push(
        `<tr>${cells
          .map(cell => `<td class="border border-[var(--border-default)] p-2 align-top">${renderInlineMarkdown(escapeHtml(cell.trim()))}</td>`)
          .join('')}</tr>`
      )
      continue
    }

    closeTable()

    if (line.startsWith('### ')) {
      renderedLines.push(`<h3 class="text-base font-semibold mb-1 mt-2">${renderInlineMarkdown(escapeHtml(line.slice(4)))}</h3>`)
    } else if (line.startsWith('## ')) {
      renderedLines.push(`<h2 class="text-lg font-semibold mb-2 mt-3">${renderInlineMarkdown(escapeHtml(line.slice(3)))}</h2>`)
    } else if (line.startsWith('# ')) {
      renderedLines.push(`<h1 class="text-xl font-bold mb-2 mt-4">${renderInlineMarkdown(escapeHtml(line.slice(2)))}</h1>`)
    } else if (line.startsWith('- ')) {
      renderedLines.push(`<li class="ml-4 list-disc">${renderInlineMarkdown(escapeHtml(line.slice(2)))}</li>`)
    } else {
      renderedLines.push(`<p>${renderInlineMarkdown(escapeHtml(line))}</p>`)
    }
  }

  closeTable()
  return renderedLines.join('\n')
}

export function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content)
}

export function sanitizeHtml(content: string): string {
  if (typeof document === 'undefined') {
    return plainTextToSafeHtml(content)
  }

  const template = document.createElement('template')
  template.innerHTML = content

  const sanitizeElement = (element: Element) => {
    const tagName = element.tagName.toLowerCase()
    if (!SAFE_HTML_TAGS.has(tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ''))
      return
    }

    Array.from(element.attributes).forEach(attribute => {
      const attrName = attribute.name.toLowerCase()
      const attrValue = attribute.value
      const isUnsafeEvent = attrName.startsWith('on')
      const isUnsafeHref = attrName === 'href' && !isSafeHref(attrValue)

      if (!SAFE_HTML_ATTRS.has(attrName) || isUnsafeEvent || isUnsafeHref) {
        element.removeAttribute(attribute.name)
      }
    })

    if (tagName === 'a') {
      element.setAttribute('rel', 'noopener noreferrer')
      element.setAttribute('target', '_blank')
    }

    Array.from(element.children).forEach(sanitizeElement)
  }

  Array.from(template.content.children).forEach(sanitizeElement)
  return template.innerHTML
}

function countMeaningfulBlocks(html: string): number {
  const matches = html.match(/<(p|div|blockquote|li|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) || []
  return matches.filter(block => htmlToPlainText(block).trim()).length
}

export function chapterContentToEditorHtml(content: string): string {
  if (!content) return ''
  if (!looksLikeHtml(content)) {
    return plainTextToSafeHtml(content)
  }

  const sanitized = sanitizeHtml(content)
  const plainText = htmlToPlainText(sanitized)
  const shouldReparagraph =
    countMeaningfulBlocks(sanitized) <= 1
    && (plainText.includes('\n') || plainText.length > AUTO_PARAGRAPH_MAX_LENGTH)

  return shouldReparagraph ? plainTextToSafeHtml(plainText) : sanitized
}

export function htmlToPlainText(content: string): string {
  const textWithBreaks = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')

  if (typeof document === 'undefined') {
    return textWithBreaks
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }

  const textarea = document.createElement('textarea')
  textarea.innerHTML = textWithBreaks
  return textarea.value.trim()
}

export function chapterContentToPreviewText(content: string): string {
  if (!content) return ''
  return looksLikeHtml(content) ? htmlToPlainText(sanitizeHtml(content)) : content
}
