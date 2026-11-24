// Same idea as CSS object-fit: cover
export function coverCrop(sw: number, sh: number, dw: number, dh: number) {
  const srcRatio = sw / sh
  const dstRatio = dw / dh
  let cw = sw
  let ch = sh
  if (srcRatio > dstRatio) cw = sh * dstRatio
  else ch = sw / dstRatio
  return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch }
}

export const SHOT_W = 1600
export const SHOT_H = 1200 // 4:3

export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  // Use real video size, never the CSS size
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return Promise.reject(new Error('Camera not ready'))

  const canvas = document.createElement('canvas')
  canvas.width = SHOT_W
  canvas.height = SHOT_H
  const ctx = canvas.getContext('2d')!
  const { sx, sy, sw, sh } = coverCrop(vw, vh, SHOT_W, SHOT_H)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SHOT_W, SHOT_H)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Capture failed'))),
      'image/jpeg',
      0.92,
    )
  })
}