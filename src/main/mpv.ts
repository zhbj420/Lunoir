import { spawn, ChildProcess } from 'node:child_process'
import net from 'node:net'
import { EventEmitter } from 'node:events'

export interface MpvStartOptions {
  /** Native window handle (HWND as number) to embed mpv's video output into. */
  wid?: number
}

// Properties we continuously observe and forward to the UI.
const OBSERVED = [
  'pause',
  'time-pos',
  'duration',
  'volume',
  'mute',
  'speed', // playback speed → context-menu Speed submenu checkmark
  'filename',
  'media-title',
  'metadata/by-key/uploader', // stream author (YouTube channel) → title bar
  'eof-reached',
  'ab-loop-a', // A-B loop points (seconds, or 'no' when unset) → OSC seek markers
  'ab-loop-b',
  'seekable', // false for live streams → OSC shows ● LIVE instead of a seek bar
  'path',
  'chapter',
  'chapter-list',
  'video-params/aspect',
  'track-list',
  'aid',
  'sid',
  'audio-delay',
  'sub-delay',
  'sub-pos',
  'sub-scale',
  'container-fps', // frame rate → timecode / frame-number readout
  'estimated-frame-count',
  // mpv's own integer frame counter. Deriving it from time-pos instead looks
  // cheaper (this ticks every frame) but is wrong: frame-stepping parks the clock
  // exactly on a frame boundary, where floor(time * fps) lands on either side and
  // the number jumps by 2 or sticks. Let mpv count.
  'estimated-frame-number',
  'video-params/gamma', // transfer fn: 'pq'/'hlg' → HDR badge
  'video-params/h', // decoded height → resolution badge (useful for streams)
  'audio-codec-name', // e.g. 'eac3', 'truehd', 'dts' → audio format badge
  'audio-params/channel-count'
] as const

/**
 * Controls an mpv.exe instance: launches it, embeds its video output via --wid,
 * and talks to it over a JSON IPC named pipe.
 */
export class MpvController extends EventEmitter {
  private proc: ChildProcess | null = null
  private socket: net.Socket | null = null
  private readonly pipePath: string
  private buffer = ''
  private reqId = 1
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()
  private connected = false

  constructor(private readonly mpvPath: string) {
    super()
    // Fixed pipe name (not per-pid) so external tools like SVP can find and attach
    // to this mpv over IPC. We use SVP's own default ('mpvpipe') so its mpv target
    // works with zero config. mpv's named pipe accepts multiple clients, so our
    // control connection and SVP coexist. (Trade-off: one instance at a time.)
    this.pipePath = '\\\\.\\pipe\\mpvpipe'
  }

  start(opts: MpvStartOptions = {}): void {
    const args = [
      // isolate from the user's own mpv setup: without this, our bundled mpv reads
      // %APPDATA%/mpv/{mpv.conf,input.conf,scripts} — leaking their personal
      // bindings/profiles/filters into the app. We drive everything via args + IPC,
      // so no external config should ever apply.
      '--no-config',
      '--idle=yes',
      // no --force-window: on the empty state mpv creates no window, so the
      // main window's acrylic (frosted desktop) shows instead of an mpv black box
      '--keep-open=yes',
      '--no-osc',
      '--no-osd-bar',
      '--osc=no',
      // gpu-next (libplacebo) handles Dolby Vision RPU metadata + better HDR
      // tone-mapping; plain --vo=gpu shows DV Profile 5 with a green/washed cast
      '--vo=gpu-next',
      '--hwdec=auto',
      '--input-default-bindings=yes',
      '--input-vo-keyboard=yes',
      `--input-ipc-server=${this.pipePath}`
    ]
    if (opts.wid != null) args.push(`--wid=${opts.wid}`)

    this.proc = spawn(this.mpvPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    this.proc.stderr?.on('data', d => this.emit('log', String(d)))
    this.proc.on('exit', code => {
      this.connected = false
      this.emit('exit', code)
    })
    this.proc.on('error', err => this.emit('error', err))

    this.connectWithRetry()
  }

  private connectWithRetry(attempt = 0): void {
    const sock = net.connect({ path: this.pipePath })
    sock.on('connect', () => {
      this.socket = sock
      this.connected = true
      this.emit('connected')
      for (const p of OBSERVED) {
        this.rawCommand({ command: ['observe_property', 1, p] })
      }
    })
    sock.on('data', d => this.onData(d))
    sock.on('error', () => {
      sock.destroy()
      if (attempt < 100) setTimeout(() => this.connectWithRetry(attempt + 1), 100)
      else this.emit('error', new Error('Could not connect to mpv IPC'))
    })
    sock.on('close', () => {
      if (this.connected) {
        this.connected = false
        this.emit('disconnected')
      }
    })
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8')
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.event === 'property-change') {
        this.emit('property', msg.name, msg.data)
      } else if (msg.event) {
        this.emit('mpv-event', msg.event, msg)
      } else if (msg.request_id != null && this.pending.has(msg.request_id)) {
        const p = this.pending.get(msg.request_id)!
        this.pending.delete(msg.request_id)
        if (msg.error && msg.error !== 'success') p.reject(new Error(msg.error))
        else p.resolve(msg.data)
      }
    }
  }

  private rawCommand(payload: object): void {
    if (!this.socket) return
    this.socket.write(JSON.stringify(payload) + '\n')
  }

  /** Send a command and await its reply. */
  command(command: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('mpv not connected'))
      const request_id = this.reqId++
      this.pending.set(request_id, { resolve, reject })
      this.rawCommand({ command, request_id })
      setTimeout(() => {
        if (this.pending.has(request_id)) {
          this.pending.delete(request_id)
          reject(new Error('mpv command timeout'))
        }
      }, 5000)
    })
  }

  setProperty(name: string, value: any): void {
    this.rawCommand({ command: ['set_property', name, value] })
  }

  loadFile(path: string): void {
    this.rawCommand({ command: ['loadfile', path, 'replace'] })
  }

  quit(): void {
    try {
      this.rawCommand({ command: ['quit'] })
    } catch {}
    this.socket?.destroy()
    this.proc?.kill()
    this.proc = null
    this.socket = null
  }

  get isConnected(): boolean {
    return this.connected
  }
}
