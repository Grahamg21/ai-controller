import { useEffect, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { AgentPanel } from './components/AgentPanel'
import { CommandPanel } from './components/CommandPanel'
import { useStatus } from './api/useStatus'

declare global {
  interface Window {
    __phaserEvents?: Phaser.Events.EventEmitter
  }
}

interface SelectedAgent {
  id: string
  name: string
  type: string
  state: string
  current_task: string | null
  highlights: string[]
}

function App() {
  const status = useStatus(30000)
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null)
  const [showCommandPanel, setShowCommandPanel] = useState(false)

  // Push backend data into Phaser whenever it updates
  useEffect(() => {
    if (!status || !window.__phaserEvents) return
    window.__phaserEvents.emit('statusUpdate', status)
  }, [status])

  // Listen for click events emitted by Phaser
  useEffect(() => {
    const onAgentClicked = (data: Omit<SelectedAgent, 'highlights'>) => {
      setShowCommandPanel(false)
      // Merge live highlights from last status poll if available
      const liveAgent = status?.agents.find(a => a.id === data.id)
      setSelectedAgent({ ...data, highlights: liveAgent?.highlights ?? [] })
    }
    const onTrainerClicked = () => {
      setSelectedAgent(null)
      setShowCommandPanel(prev => !prev)
    }

    // Retry until the bridge is available (Phaser initialises asynchronously)
    const attach = () => {
      if (window.__phaserEvents) {
        window.__phaserEvents.on('agentClicked', onAgentClicked)
        window.__phaserEvents.on('trainerClicked', onTrainerClicked)
      } else {
        setTimeout(attach, 200)
      }
    }
    attach()

    return () => {
      window.__phaserEvents?.off('agentClicked', onAgentClicked)
      window.__phaserEvents?.off('trainerClicked', onTrainerClicked)
    }
  }, [])

  // Sync live state + highlights into the selected agent panel if already open
  useEffect(() => {
    if (!selectedAgent || !status) return
    const live = status.agents.find(a => a.id === selectedAgent.id)
    if (!live) return
    if (live.state !== selectedAgent.state || live.highlights !== selectedAgent.highlights) {
      setSelectedAgent(prev => prev ? {
        ...prev,
        state: live.state,
        current_task: live.current_task,
        highlights: live.highlights,
      } : null)
    }
  }, [status])

  return (
    <>
      <GameCanvas />

      {selectedAgent && (
        <AgentPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {showCommandPanel && (
        <CommandPanel
          summary={status?.summary ?? null}
          onClose={() => setShowCommandPanel(false)}
        />
      )}
    </>
  )
}

export default App
