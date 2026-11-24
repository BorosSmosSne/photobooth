export interface Theme {
  id: string
  name: string
  bg: string
  text: string
  mat: string // polaroid / card color
  accent: string
}

export interface Slot {
  x: number
  y: number
  w: number
  h: number
  radius?: number
  photo?: number // which shot (0-3). Defaults to the slot's index
}

export type Layer = 'under' | 'over' // under = behind photos, over = on top

export interface TextEl {
  type: 'text'
  layer: Layer
  content: string // supports {date}
  x: number
  y: number
  size: number
  align?: 'left' | 'center' | 'right'
  color: string // 'bg' | 'text' | 'mat' | 'accent' | '#hex'
  weight?: 'normal' | 'bold'
}

export interface RectEl {
  type: 'rect'
  layer: Layer
  x: number
  y: number
  w: number
  h: number
  radius?: number
  fill: string
}

export type Element = TextEl | RectEl

export interface Template {
  version: 1
  id: string
  name: string
  canvas: { width: number; height: number }
  slots: Slot[]
  elements: Element[]
}

export interface RenderPhoto {
  bitmap: ImageBitmap
  mirrored: boolean
}