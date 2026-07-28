// Curated watercolor sticker library + resolver.
//
// This is the single source of truth for stickers. Every view asks for a sticker
// through `resolveStickerId()` / `stickerSvg()`, so when the AI provider lands in a
// later phase it only has to implement the same `StickerProvider` interface — no view
// changes needed.

import type { Category } from '../types'

// ---- Palette (kept consistent across every sticker) ----
const ink = '#4a3f35'
const green = '#8fb98f'
const greenDk = '#5c7a5c'
const terra = '#e07a5f'
const terraDk = '#a9503a'
const mustard = '#e2b04a'
const mustardDk = '#b6842a'
const blue = '#6a9fb5'
const blueDk = '#3f7387'
const brown = '#b98b5e'
const brownDk = '#8a6540'
const cream = '#f7f0dd'

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

// Each sticker is a small hand-drawn scene. Stroke widths are deliberately a touch
// uneven to read as "drawn".
export const STICKERS: Record<string, string> = {
  airplane: wrap(`
    <path d="M8 34 L56 26 L50 32 L30 40 L22 52 L20 42 L8 34 Z" fill="${blue}" stroke="${blueDk}" stroke-width="2.5"/>
    <path d="M34 30 L44 18" stroke="${blueDk}" stroke-width="2.5"/>
    <circle cx="49" cy="27" r="1.6" fill="${cream}"/>`),

  bed: wrap(`
    <path d="M8 40 L8 24 L40 24 Q52 24 52 34 L56 34 L56 44" stroke="${brownDk}" stroke-width="2.5"/>
    <rect x="12" y="30" width="16" height="10" rx="2" fill="${terra}" stroke="${terraDk}" stroke-width="2"/>
    <path d="M8 44 L8 48 M56 44 L56 48" stroke="${brownDk}" stroke-width="2.5"/>
    <path d="M8 40 L56 40" stroke="${brownDk}" stroke-width="2.5"/>`),

  tennis: wrap(`
    <ellipse cx="26" cy="26" rx="13" ry="15" fill="${green}" stroke="${greenDk}" stroke-width="2.5" transform="rotate(-30 26 26)"/>
    <path d="M18 20 L34 32 M22 15 L30 37 M14 26 L38 26" stroke="${greenDk}" stroke-width="1.4" transform="rotate(-30 26 26)"/>
    <path d="M34 34 L48 50" stroke="${greenDk}" stroke-width="3"/>
    <circle cx="50" cy="20" r="6" fill="${mustard}" stroke="${mustardDk}" stroke-width="2"/>
    <path d="M45 18 Q50 22 55 18" stroke="${cream}" stroke-width="1.5"/>`),

  ticket: wrap(`
    <path d="M10 22 h44 v8 a4 4 0 0 0 0 8 v4 h-44 v-4 a4 4 0 0 0 0 -8 z" fill="${mustard}" stroke="${mustardDk}" stroke-width="2.5"/>
    <path d="M28 22 v20" stroke="${mustardDk}" stroke-width="1.6" stroke-dasharray="2 3"/>
    <path d="M36 28 h12 M36 34 h10" stroke="${mustardDk}" stroke-width="1.6"/>`),

  camera: wrap(`
    <path d="M8 26 h10 l4 -5 h12 l4 5 h10 a3 3 0 0 1 3 3 v18 a3 3 0 0 1 -3 3 h-40 a3 3 0 0 1 -3 -3 v-18 a3 3 0 0 1 3 -3 z" fill="${brown}" stroke="${brownDk}" stroke-width="2.5"/>
    <circle cx="32" cy="38" r="9" fill="${blue}" stroke="${blueDk}" stroke-width="2.5"/>
    <circle cx="32" cy="38" r="3.5" fill="${cream}"/>`),

  landmark: wrap(`
    <path d="M32 10 L52 24 H12 Z" fill="${terra}" stroke="${terraDk}" stroke-width="2.5"/>
    <path d="M16 24 V48 M26 24 V48 M38 24 V48 M48 24 V48" stroke="${brownDk}" stroke-width="3"/>
    <path d="M10 48 H54 M12 52 H52" stroke="${brownDk}" stroke-width="2.5"/>`),

  tree: wrap(`
    <path d="M32 12 Q46 16 44 30 Q52 32 46 42 Q34 46 32 40 Q30 46 18 42 Q12 32 20 30 Q18 16 32 12 Z" fill="${green}" stroke="${greenDk}" stroke-width="2.5"/>
    <path d="M32 40 V54" stroke="${brownDk}" stroke-width="3"/>`),

  ferriswheel: wrap(`
    <circle cx="32" cy="30" r="20" fill="none" stroke="${terraDk}" stroke-width="2.5"/>
    <circle cx="32" cy="30" r="4" fill="${mustard}" stroke="${mustardDk}" stroke-width="2"/>
    <path d="M32 10 V50 M12 30 H52 M18 16 L46 44 M46 16 L18 44" stroke="${terraDk}" stroke-width="1.6"/>
    <circle cx="32" cy="10" r="3" fill="${blue}"/><circle cx="52" cy="30" r="3" fill="${green}"/>
    <circle cx="32" cy="50" r="3" fill="${terra}"/><circle cx="12" cy="30" r="3" fill="${mustard}"/>
    <path d="M22 54 H42 L32 50 Z" fill="${brownDk}"/>`),

  noodles: wrap(`
    <path d="M12 28 Q32 20 52 28 L48 42 Q32 52 16 42 Z" fill="${cream}" stroke="${terraDk}" stroke-width="2.5"/>
    <path d="M20 28 Q24 16 30 26 Q34 14 40 26 Q46 16 48 28" stroke="${mustardDk}" stroke-width="2"/>
    <path d="M42 22 L58 14 M46 26 L60 20" stroke="${brownDk}" stroke-width="2"/>`),

  dumpling: wrap(`
    <path d="M12 40 Q32 18 52 40 Q32 48 12 40 Z" fill="${cream}" stroke="${brownDk}" stroke-width="2.5"/>
    <path d="M18 36 Q22 30 26 36 Q30 30 34 36 Q38 30 42 36 Q46 30 48 37" stroke="${brownDk}" stroke-width="1.8"/>`),

  bagel: wrap(`
    <circle cx="32" cy="34" r="18" fill="${mustard}" stroke="${mustardDk}" stroke-width="2.5"/>
    <circle cx="32" cy="34" r="6" fill="${cream}" stroke="${mustardDk}" stroke-width="2"/>
    <circle cx="24" cy="26" r="1.4" fill="${brownDk}"/><circle cx="40" cy="26" r="1.4" fill="${brownDk}"/>
    <circle cx="44" cy="36" r="1.4" fill="${brownDk}"/><circle cx="22" cy="40" r="1.4" fill="${brownDk}"/>`),

  coffee: wrap(`
    <path d="M14 26 h30 v10 a12 12 0 0 1 -12 12 h-6 a12 12 0 0 1 -12 -12 z" fill="${brown}" stroke="${brownDk}" stroke-width="2.5"/>
    <path d="M44 28 h4 a5 5 0 0 1 0 10 h-4" stroke="${brownDk}" stroke-width="2.5"/>
    <path d="M22 16 Q26 20 22 24 M32 16 Q36 20 32 24" stroke="${brownDk}" stroke-width="2"/>`),

  fork: wrap(`
    <circle cx="32" cy="34" r="20" fill="${cream}" stroke="${brownDk}" stroke-width="2.5"/>
    <circle cx="32" cy="34" r="12" fill="none" stroke="${brown}" stroke-width="1.6"/>
    <path d="M18 18 V30 M15 18 V26 M21 18 V26 M18 30 V50" stroke="${greenDk}" stroke-width="2.2"/>
    <path d="M46 18 Q40 22 44 34 L46 34 V50" stroke="${terraDk}" stroke-width="2.2"/>`),

  subway: wrap(`
    <rect x="14" y="14" width="36" height="34" rx="6" fill="${mustard}" stroke="${mustardDk}" stroke-width="2.5"/>
    <rect x="18" y="20" width="28" height="12" rx="2" fill="${cream}" stroke="${mustardDk}" stroke-width="1.8"/>
    <circle cx="22" cy="42" r="2.4" fill="${ink}"/><circle cx="42" cy="42" r="2.4" fill="${ink}"/>
    <path d="M18 52 L14 58 M46 52 L50 58" stroke="${mustardDk}" stroke-width="2.2"/>`),

  boat: wrap(`
    <path d="M12 40 h40 l-6 10 h-28 z" fill="${terra}" stroke="${terraDk}" stroke-width="2.5"/>
    <path d="M32 12 V40 M32 16 L46 36 H32 M32 20 L20 36 H32" fill="${cream}" stroke="${blueDk}" stroke-width="2"/>`),

  pin: wrap(`
    <path d="M32 54 C20 40 16 32 16 24 A16 16 0 0 1 48 24 C48 32 44 40 32 54 Z" fill="${terra}" stroke="${terraDk}" stroke-width="2.5"/>
    <circle cx="32" cy="24" r="6" fill="${cream}" stroke="${terraDk}" stroke-width="2"/>`),
}

