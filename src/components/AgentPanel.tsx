import { useEffect } from 'react'

interface AgentPanelProps {
  agent: {
    id: string
    name: string
    type: string
    state: string
    current_task: string | null
  }
  onClose: () => void
}

const STATE_LABELS: Record<string, string> = {
  idle:          'Resting on beach',
  researching:   'Researching in grass zone',
  communicating: 'Communicating at water',
  computing:     'Processing in lava zone',
  thinking:      'Planning at HQ computer',
  done:          'Task complete',
  error:         'Error — returning to base',
  walking:       'Walking to zone',
}

const TYPE_COLORS: Record<string, string> = {
  Psychic: '#ce93d8',
  Fire:    '#ff8a65',
  Water:   '#42a5f5',
  Grass:   '#66bb6a',
  Electric:'#ffca28',
  Ice:     '#80deea',
  Dragon:  '#7986cb',
  Dark:    '#90a4ae',
  Normal:  '#bcaaa4',
}

export function AgentPanel({ agent, onClose }: AgentPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const typeColor = TYPE_COLORS[agent.type] ?? '#e0f7fa'
  const stateLabel = STATE_LABELS[agent.state] ?? agent.state

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'transparent',
          zIndex: 99,
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        background: '#0a1628',
        border: '2px solid #4dd0e1',
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
        padding: '20px 28px',
        zIndex: 100,
        fontFamily: "'Press Start 2P', monospace",
        color: '#e0f7fa',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: typeColor, marginBottom: 6 }}>{agent.name}</div>
            <div style={{ fontSize: 8, color: '#546e7a' }}>TYPE: {agent.type.toUpperCase()}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #4dd0e1',
              color: '#4dd0e1', fontFamily: 'inherit', fontSize: 8,
              padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Status */}
        <div style={{ borderTop: '1px solid #1a3a4a', paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 7, color: '#546e7a', marginBottom: 6 }}>STATUS</div>
          <div style={{ fontSize: 8, color: agent.state === 'error' ? '#ef5350' : '#4dd0e1' }}>
            {stateLabel.toUpperCase()}
          </div>
        </div>

        {/* Current task */}
        <div style={{ borderTop: '1px solid #1a3a4a', paddingTop: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 7, color: '#546e7a', marginBottom: 6 }}>CURRENT TASK</div>
          <div style={{ fontSize: 8, color: '#e0f7fa', lineHeight: 1.8 }}>
            {agent.current_task ?? '[ none ]'}
          </div>
        </div>

        {/* Hint */}
        <div style={{ fontSize: 6, color: '#1a3a4a', textAlign: 'right' }}>
          PRESS ESC OR CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </>
  )
}
