import { useEffect, useRef, useState } from 'react'
import { useCamera } from './useCamera'
import { captureFrame } from './capture'
import { FrameBuffer } from './frameBuffer'
import { useBooth, SHOT_COUNT } from '../store'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Props {
  targets: number[] // which shot slots to take (all 4, or one for retake)
  onDone: () => void
}

export default function BoothScreen({ targets, onDone }: Props) {
  const { videoRef, facing, status, error, flip } = useCamera()
  const setShot = useBooth((s) => s.setShot)

  const [running, setRunning] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [flash, setFlash] = useState(false)
  const runId = useRef(0)
  const buffer = useRef<FrameBuffer | null>(null)

  // Cancel any running sequence if the screen closes
  useEffect(() => {
    return () => {
      runId.current++
      buffer.current?.stop()
    }
  }, [])

  const mirrored = facing === 'user'

  async function start() {
    const video = videoRef.current
    if (!video || status !== 'ready') return
    const token = ++runId.current
    if (!buffer.current) buffer.current = new FrameBuffer(video)
    const buf = buffer.current
    setRunning(true)

    for (let n = 0; n < targets.length; n++) {
      setStep(n)
      buf.start()
      for (let c = 3; c >= 1; c--) {
        setCount(c)
        await sleep(1000)
        if (token !== runId.current) return
      }
      setCount(null)
      setFlash(true)
      const clip = buf.snapshot()
      buf.stop()
      try {
        const blob = await captureFrame(video)
        setShot(targets[n], { blob, mirrored, clip })
      } catch {
        setRunning(false)
        return
      }
      if (token !== runId.current) return
      setTimeout(() => setFlash(false), 120)
      await sleep(900)
      if (token !== runId.current) return
    }

    setRunning(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <span className="text-sm opacity-80">
          {running ? `Shot ${step + 1} / ${targets.length}` : 'Get ready'}
        </span>
        <button
          onClick={flip}
          disabled={running}
          className="rounded-full bg-white/15 px-4 py-2 text-sm disabled:opacity-40"
        >
          🔄 Flip
        </button>
      </div>

      {/* Preview (4:3, same crop as the saved shot) */}
      <div className="flex flex-1 items-center justify-center px-2">
        <div className="relative aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-2xl bg-neutral-900">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="h-full w-full object-cover"
            style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
          />

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              Starting camera...
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
              {error}
            </div>
          )}

          {count !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-9xl font-bold drop-shadow-lg">{count}</span>
            </div>
          )}

          <div
            className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
              flash ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-3">
        {Array.from({ length: SHOT_COUNT }).map((_, i) => {
          const active = targets.includes(i)
          const done = running && targets.indexOf(i) < step
          return (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                done ? 'bg-pink-400' : active ? 'bg-white/70' : 'bg-white/20'
              }`}
            />
          )
        })}
      </div>

      {/* Start button */}
      <div className="flex justify-center pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <button
          onClick={start}
          disabled={running || status !== 'ready'}
          className="h-20 w-20 rounded-full border-4 border-white bg-pink-500 text-sm font-semibold shadow-lg active:scale-95 disabled:opacity-40"
        >
          {running ? '...' : 'Start'}
        </button>
      </div>
    </div>
  )
}