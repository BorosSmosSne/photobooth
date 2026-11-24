import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Shot } from './store'
import type { Template, Theme } from './render/types'
import { pickVideoType, renderVideoBlob } from './export/exportVideo'
import { uploadShare } from './share/uploadShare'

interface Props {
  template: Template
  theme: Theme
  date: string
  shots: (Shot | null)[]
  saveMirrored: boolean
  photoBlob: Blob
  onClose: () => void
}

type Phase = 'options' | 'working' | 'done' | 'error'

const host = window.location.hostname
const isLocal =
  host === 'localhost' ||
  /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)

export default function SharePanel({
  template, theme, date, shots, saveMirrored, photoBlob, onClose,
}: Props) {
  const canVideo = pickVideoType() !== null
  const [hours, setHours] = useState<48 | 72>(48)
  const [withVideo, setWithVideo] = useState(canVideo)
  const [phase, setPhase] = useState<Phase>('options')
  const [label, setLabel] = useState('')
  const [progress, setProgress] = useState(0)
  const [skippedVideo, setSkippedVideo] = useState(false)
  const [result, setResult] = useState<{ url: string; expiresAt: number; qr: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  async function create() {
    setPhase('working')
    setError(null)
    setProgress(0)
    setSkippedVideo(false)
    try {
      let video: { blob: Blob; ext: string } | null = null
      if (withVideo && canVideo) {
        setLabel('Making video...')
        try {
          video = await renderVideoBlob(
            template, shots, theme, date, saveMirrored,
            () => cancelled.current,
            setProgress,
          )
        } catch (e) {
          if ((e as Error).message === 'cancelled') return
          setSkippedVideo(true) // continue with the photo only
        }
      }

      setLabel('Uploading...')
      setProgress(1)
      const { id, expiresAt } = await uploadShare(photoBlob, video, hours)
      if (cancelled.current) return

      const url = `${window.location.origin}/s/${id}`
      const qr = await QRCode.toDataURL(url, { width: 640, margin: 2 })
      if (cancelled.current) return
      setResult({ url, expiresAt, qr })
      setPhase('done')
    } catch (e) {
      if (cancelled.current) return
      setError((e as Error).message || 'Something went wrong.')
      setPhase('error')
    }
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-5">
        {phase === 'options' && (
          <>
            <h2 className="text-lg font-bold text-neutral-900">Share with QR</h2>
            <p className="text-sm text-neutral-600">
              Your friends scan the code to download the photo and video. Files are deleted
              automatically when the time ends.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {([48, 72] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`rounded-full py-3 font-medium ${
                    hours === h
                      ? 'bg-pink-500 text-white'
                      : 'border border-neutral-300 text-neutral-700'
                  }`}
                >
                  {h} hours
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between text-sm text-neutral-700">
              <span>{canVideo ? 'Include video' : 'Video not supported here'}</span>
              <input
                type="checkbox"
                disabled={!canVideo}
                checked={withVideo}
                onChange={(e) => setWithVideo(e.target.checked)}
                className="h-5 w-5 accent-pink-500"
              />
            </label>

            {isLocal && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                You are on a test address. Friends cannot open QR codes from here. Open the
                deployed site (https://...workers.dev) to share.
              </p>
            )}

            <button
              onClick={create}
              disabled={isLocal}
              className="rounded-full bg-pink-500 py-3 font-medium text-white disabled:opacity-40"
            >
              Create QR code
            </button>
          </>
        )}

        {phase === 'working' && (
          <div className="flex flex-col gap-3 py-8 text-center">
            <p className="font-medium text-neutral-800">{label}</p>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-pink-500 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-sm text-neutral-500">Keep this screen open.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <>
            <h2 className="text-center text-lg font-bold text-neutral-900">Scan to download</h2>
            <img src={result.qr} alt="QR code" className="mx-auto w-full max-w-64 rounded-lg" />
            <p className="text-center text-sm text-neutral-600">
              Expires {new Date(result.expiresAt).toLocaleString()}
            </p>
            {skippedVideo && (
              <p className="text-center text-sm text-amber-700">
                The video could not be made, so only the photo is shared.
              </p>
            )}
            <button
              onClick={copy}
              className="rounded-full border border-pink-400 py-3 font-medium text-pink-600"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="text-center text-red-600">{error}</p>
            <button
              onClick={() => setPhase('options')}
              className="rounded-full bg-pink-500 py-3 font-medium text-white"
            >
              Try again
            </button>
          </>
        )}

        <button onClick={onClose} className="text-sm text-neutral-500">
          Close
        </button>
      </div>
    </div>
  )
}