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

export type SpriteName = keyof typeof D

const cache = new Map<string, string>()

export function spriteUrl(name: string): string {
  const hit = cache.get(name)
  if (hit) return hit
  const d = D[name]
  if (!d) return ''
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
  cache.set(name, url)
  return url
}

export function spriteSize(name: string): { w: number; h: number } {
  const d = D[name]
  return d ? { w: d.rows[0].length, h: d.rows.length } : { w: 0, h: 0 }
}
