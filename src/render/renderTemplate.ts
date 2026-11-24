import { coverCrop } from '../camera/capture'
import type { Element, RenderPhoto, Template, Theme } from './types'

const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`

function color(ref: string, theme: Theme) {
  switch (ref) {
    case 'bg': return theme.bg
    case 'text': return theme.text
    case 'mat': return theme.mat
    case 'accent': return theme.accent
    default: return ref
  }
}

// Rounded rectangle path (works on every browser)
function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  theme: Theme,
  date: string,
) {
  if (el.type === 'rect') {
    ctx.fillStyle = color(el.fill, theme)
    roundedPath(ctx, el.x, el.y, el.w, el.h, el.radius ?? 0)
    ctx.fill()
  } else {
    ctx.fillStyle = color(el.color, theme)
    ctx.font = `${el.weight ?? 'normal'} ${el.size}px ${FONT}`
    ctx.textAlign = el.align ?? 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.content.replace('{date}', date), el.x, el.y)
  }
}

/**
 * The ONE draw function. Used for preview now, and for photo/video export later.
 * Template coordinates are logical units; `scale` converts them to real pixels.
 */
export function renderTemplate(
  ctx: CanvasRenderingContext2D,
  template: Template,
  photos: (RenderPhoto | null)[],
  theme: Theme,
  scale: number,
  date: string,
) {
  const { width, height } = template.canvas
  ctx.save()
  ctx.scale(scale, scale)

  // 1. background
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, width, height)

  // 2. elements behind the photos
  template.elements
    .filter((e) => e.layer === 'under')
    .forEach((e) => drawElement(ctx, e, theme, date))

  // 3. photo slots
  template.slots.forEach((slot, i) => {
    const photo = photos[slot.photo ?? i]
    ctx.save()
    roundedPath(ctx, slot.x, slot.y, slot.w, slot.h, slot.radius ?? 0)
    ctx.clip()

    if (photo) {
      // Mirror only this photo, around the slot's own center
      if (photo.mirrored) {
        ctx.translate(slot.x * 2 + slot.w, 0)
        ctx.scale(-1, 1)
      }
      const { bitmap } = photo
      const c = coverCrop(bitmap.width, bitmap.height, slot.w, slot.h)
      ctx.drawImage(bitmap, c.sx, c.sy, c.sw, c.sh, slot.x, slot.y, slot.w, slot.h)
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h)
    }
    ctx.restore()
  })

  // 4. elements on top
  template.elements
    .filter((e) => e.layer === 'over')
    .forEach((e) => drawElement(ctx, e, theme, date))

  ctx.restore()
}