import { useEffect, useState } from 'react'
import { PERSONALITIES, levelInfo, type CompanionState, type Interaction, type Personality } from '@shared/companion'
import { CATALOG, type Slot } from '@shared/cosmetics'
import { ACHIEVEMENTS, COLLECTIBLES, FURNITURE, MAX_ROOM_ITEMS, ROOM_DIMS, ROOM_OFFER_LEVEL, ROOM_OPTIONS, seasonOf, type RoomSize, type RoomSlot } from '@shared/catlife'
import type { ConfigPatch } from '@shared/types'
import { spriteUrl } from './cat/items'
import { PixelCat } from './cat/PixelCat'
import { RoomArt, roomWorld } from './cat/RoomArt'
import { furnitureSize, spriteKey } from './cat/furniture'

interface Props {
  companion: CompanionState
  onInteract: (k: Interaction) => void
  onConfig: (c: ConfigPatch) => void
}

const SLOTS: Array<{ slot: Slot; title: string }> = [
  { slot: 'collar', title: 'Collar' },
  { slot: 'eyes', title: 'Eyes' },
  { slot: 'fur', title: 'Fur' },
  { slot: 'hat', title: 'Headwear' },
  { slot: 'neck', title: 'Neckwear' }
]

const ROOM_SLOTS: Array<{ slot: RoomSlot; title: string }> = [
  { slot: 'wall', title: 'Wallpaper' },
  { slot: 'floor', title: 'Floor' },
  { slot: 'window', title: 'Window' },
  { slot: 'rug', title: 'Rug' },
  { slot: 'art', title: 'Wall art' },
  { slot: 'plant', title: 'Plant' },
  { slot: 'lamp', title: 'Lamp' }
]

const SECTIONS = ['Overview', 'Wardrobe', 'Room', 'Collection', 'Achievements'] as const
type Section = (typeof SECTIONS)[number]

