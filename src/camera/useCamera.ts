import { useCallback, useEffect, useRef, useState } from 'react'

export type Facing = 'user' | 'environment'
export type CameraStatus = 'starting' | 'ready' | 'error'

function explain(err: unknown): string {
  const name = (err as DOMException)?.name
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow camera access in your browser settings, then reload.'
    case 'NotFoundError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
      return 'The camera is being used by another app. Close it and try again.'
    case 'OverconstrainedError':
      return 'This camera does not support the requested settings.'
    default:
      return 'Could not start the camera.'
  }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function start() {
      setStatus('starting')
      setError(null)
      stop()

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError('Camera needs HTTPS. Open the site with https://')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        // Component left or camera flipped while waiting
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current!
        video.muted = true // set in code, JSX muted is unreliable in React
        video.srcObject = stream
        await video.play()

        // Wait until a real frame exists (avoids a black first shot)
        if (video.videoWidth === 0) {
          await new Promise<void>((res) =>
            video.addEventListener('loadedmetadata', () => res(), { once: true }),
          )
        }
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(explain(err))
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, stop])

  const flip = useCallback(
    () => setFacing((f) => (f === 'user' ? 'environment' : 'user')),
    [],
  )

  return { videoRef, facing, status, error, flip }
}