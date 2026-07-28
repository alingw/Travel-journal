// Tiny localStorage-backed settings (map key, etc.). Local-first, no server.

const STADIA_KEY = 'tjp.stadiaKey'

export function getStadiaKey(): string {
  try {
    return localStorage.getItem(STADIA_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStadiaKey(key: string): void {
  try {
    localStorage.setItem(STADIA_KEY, key)
  } catch {
    /* ignore */
  }
}
