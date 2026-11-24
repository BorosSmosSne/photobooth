import { useEffect, useState } from 'react'
import type { Shot } from './store'
import type { Template, Theme } from './render/types'
import { renderVideoBlob, videoName } from './export/exportVideo'
import { downloadBlob, shareBlob } from './export/exportPhoto'
import { useObjectUrl } from './camera/useObjectUrl'

interface Props {
  template: Template
  theme: Theme
  date: string
  shots: (Shot | null)[]
  saveMirrored: boolean
  onClose: () => void
}

export default function VideoPanel({
  template, theme, date, shots, saveMirrored, onClose,
}: Props) {
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; ext: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const url = useObjectUrl(result?.blob)

  useEffect(() => {
    let cancelled = false
    renderVideoBlob(
      template, shots, theme, date, saveMirrored,
      () => cancelled,
      (p) => !cancelled && setProgress(p),
    )
      .then((r) => !cancelled && setResult(r))
      .catch((e: Error) => {
        if (cancelled || e.message === 'cancelled') return
        setError(
          e.message === 'unsupported'
            ? 'This browser cannot record video. Try Safari (iPhone) or Chrome (Android).'
            : 'Could not make the video. Try again or pick another layout.',
        )
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-full w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-4">
        {error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : !result ? (
          <div className="flex flex-col gap-3 py-8 text-center">
            <p className="font-medium text-neutral-800">Making your video...</p>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-pink-500 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-sm text-neutral-500">
              Keep this screen open for a few seconds.
            </p>
          </div>
        ) : (
          <>
            {url && (
              <video
                src={url}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="max-h-[55vh] w-full rounded-lg bg-black object-contain"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => downloadBlob(result.blob, videoName(result.ext))}
                className="flex-1 rounded-full border border-pink-400 py-3 font-medium text-pink-600"
              >
                Download
              </button>
              <button
                onClick={() => shareBlob(result.blob, videoName(result.ext))}
                className="flex-[1.4] rounded-full bg-pink-500 py-3 font-medium text-white"
              >
                Save / Share
              </button>
            </div>
          </>
        )}
        <button onClick={onClose} className="text-sm text-neutral-500">
          Close
        </button>
      </div>
    </div>
  )
}