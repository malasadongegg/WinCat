/**
 * Snippet templates: {name} placeholders are filled in before copying.
 * {date}, {time} and {datetime} are built in; everything else asks the user.
 * Use {{ and }} for literal braces.
 */
const BUILTIN = new Set(['date', 'time', 'datetime'])
const PLACEHOLDER = /(?<!\{)\{([A-Za-z_][\w ]{0,30})\}(?!\})/g

export function placeholders(body: string): string[] {
  const out: string[] = []
  for (const m of body.matchAll(PLACEHOLDER)) {
    const name = m[1].trim()
    if (!BUILTIN.has(name.toLowerCase()) && !out.includes(name)) out.push(name)
  }
  return out
}

export function builtinValue(name: string, now = new Date()): string | undefined {
  const date = now.toLocaleDateString()
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  switch (name.toLowerCase()) {
    case 'date': return date
    case 'time': return time
    case 'datetime': return `${date} ${time}`
    default: return undefined
  }
}

export function fill(body: string, values: Record<string, string>, now = new Date()): string {
  return body
    .replace(PLACEHOLDER, (whole, raw: string) => {
      const name = raw.trim()
      return builtinValue(name, now) ?? values[name] ?? whole
    })
    .replace(/\{\{/g, '{')
    .replace(/\}\}/g, '}')
}