export function CatTab({ companion: c, onInteract, onConfig }: Props) {
  const [section, setSection] = useState<Section>('Overview')
  const lv = levelInfo(c.bond)

  // furniture is only draggable on the desktop while the Room section is open
  const [decorate, setDecorate] = useState(false)
  useEffect(() => {
    window.cat.decorateSet(decorate && section === 'Room')
    return () => window.cat.decorateSet(false)
  }, [decorate, section])

  const addFurniture = (type: 'ball' | 'bed' | 'box' | 'post') => {
    const item = { id: crypto.randomUUID(), type, x: 0.25 + Math.random() * 0.5 }
    onConfig({ room: [...c.room, item] })
  }

  const found = Object.keys(c.collection)
  const doneCount = ACHIEVEMENTS.filter((a) => c.achievements[a.id]).length

  return (
    <div>
      <div className="row page-head">
        <h1>Cat</h1>
        <div className="seg" role="tablist" aria-label="Cat sections">
          {SECTIONS.map((s) => (
            <button key={s} role="tab" aria-selected={section === s} className={section === s ? 'on' : ''} onClick={() => setSection(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {section === 'Overview' && (
        <div className="grid">
          <div className="card">
            <h2>Bond</h2>
            <p className="big">Level {lv.level}</p>
            <progress value={lv.into} max={lv.needed} aria-label="Progress to next level" />
            <p className="hint">
              {lv.into}/{lv.needed} to level {lv.level + 1}. Bond only ever grows &mdash; your cat never gets hungry, sad or
              upset, even if you are away.
            </p>
            <dl>
              <dt>Pets</dt><dd>{c.pets}</dd>
              <dt>Treats</dt><dd>{c.treats}</dd>
              <dt>Play sessions</dt><dd>{c.plays}</dd>
              <dt>Achievements</dt><dd>{doneCount}/{ACHIEVEMENTS.length}</dd>
              <dt>Things found</dt><dd>{found.length}/{COLLECTIBLES.length}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Care (optional)</h2>
            <div className="row wrap">
              <button onClick={() => onInteract('pet')}>&#9995; Pet</button>
              <button onClick={() => onInteract('treat')}>&#128031; Treat</button>
              <button onClick={() => onInteract('play')}>&#129526; Play</button>
              <button onClick={() => onInteract('rest')}>&#128164; Rest / wake</button>
            </div>
            <p className="hint">Too many treats, pets or play in a short time makes your cat sick, grumpy or hyper. It passes in seconds and never costs bond.</p>
            <h2>Personality</h2>
            <select value={c.personality} onChange={(e) => onConfig({ personality: e.target.value as Personality })} aria-label="Personality">
              {PERSONALITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
            <label className="row spaced">
              <input type="checkbox" checked={c.bubbles} onChange={(e) => onConfig({ bubbles: e.target.checked })} />
              Speech bubbles
            </label>
            <label className="row">
              <input type="checkbox" checked={c.perch} onChange={(e) => onConfig({ perch: e.target.checked })} />
              Sit on top of open windows
            </label>
            <p className="hint">Only window positions are read; titles and app names never are.</p>
            <label className="row">
              <input type="checkbox" checked={c.sound} onChange={(e) => onConfig({ sound: e.target.checked })} />
              Sounds (off by default)
            </label>
            <label className="row">
              Volume
              <input type="range" min={0} max={1} step={0.05} value={c.volume} disabled={!c.sound} onChange={(e) => onConfig({ volume: Number(e.target.value) })} aria-label="Volume" />
            </label>
          </div>
        </div>
      )}

      {section === 'Wardrobe' && (
        <div className="card">
          <h2>Wardrobe</h2>
          <p className="hint">Items unlock as your bond level grows. Nothing expires and nothing is ever taken away.</p>
          {SLOTS.map(({ slot, title }) => (
            <div key={slot} className="slot" role="group" aria-label={title}>
              <span className="slot-name">{title}</span>
              <div className="row wrap">
                {CATALOG[slot].map((it) => {
                  const locked = it.level > lv.level
                  const on = c.cosmetics[slot] === it.id
                  return (
                    <button
                      key={it.id}
                      className={'chip' + (on ? ' on' : '')}
                      aria-pressed={on}
                      disabled={locked}
                      title={locked ? `Unlocks at level ${it.level}` : it.label}
                      onClick={() => onConfig({ cosmetics: { [slot]: it.id } })}
                    >
                      {it.color && <span className="swatch" style={{ background: it.color }} />}
                      {it.label}
                      {locked && <span className="lock"> Lv {it.level}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'Room' && (
        <div>
          <div className="card">
            <h2>The cat&rsquo;s own room</h2>
            {lv.level < ROOM_OFFER_LEVEL ? (
              <p className="hint">Your cat will ask for a room of its own once you reach bond level {ROOM_OFFER_LEVEL}.</p>
            ) : (
              <>
                <p className="hint">
                  {c.roomMode
                    ? 'Your cat lives in its room: a framed box on your desktop. Drag its title bar to move it.'
                    : c.roomOffer === 'unasked'
                      ? 'Your cat would love a room of its own! It would live inside a little framed box on your desktop instead of wandering over everything.'
                      : 'Give your cat a cozy room to live in, or let it roam the whole desktop. You can switch any time.'}
                </p>
                <div className="row wrap">
                  {c.roomMode ? (
                    <button onClick={() => onConfig({ roomMode: false })}>Let the cat roam the desktop</button>
                  ) : (
                    <button className="primary" onClick={() => onConfig({ roomMode: true })}>{c.roomOffer === 'unasked' ? 'Yes, give the cat a room!' : 'Move the cat into its room'}</button>
                  )}
                  {c.roomMode && <button onClick={() => onConfig({ roomPos: null })}>Reset position</button>}
                </div>
              </>
            )}
            <h2>Size</h2>
            <div className="seg" role="group" aria-label="Room size">
              {(['small', 'medium', 'large'] as RoomSize[]).map((z) => (
                <button key={z} className={c.roomSize === z ? 'on' : ''} aria-pressed={c.roomSize === z} onClick={() => onConfig({ roomSize: z })}>{z[0].toUpperCase() + z.slice(1)}</button>
              ))}
            </div>
            <h2 className="spaced-h">Preview</h2>
            <RoomPreview c={c} />
            {ROOM_SLOTS.map(({ slot, title }) => (
              <div key={slot} className="slot" role="group" aria-label={title}>
                <span className="slot-name">{title}</span>
                <div className="row wrap">
                  {ROOM_OPTIONS[slot].map((o) => {
                    const locked = o.level > lv.level
                    const on = c.roomStyle[slot] === o.id
                    return (
                      <button key={o.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on} disabled={locked} title={locked ? `Unlocks at level ${o.level}` : o.label} onClick={() => onConfig({ roomStyle: { [slot]: o.id } })}>
                        {o.label}
                        {locked && <span className="lock"> Lv {o.level}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Furniture &amp; toys</h2>
            <p className="hint">Place things on your desktop floor. Your cat visits them: naps in the bed, hides in the box, scratches the post and bats the ball. ({c.room.length}/{MAX_ROOM_ITEMS} placed)</p>
            <div className="furn-grid">
              {FURNITURE.map((f) => {
                const locked = f.level > lv.level
                return (
                  <div key={f.type} className={'furn-card' + (locked ? ' locked' : '')}>
                    <img src={spriteUrl(f.type === 'box' ? 'boxBack' : f.type)} alt="" className="furn-icon" />
                    <strong>{f.label}</strong>
                    <span className="hint">{locked ? `Unlocks at level ${f.level}` : f.hint}</span>
                    <button disabled={locked || c.room.length >= MAX_ROOM_ITEMS} onClick={() => addFurniture(f.type)}>+ Place</button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <h2>Arrange</h2>
            <label className="row">
              <input type="checkbox" checked={decorate} onChange={(e) => setDecorate(e.target.checked)} />
              Move furniture on the desktop (drag items left and right; &times; removes one)
            </label>
            {c.room.length === 0 ? (
              <p className="hint">Nothing placed yet.</p>
            ) : (
              <ul className="mini-list">
                {c.room.map((r) => (
                  <li key={r.id} className="row">
                    <span className="clip-text">{FURNITURE.find((f) => f.type === r.type)?.label}</span>
                    <button onClick={() => onConfig({ room: c.room.filter((q) => q.id !== r.id) })}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {section === 'Collection' && (
        <div className="card">
          <h2>Things your cat found</h2>
          <p className="hint">While wandering, your cat sometimes finds small treasures. Click them on the desktop to collect (or they join the collection by themselves). {found.length}/{COLLECTIBLES.length} kinds found &middot; season: {seasonOf(new Date())}.</p>
          <div className="coll-grid">
            {COLLECTIBLES.map((it) => {
              const n = c.collection[it.id] ?? 0
              return (
                <div key={it.id} className={'coll' + (n ? '' : ' unknown')} title={n ? it.label : it.season ? `Found in ${it.season}` : 'Not found yet'}>
                  <img src={spriteUrl(it.id)} alt="" />
                  <span className="coll-name">{n ? it.label : '???'}</span>
                  <span className="hint">{n ? `×${n}` : it.season ? it.season : it.rarity}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {section === 'Achievements' && (
        <div className="card">
          <h2>Achievements &mdash; {doneCount}/{ACHIEVEMENTS.length}</h2>
          <ul className="ach-list">
            {ACHIEVEMENTS.map((a) => {
              const at = c.achievements[a.id]
              return (
                <li key={a.id} className={'ach' + (at ? ' done' : '')}>
                  <span className="ach-ico" aria-hidden>{at ? '\u{1F3C6}' : '\u{1F512}'}</span>
                  <span className="ach-text">
                    <strong>{a.title}</strong>
                    <span className="hint">{a.desc}</span>
                  </span>
                  {at ? <span className="hint">{new Date(at).toLocaleDateString()}</span> : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** a small live picture of the cat's room: the art, your furniture and the cat itself */
function RoomPreview({ c }: { c: CompanionState }) {
  const dims = ROOM_DIMS[c.roomSize]
  const w = roomWorld(dims.w, dims.h)
  const k = 0.62
  return (
    <div className="room-preview" style={{ width: dims.w * k, height: dims.h * k }} aria-label="Room preview" role="img">
      <div style={{ transform: `scale(${k})`, transformOrigin: '0 0', width: dims.w, height: dims.h }}>
        <RoomArt style={c.roomStyle} w={dims.w} h={dims.h} hour={new Date().getHours()}>
          {c.room.map((r) => {
            const s = furnitureSize(r.type)
            return (
              <img
                key={r.id}
                src={spriteUrl(spriteKey(r.type))}
                alt=""
                draggable={false}
                style={{ position: 'absolute', imageRendering: 'pixelated', left: r.x * w.width - s.w / 2, top: w.height - s.h, width: s.w, height: s.h }}
              />
            )
          })}
          <div style={{ position: 'absolute', left: w.width / 2 - 48, top: w.height - 96, width: 96, height: 96 }}>
            <PixelCat anim="sit" effect="none" personality={c.personality} cosmetics={c.cosmetics} lowPower />
          </div>
          {c.room.filter((r) => r.type === 'box').map((r) => {
            const bf = furnitureSize('boxFront')
            return (
              <img
                key={'f' + r.id}
                src={spriteUrl('boxFront')}
                alt=""
                draggable={false}
                style={{ position: 'absolute', imageRendering: 'pixelated', left: r.x * w.width - bf.w / 2, top: w.height - bf.h, width: bf.w }}
              />
            )
          })}
        </RoomArt>
      </div>
    </div>
  )
}
