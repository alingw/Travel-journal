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

// "Who am I" on this device, used to default the payer on the split page so each
// participant can log what they paid. Shared per-browser, not synced.
const MY_NAME = 'tjp.myName'

export function getMyName(): string {
  try {
    return localStorage.getItem(MY_NAME) ?? ''
  } catch {
    return ''
  }
}

export function setMyName(name: string): void {
  try {
    localStorage.setItem(MY_NAME, name)
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
