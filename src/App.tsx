import { useState } from 'react'
import BoothScreen from './camera/BoothScreen'
import ReviewScreen from './camera/ReviewScreen'
import ResultScreen from './ResultScreen'

export default function App() {
  const [screen, setScreen] = useState<'booth' | 'review' | 'result'>('booth')
  const [targets, setTargets] = useState<number[]>([0, 1, 2, 3])

  if (screen === 'booth') {
    return (
      <BoothScreen
        key={targets.join('-')}
        targets={targets}
        onDone={() => setScreen('review')}
      />
    )
  }

  if (screen === 'result') {
    return <ResultScreen onBack={() => setScreen('review')} />
  }

  return (
    <ReviewScreen
      onNext={() => setScreen('result')}
      onRetake={(indexes) => {
        setTargets(indexes)
        setScreen('booth')
      }}
    />
  )
}