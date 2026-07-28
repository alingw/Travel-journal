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

// Whether to auto-attach a web description + photo when adding a place. Default on.
const AUTO_INFO = 'tjp.autoInfo'

export function getAutoInfo(): boolean {
  try {
    return localStorage.getItem(AUTO_INFO) !== 'off'
  } catch {
    return true
  }
}

export function setAutoInfo(on: boolean): void {
  try {
    localStorage.setItem(AUTO_INFO, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}
