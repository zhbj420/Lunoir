import type { MmpApi } from './index'

declare global {
  interface Window {
    mmp: MmpApi
  }
}

export {}
