// Native DWM tweaks that Electron doesn't expose: Win11 draws a hairline border
// and a drop shadow around rounded / acrylic windows, and the BrowserWindow
// options (hasShadow / roundedCorners) can't fully suppress them. We reach the
// DWM API directly through koffi (prebuilt FFI, no native build step).
import type { BrowserWindow } from 'electron'
import koffi from 'koffi'

let DwmSetWindowAttribute: ((
  hwnd: bigint,
  attr: number,
  pv: Buffer,
  cb: number
) => number) | null = null

try {
  const dwmapi = koffi.load('dwmapi.dll')
  DwmSetWindowAttribute = dwmapi.func(
    'int DwmSetWindowAttribute(uintptr_t hwnd, uint dwAttribute, void *pvAttribute, uint cbAttribute)'
  ) as never
} catch (e) {
  console.error('[dwm] dwmapi unavailable:', e)
}

// DWM window attributes (dwmapi.h)
const DWMWA_WINDOW_CORNER_PREFERENCE = 33
const DWMWA_BORDER_COLOR = 34

// DWM_WINDOW_CORNER_PREFERENCE
export const CORNER_DEFAULT = 0
export const CORNER_DONOTROUND = 1
export const CORNER_ROUND = 2
export const CORNER_ROUNDSMALL = 3

// sentinel colors for DWMWA_BORDER_COLOR
const DWMWA_COLOR_NONE = 0xfffffffe

function hwndOf(win: BrowserWindow): bigint | null {
  try {
    const buf = win.getNativeWindowHandle()
    return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
  } catch {
    return null
  }
}

function setDword(win: BrowserWindow, attr: number, value: number): void {
  if (!DwmSetWindowAttribute) return
  const hwnd = hwndOf(win)
  if (hwnd === null) return
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value >>> 0, 0)
  try {
    DwmSetWindowAttribute(hwnd, attr, buf, 4)
  } catch (e) {
    console.error('[dwm] set attr', attr, 'failed:', e)
  }
}

/** Remove the Win11 hairline border drawn around the window. */
export function removeBorderLine(win: BrowserWindow): void {
  setDword(win, DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE)
}

/** Override the corner rounding (round / small / square). */
export function setCornerPreference(win: BrowserWindow, pref: number): void {
  setDword(win, DWMWA_WINDOW_CORNER_PREFERENCE, pref)
}
