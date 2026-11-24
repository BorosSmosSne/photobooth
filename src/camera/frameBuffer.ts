import { coverCrop } from './capture'

export const CLIP_FPS = 10
export const CLIP_FRAMES = 25 // 2.5 seconds per shot
const W = 480
const H = 360

// Keeps the most recent small frames of the live camera
export class FrameBuffer {
  private canvas = document.createElement('canvas')
  private frames: Blob[] = []
  private timer: number | null = null
  private busy = false
  private video: HTMLVideoElement

  constructor(video: HTMLVideoElement) {
    this.video = video
    this.canvas.width = W
    this.canvas.height = H
  }

  start() {
    this.stop()
    this.frames = []
    this.timer = window.setInterval(() => this.grab(), 1000 / CLIP_FPS)
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  private grab() {
    const v = this.video
    if (this.busy || !v.videoWidth) return
    this.busy = true
    const ctx = this.canvas.getContext('2d')!
    const c = coverCrop(v.videoWidth, v.videoHeight, W, H)
    ctx.drawImage(v, c.sx, c.sy, c.sw, c.sh, 0, 0, W, H)
    this.canvas.toBlob(
      (b) => {
        if (b) {
          this.frames.push(b)
          if (this.frames.length > CLIP_FRAMES) this.frames.shift()
        }
        this.busy = false
      },
      'image/jpeg',
      0.7,
    )
  }

  snapshot() {
    return [...this.frames]
  }
}