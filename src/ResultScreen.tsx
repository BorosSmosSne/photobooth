import { useEffect, useMemo, useRef, useState } from 'react'
import { useBooth } from './store'
import { layouts } from './layouts'
import { themes } from './themes'
import { renderTemplate } from './render/renderTemplate'
import { usePhotos } from './render/usePhotos'
import {
  downloadBlob,
  fileName,
  renderPhotoBlob,
  shareBlob,
} from './export/exportPhoto'
import VideoPanel from './VideoPanel'
import SharePanel from './SharePanel'

// const PREVIEW_W = 800

function todayText() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd}`
}

export default function ResultScreen({ onBack }: { onBack: () => void }) {
  const shots = useBooth((s) => s.shots)
  const layoutId = useBooth((s) => s.layoutId)
  const themeId = useBooth((s) => s.themeId)
  const saveMirrored = useBooth((s) => s.saveMirrored)
  const setLayout = useBooth((s) => s.setLayout)
  const setTheme = useBooth((s) => s.setTheme)
  const setSaveMirrored = useBooth((s) => s.setSaveMirrored)

  const decoded = usePhotos(shots)
  const photos = useMemo(
    () => decoded.map((p) => (p ? { ...p, mirrored: p.mirrored && saveMirrored } : null)),
    [decoded, saveMirrored],
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const date = useMemo(todayText, [])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [exportBlob, setExportBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showVideo, setShowVideo] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const template = layouts.find((l) => l.id === layoutId) ?? layouts[0]
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]

  // Fit the canvas to the free space with the exact layout ratio
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ratio = template.canvas.width / template.canvas.height
    const update = () => {
      const r = el.getBoundingClientRect()
      let w = r.width
      let h = w / ratio
      if (h > r.height) {
        h = r.height
        w = h * ratio
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [template])

  // Live preview
//   useEffect(() => {
//     const canvas = canvasRef.current
//     if (!canvas || photos.length === 0) return
//     const scale = PREVIEW_W / template.canvas.width
//     canvas.width = Math.round(template.canvas.width * scale)
//     canvas.height = Math.round(template.canvas.height * scale)
//     renderTemplate(canvas.getContext('2d')!, template, photos, theme, scale, date)
//   }, [photos, template, theme, date])
// Live preview, drawn at the real display size so it stays sharp
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas || photos.length === 0 || size.w === 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const w = Math.min(Math.round(size.w * dpr), 3000)
  const scale = w / template.canvas.width
  canvas.width = w
  canvas.height = Math.round(template.canvas.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  renderTemplate(ctx, template, photos, theme, scale, date)
}, [photos, template, theme, date, size])

  // Prepare the high-res file in the background
  useEffect(() => {
    if (photos.length === 0) return
    let cancelled = false
    setExportBlob(null)
    setError(null)
    const timer = setTimeout(() => {
      renderPhotoBlob(template, photos, theme, date)
        .then((b) => !cancelled && setExportBlob(b))
        .catch(() => !cancelled && setError('Could not prepare the photo. Try another layout.'))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [photos, template, theme, date])

  const ready = exportBlob !== null

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-100">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
        <button onClick={onBack} className="text-sm font-medium text-pink-600">
          ← Shots
        </button>
        <span className="text-sm text-neutral-500">{template.name}</span>
      </div>

      {/* Live preview */}
      <div className="min-h-0 flex-1 px-4 py-2">
        <div ref={boxRef} className="flex h-full w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-xl"
            style={{ width: size.w, height: size.h }}
          />
        </div>
      </div>

      {/* Layout picker */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2">
        {layouts.map((l) => (
          <button
            key={l.id}
            onClick={() => setLayout(l.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              l.id === template.id
                ? 'bg-pink-500 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Color picker */}
      <div className="flex gap-3 overflow-x-auto px-4 py-2">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            aria-label={t.name}
            className={`h-10 w-10 shrink-0 rounded-full border-2 ${
              t.id === theme.id ? 'border-pink-500 ring-2 ring-pink-300' : 'border-neutral-300'
            }`}
            style={{ background: t.bg }}
          />
        ))}
      </div>

      {/* Mirror toggle */}
      <label className="flex items-center justify-between px-4 py-2 text-sm text-neutral-700">
        <span>Mirror photos (like the preview)</span>
        <input
          type="checkbox"
          checked={saveMirrored}
          onChange={(e) => setSaveMirrored(e.target.checked)}
          className="h-5 w-5 accent-pink-500"
        />
      </label>

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}

      {/* Video + QR buttons */}
      <div className="flex gap-3 px-4 pt-1">
        <button
          onClick={() => setShowVideo(true)}
          className="flex-1 rounded-full border border-neutral-300 bg-white py-3 font-medium text-neutral-800"
        >
          🎬 Make video
        </button>
        <button
          disabled={!ready}
          onClick={() => setShowShare(true)}
          className="flex-1 rounded-full border border-neutral-300 bg-white py-3 font-medium text-neutral-800 disabled:opacity-50"
        >
          📱 Share with QR
        </button>
      </div>

      {/* Save buttons */}
      <div className="flex gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
        <button
          disabled={!ready}
          onClick={() => exportBlob && downloadBlob(exportBlob, fileName())}
          className="flex-1 rounded-full border border-pink-400 bg-white py-3 font-medium text-pink-600 disabled:opacity-50"
        >
          Download
        </button>
        <button
          disabled={!ready}
          onClick={() => exportBlob && shareBlob(exportBlob, fileName())}
          className="flex-[1.4] rounded-full bg-pink-500 py-3 font-medium text-white disabled:opacity-50"
        >
          {ready ? 'Save / Share' : 'Preparing...'}
        </button>
      </div>

      {showVideo && (
        <VideoPanel
          template={template}
          theme={theme}
          date={date}
          shots={shots}
          saveMirrored={saveMirrored}
          onClose={() => setShowVideo(false)}
        />
      )}

      {showShare && exportBlob && (
        <SharePanel
          template={template}
          theme={theme}
          date={date}
          shots={shots}
          saveMirrored={saveMirrored}
          photoBlob={exportBlob}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}