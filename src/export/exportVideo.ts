import { renderTemplate } from '../render/renderTemplate'
import type { RenderPhoto, Template, Theme } from '../render/types'
import type { Shot } from '../store'
import { CLIP_FPS } from '../camera/frameBuffer'

const MAX_SIDE = 1280 // longest side of the video in pixels
const LOOPS = 2

// MP4 first (plays everywhere, iPhone can save it), WebM as fallback
const TYPES: [string, string][] = [
  ['video/mp4;codecs=avc1.42E01E', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm;codecs=vp8', 'webm'],
  ['video/webm', 'webm'],
]

export function pickVideoType() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const [mime, ext] of TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  }
  return null
}

export function videoName(ext: string) {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `photobooth-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`
}

async function decodeClip(shot: Shot): Promise<ImageBitmap[]> {
  const blobs = shot.clip.length ? shot.clip : [shot.blob]
  return Promise.all(blobs.map((b) => createImageBitmap(b)))
}

export async function renderVideoBlob(
  template: Template,
  shots: (Shot | null)[],
  theme: Theme,
  date: string,
  saveMirrored: boolean,
  isCancelled: () => boolean,
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const type = pickVideoType()
  const canvas = document.createElement('canvas')
  if (!type || typeof canvas.captureStream !== 'function') {
    throw new Error('unsupported')
  }

  const clips: ImageBitmap[][] = []
  let rec: MediaRecorder | null = null
  let stream: MediaStream | null = null

  try {
    for (const s of shots) clips.push(s ? await decodeClip(s) : [])
    if (isCancelled()) throw new Error('cancelled')

    // Video sizes must be even numbers for H.264
    const { width, height } = template.canvas
    const base = MAX_SIDE / Math.max(width, height)
    canvas.width = Math.round((width * base) / 2) * 2
    canvas.height = Math.round((height * base) / 2) * 2
    const scale = canvas.width / width
    const ctx = canvas.getContext('2d')!

    const frameCount = Math.max(1, ...clips.map((c) => c.length))
    const totalFrames = frameCount * LOOPS
    const durationMs = (totalFrames / CLIP_FPS) * 1000

    const draw = (frame: number) => {
      const i = frame % frameCount
      const photos: (RenderPhoto | null)[] = clips.map((c, n) =>
        c.length
          ? {
              bitmap: c[Math.min(i, c.length - 1)],
              mirrored: !!shots[n]?.mirrored && saveMirrored,
            }
          : null,
      )
      renderTemplate(ctx, template, photos, theme, scale, date)
    }

    stream = canvas.captureStream(30)
    rec = new MediaRecorder(stream, {
      mimeType: type.mime,
      videoBitsPerSecond: 5_000_000,
    })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    const stopped = new Promise<void>((resolve, reject) => {
      rec!.onstop = () => resolve()
      rec!.onerror = () => reject(new Error('recorder'))
    })

    draw(0)
    rec.start(200)
    const t0 = performance.now()

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (isCancelled()) return reject(new Error('cancelled'))
        const elapsed = performance.now() - t0
        if (elapsed >= durationMs) return resolve()
        draw(Math.floor((elapsed / 1000) * CLIP_FPS))
        onProgress(elapsed / durationMs)
        requestAnimationFrame(tick)
      }
      tick()
    })

    draw(totalFrames - 1)
    await new Promise((r) => setTimeout(r, 150)) // let the last frame be captured
    rec.stop()
    await stopped

    const blob = new Blob(chunks, { type: type.mime.split(';')[0] })
    if (blob.size === 0) throw new Error('empty')
    return { blob, ext: type.ext }
  } finally {
    if (rec && rec.state !== 'inactive') rec.stop()
    stream?.getTracks().forEach((t) => t.stop())
    clips.forEach((c) => c.forEach((b) => b.close()))
    canvas.width = 0
    canvas.height = 0
  }
}