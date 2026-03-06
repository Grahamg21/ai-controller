import { useEffect } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { useStatus } from './api/useStatus'

// Extend window so TypeScript knows about the Phaser event bridge
declare global {
  interface Window {
    __phaserEvents?: Phaser.Events.EventEmitter
  }
}

function App() {
  const status = useStatus(30000)

  // Whenever the backend sends new data, push it into Phaser via the event bridge
  useEffect(() => {
    if (!status || !window.__phaserEvents) return
    window.__phaserEvents.emit('statusUpdate', status)
  }, [status])

  return <GameCanvas />
}

export default App
