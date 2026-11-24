import { useBooth, type Shot } from '../store'
import { useObjectUrl } from './useObjectUrl'

function Thumb({
  shot,
  index,
  onRetake,
}: {
  shot: Shot | null
  index: number
  onRetake: () => void
}) {
  const url = useObjectUrl(shot?.blob)
  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-200">
      <div className="aspect-[4/3]">
        {url && (
          <img
            src={url}
            alt={`Shot ${index + 1}`}
            className="h-full w-full object-cover"
            style={{ transform: shot?.mirrored ? 'scaleX(-1)' : undefined }}
          />
        )}
      </div>
      <button
        onClick={onRetake}
        className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
      >
        Retake
      </button>
    </div>
  )
}

interface Props {
  onRetake: (indexes: number[]) => void
  onNext: () => void
}

export default function ReviewScreen({ onRetake, onNext }: Props) {
  const shots = useBooth((s) => s.shots)

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-4 bg-pink-50 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <h2 className="text-xl font-bold text-pink-600">Your 4 shots</h2>

      <div className="grid grid-cols-2 gap-3">
        {shots.map((shot, i) => (
          <Thumb key={i} shot={shot} index={i} onRetake={() => onRetake([i])} />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onRetake([0, 1, 2, 3])}
          className="flex-1 rounded-full border border-pink-400 py-3 font-medium text-pink-600"
        >
          Retake all
        </button>
        <button
  onClick={onNext}
  className="flex-1 rounded-full bg-pink-500 py-3 font-medium text-white"
>
  Choose frame →
</button>
      </div>
    </div>
  )
}