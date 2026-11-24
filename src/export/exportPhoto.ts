import { renderTemplate } from '../render/renderTemplate'
import type { RenderPhoto, Template, Theme } from '../render/types'

const MAX_PIXELS = 12_000_000 // stays safely under iOS canvas limits

export function exportScale(template: Template) {
  const { width, height } = template.canvas
  return Math.min(3, Math.sqrt(MAX_PIXELS / (width * height)))
}

export function renderPhotoBlob(
  template: Template,
  photos: (RenderPhoto | null)[],
  theme: Theme,
  date: string,
): Promise<Blob> {
  const scale = exportScale(template)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(template.canvas.width * scale)
  canvas.height = Math.round(template.canvas.height * scale)
  const ctx = canvas.getContext('2d')!
  renderTemplate(ctx, template, photos, theme, scale, date)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        // free the big canvas memory right away
        canvas.width = 0
        canvas.height = 0
        b ? resolve(b) : reject(new Error('Export failed'))
      },
      'image/jpeg',
      0.95,
    )
  })
}

export function fileName() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `photobooth-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.jpg`
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Opens the phone share sheet (iPhone: "Save Image"). Falls back to download.
export async function shareBlob(blob: Blob, name: string) {
  // const file = new File([blob], name, { type: 'image/jpeg' })
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return // user closed the sheet
    }
  }
  downloadBlob(blob, name)
}