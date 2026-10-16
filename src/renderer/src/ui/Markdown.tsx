import type { ReactNode } from 'react'

/**
 * Small, safe Markdown renderer. It builds React elements (never HTML strings), so note content can
 * not inject markup or scripts. Supports headings, paragraphs, bullet/numbered lists, quotes, fenced
 * code, and inline **bold**, *italic*, `code` and [links] (links are shown, not followed).
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let i = 0
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const tok = m[0]
    const k = `${key}-${i++}`
    if (m[1]) out.push(<code key={k}>{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>)
    else if (m[3]) out.push(<em key={k}>{tok.slice(1, -1)}</em>)
    else {
      const [, label, url] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok) ?? []
      out.push(<span key={k} className="mdlink" title={url}>{label}</span>)
    }
    last = at + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${n++}`
    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>)
    } else if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length
      const Tag = (`h${level + 1}` as 'h2' | 'h3' | 'h4')
      blocks.push(<Tag key={key}>{inline(line.replace(/^#+\s/, ''), key)}</Tag>)
      i++
    } else if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''))
      blocks.push(<ul key={key}>{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ul>)
    } else if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s/, ''))
      blocks.push(<ol key={key}>{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ol>)
    } else if (line.startsWith('>')) {
      const q: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={key}>{inline(q.join(' '), key)}</blockquote>)
    } else if (!line.trim()) {
      i++
    } else {
      const p: string[] = []
      while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|>)/.test(lines[i])) p.push(lines[i++])
      blocks.push(<p key={key}>{inline(p.join(' '), key)}</p>)
    }
  }
  return <div className="md">{blocks}</div>
}
