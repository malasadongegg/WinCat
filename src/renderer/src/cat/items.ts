/**
 * Pixel sprites for collectibles and furniture, drawn from small character maps (no image files).
 * spriteUrl(name) returns a PNG data URL; show it with `image-rendering: pixelated`.
 */
interface Def {
  rows: string[]
  colors: Record<string, string>
}

const D: Record<string, Def> = {
  // ----- collectibles (8x8) -----
  button: { rows: ['..xxxx..', '.xxxxxx.', 'xxhxxhxx', 'xxxxxxxx', 'xxhxxhxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..'], colors: { x: '#e8e8f0', h: '#7a7a90' } },
  feather: { rows: ['......xx', '.....xxx', '....xxx.', '...xxxs.', '..xxxs..', '.xxxs...', 'xxs.....', 'x.......'], colors: { x: '#cfe8ff', s: '#7aa0c0' } },
  bottlecap: { rows: ['.xyxyxx.', 'xxxxxxxx', 'yxxxxxxy', 'xxxxxxxx', 'xxxxxxxx', 'yxxxxxxy', 'xxxxxxxx', '.xyxyxx.'], colors: { x: '#c0392b', y: '#dddddd' } },
  fishbone: { rows: ['x.......', 'xx.x.x..', '.xxxxxxx', 'xxxxxxxx', '.xxxxxxx', 'xx.x.x..', 'x.......', '........'], colors: { x: '#f4f4ee' } },
  pebble: { rows: ['........', '..xxxx..', '.xhxxxx.', 'xxhxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '........'], colors: { x: '#8d8b99', h: '#b9b7c6' } },
  ribbon: { rows: ['xx....xx', 'xxx..xxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '.xx..xx.', 'xx....xx', 'x......x'], colors: { x: '#d64545' } },
  coin: { rows: ['..xxxx..', '.xxyyxx.', 'xxyxxyxx', 'xyxxxxyx', 'xyxxxxyx', 'xxyxxyxx', '.xxyyxx.', '..xxxx..'], colors: { x: '#f4c542', y: '#b8901c' } },
  key: { rows: ['..xxx...', '.x...x..', '.x...x..', '..xxx...', '...x....', '...xx...', '...x....', '...xx...'], colors: { x: '#f4c542' } },
  star: { rows: ['...xx...', '...xx...', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '.xxxxxx.', '.xx..xx.', 'x......x'], colors: { x: '#ffe066' } },
  flower: { rows: ['..x..x..', '.xxxxxx.', 'xxxyyxxx', '.xxyyxx.', '.xxxxxx.', '..x..x..', '...gg...', '...gg...'], colors: { x: '#ff9db4', y: '#ffd166', g: '#4caf6a' } },
  shell: { rows: ['..xxxx..', '.xyxyxx.', 'xxyxyxxx', 'xyxyxyxx', 'xxyxyxxx', '.xxxxxx.', '..xxxx..', '...xx...'], colors: { x: '#ffd9c0', y: '#e8a98e' } },
  leaf: { rows: ['....xxx.', '..xxxxxx', '.xxxxxxx', 'xxxyxxx.', 'xxyxxx..', 'xyxxx...', 'y.xx....', '...x....'], colors: { x: '#e0a53a', y: '#8c5a14' } },
  snowflake: { rows: ['x..xx..x', '.x.xx.x.', '..xxxx..', 'xxxxxxxx', 'xxxxxxxx', '..xxxx..', '.x.xx.x.', 'x..xx..x'], colors: { x: '#bfe6ff' } },
  // ----- furniture -----
  bed: {
    rows: [
      '....yyyyyyyyyyyyyyyy....',
      '..yyxxxxxxxxxxxxxxxxyy..',
      '.yxxxxxxxxxxxxxxxxxxxxy.',
      'yxxxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxxxy',
      '.yyxxxxxxxxxxxxxxxxxxyy.',
      '..yyyyyyyyyyyyyyyyyyyy..'
    ],
    colors: { x: '#c46b82', y: '#8c4456' }
  },
  boxBack: {
    rows: [
      'yyyyyyyyyyyyyyyyyyyyyy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy'
    ],
    colors: { x: '#8a6a43', y: '#6d5232' }
  },
  boxFront: {
    rows: [
      'yyyyyyyyyyyyyyyyyyyyyy',
      'yxxxxxxxxxtttxxxxxxxxy',
      'yxxxxxxxxxtttxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yxxxxxxxxxxxxxxxxxxxxy',
      'yyyyyyyyyyyyyyyyyyyyyy'
    ],
    colors: { x: '#c9a066', y: '#a87b4f', t: '#ecd9a8' }
  },
  post: {
    rows: [
      '.yyyyyyyy.',
      'yxxxxxxxxy',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      '..aabbaa..',
      '..bbaabb..',
      'yyyyyyyyyy',
      'yxxxxxxxxy'
    ],
    colors: { x: '#c9a66b', y: '#a98a58', a: '#d8b988', b: '#b89a68' }
  },
  ball: { rows: ['..xxxx..', '.xxqxxx.', 'xxqxxxxx', 'xqxxqxxx', 'xxxqxxqx', 'xxxxqqxx', '.xxxxxx.', '..xxxx..'], colors: { x: '#ffd166', q: '#e0a53a' } }
}


// ----- the cat room: window, wall art, plants, lamp -----
function windowRows(): string[] {
  const rows: string[] = []
  for (let y = 0; y < 20; y++) {
    let r = ''
    for (let x = 0; x < 24; x++) {
      if (y === 19) r += 'w'
      else if (y === 0 || y === 18 || x === 0 || x === 23 || x === 11 || x === 12 || y === 9) r += 'f'
      else r += 's'
    }
    rows.push(r)
  }
  // clouds / stars / snowflakes
  const dots: Array<[number, number]> = [[4, 3], [5, 3], [6, 3], [5, 2], [3, 5], [17, 4], [18, 4], [16, 12], [17, 12], [18, 12], [17, 11], [7, 14], [20, 15], [8, 6], [19, 7]]
  for (const [x, y] of dots) rows[y] = rows[y].slice(0, x) + 'c' + rows[y].slice(x + 1)
  return rows
}
function garlandRows(): string[] {
  const line = 'l'.repeat(24)
  const flag = (cols: string) => cols.repeat(6).slice(0, 24)
  return [line, flag('rrr.'), flag('rr..').replace(/\./g, '.'), flag('r...')].map((r, i) => (i === 0 ? r : r))
}
Object.assign(D, {
  window: { rows: windowRows(), colors: { f: '#8a6a43', w: '#b08a5a', s: '#9fd8ff', c: '#ffffff' } },
  artFish: { rows: ['ffffffffff', 'fbbbbbbbbf', 'fbbbbbbbbf', 'fbbxxxbxbf', 'fbxxwxxxxf', 'fbxxxxxxbf', 'fbbxxxbxbf', 'fbbbbbbbbf', 'fbbbbbbbbf', 'fbbbbbbbbf', 'fbbbbbbbbf', 'ffffffffff'], colors: { f: '#7a5a3a', b: '#cfe9f7', x: '#f08a4b', w: '#ffffff' } },
  artFrame: { rows: ['ffffffffff', 'fssssssssf', 'fssssssysf', 'fsggsssssf', 'fggggssssf', 'fgggggggsf', 'fggggggggf', 'fggggggggf', 'fggggggggf', 'ffffffffff'], colors: { f: '#7a5a3a', s: '#bfe3ff', g: '#6bb36b', y: '#ffe066' } },
  artClock: { rows: ['..cccccc..', '.cwwwwwwc.', 'cwwwwwwwwc', 'cwwwhwwwwc', 'cwwwhwwwwc', 'cwwwhhhwwc', 'cwwwwwwwwc', 'cwwwwwwwwc', '.cwwwwwwc.', '..cccccc..'], colors: { c: '#7a5a3a', w: '#fff8e8', h: '#3a2a22' } },
  artGarland: { rows: ['llllllllllllllllllllllll', 'rrr.yyy.bbb.ggg.rrr.yyy.', '.r...y...b...g...r...y..'], colors: { l: '#6d4c30', r: '#e85d5d', y: '#f2c230', b: '#4a90e2', g: '#4caf6a' } },
  plantSprout: { rows: ['...gg...', '..gggg..', '.gg.gg..', '..g..g..', '...gg...', '...g....', '.pppppp.', '.pppppp.', '..pppp..', '..pppp..'], colors: { g: '#4caf6a', p: '#b5651d' } },
  plantCactus: { rows: ['...gg...', '...gg...', '.g.gg.g.', '.g.gg.g.', '.gggggg.', '...gg...', '...gg...', '...gg...', '.pppppp.', '.pppppp.', '..pppp..', '..pppp..'], colors: { g: '#3f9b5b', p: '#c9744a' } },
  plantFern: { rows: ['..g......g..', '.gg..gg..gg.', '.ggg.gg.ggg.', '..ggggggggg.', '...gggggg...', '....gggg....', '.....gg.....', '.....gg.....', '..pppppppp..', '..pppppppp..', '..pppppppp..', '...pppppp...', '...pppppp...', '....pppp....'], colors: { g: '#3f9b5b', p: '#a05a2c' } },
  lampDesk: { rows: ['..yyyy..', '.yyyyyy.', 'yyyyyyyy', 'yyyyyyyy', '...ss...', '...ss...', '...ss...', '...ss...', '...ss...', '...ss...', '...ss...', '...ss...', '..bbbb..', '.bbbbbb.', '.bbbbbb.', '.bbbbbb.'], colors: { y: '#ffd98a', s: '#8a6a43', b: '#6d4c30' } }
} as Record<string, Def>)
void garlandRows

export type SpriteName = keyof typeof D

const cache = new Map<string, string>()

/** @param over optional colour overrides by map character, e.g. the sky colour of a window */
export function spriteUrl(name: string, over?: Record<string, string>): string {
  const key = over ? name + JSON.stringify(over) : name
  const hit = cache.get(key)
  if (hit) return hit
  const base = D[name]
  if (!base) return ''
  const d: Def = over ? { rows: base.rows, colors: { ...base.colors, ...over } } : base
  const w = d.rows[0].length
  const h = d.rows.length
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  d.rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const hex = d.colors[row[x]]
      if (!hex) continue
      img.data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], (y * w + x) * 4)
    }
  })
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL()
  cache.set(key, url)
  return url
}

export function spriteSize(name: string): { w: number; h: number } {
  const d = D[name]
  return d ? { w: d.rows[0].length, h: d.rows.length } : { w: 0, h: 0 }
}
