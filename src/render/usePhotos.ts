import { useEffect, useState } from 'react'
import type { Shot } from '../store'
import type { RenderPhoto } from './types'

// Decodes the stored Blobs into ImageBitmaps once, and frees them afterwards
export function usePhotos(shots: (Shot | null)[]) {
  const [photos, setPhotos] = useState<(RenderPhoto | null)[]>([])

  useEffect(() => {
    let cancelled = false
    const made: ImageBitmap[] = []

    Promise.all(
      shots.map(async (s) =>
        s ? { bitmap: await createImageBitmap(s.blob), mirrored: s.mirrored } : null,
      ),
    ).then((result) => {
      result.forEach((p) => p && made.push(p.bitmap))
      if (cancelled) made.forEach((b) => b.close())
      else setPhotos(result)
    })

    return () => {
      cancelled = true
      made.forEach((b) => b.close())
    }
  }, [shots])

  return photos
}