// Keyword rules checked (in order) against the place name. First hit wins.
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/airport|flight|arriv|jfk|lga|ewr|terminal|departure/i, 'airplane'],
  [/hotel|inn|hostel|motel|resort|airbnb|stay|lodge|suite/i, 'bed'],
  [/tennis|us open|arthur ashe|louis armstrong|court|racket|grand slam/i, 'tennis'],
  [/concert|show|theat(er|re)|broadway|opera|ticket|arena|game|match/i, 'ticket'],
  [/vessel|observ|view|lookout|deck|edge|skyline|overlook/i, 'camera'],
  [/museum|monument|statue|empire|tower|cathedral|memorial|library|landmark|building/i, 'landmark'],
  [/park|garden|botanic|meadow|green|square/i, 'tree'],
  [/wheel|pier|coney|amusement|carousel|fair/i, 'ferriswheel'],
  [/ramen|noodle|pho|udon|soba|soup|thai|viet/i, 'noodles'],
  [/dumpling|dim sum|bao|xiao long|hotpot|chinese|szechuan|flushing/i, 'dumpling'],
  [/bagel|deli|breakfast|brunch|donut|bakery|pastry/i, 'bagel'],
  [/coffee|cafe|café|espresso|latte|tea house|roaster/i, 'coffee'],
  [/ferry|boat|cruise|harbor|harbour|river|yacht/i, 'boat'],
  [/subway|train|metro|station|bus|transit|rail/i, 'subway'],
  [/restaurant|dinner|lunch|grill|kitchen|bistro|eatery|pizza|burger|steak|bar\b/i, 'fork'],
]

// Fallback sticker per category when no keyword matches.
const CATEGORY_DEFAULT: Record<Category, string> = {
  arrival: 'airplane',
  lodging: 'bed',
  event: 'ticket',
  sight: 'landmark',
  food: 'fork',
  transport: 'subway',
  other: 'pin',
}

/** Resolve the best curated sticker id for a place. */
export function resolveStickerId(name: string, category: Category): string {
  for (const [re, id] of KEYWORD_RULES) {
    if (re.test(name)) return id
  }
  return CATEGORY_DEFAULT[category] ?? 'pin'
}

/** Raw SVG markup for a sticker id (falls back to the generic pin). */
export function stickerSvg(id: string): string {
  return STICKERS[id] ?? STICKERS.pin
}

/** SVG as a data URI — handy for <img> and Leaflet divIcons. */
export function stickerDataUri(id: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(stickerSvg(id))}`
}

// ---- Pluggable provider interface (curated now, AI later) ----
export interface StickerProvider {
  /** Return a sticker id (curated) or a data/remote URL string for a custom image. */
  getSticker(name: string, category: Category): Promise<string>
}

export const curatedProvider: StickerProvider = {
  async getSticker(name, category) {
    return resolveStickerId(name, category)
  },
}
