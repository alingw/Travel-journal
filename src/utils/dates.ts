// Small date helpers for ISO yyyy-mm-dd day strings (no timezone surprises).

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parse(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

export function dowLabel(iso: string): string {
  return DOW[parse(iso).getDay()]
}

export function dayNumLabel(iso: string): string {
  const d = parse(iso)
  return `${MON[d.getMonth()]} ${d.getDate()}`
}

export function fullDayLabel(iso: string): string {
  return `${dowLabel(iso)}, ${dayNumLabel(iso)}`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
