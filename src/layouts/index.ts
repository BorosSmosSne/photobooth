import type { Template } from '../render/types'

// Loads every .json file in this folder, so a new layout = a new file
const files = import.meta.glob('./*.json', { eager: true, import: 'default' })

export const layouts: Template[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, t]) => t as Template)