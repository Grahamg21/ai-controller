import { useEffect } from 'react'
import type { DashboardSummary } from '../api/useStatus'

interface CommandPanelProps {
  summary: DashboardSummary | null
  onClose: () => void
}

export function CommandPanel({ summary, onClose }: CommandPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const row = (label: string, value: string, valueColor = '#4dd0e1') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 7, color: '#546e7a' }}>{label}</span>
      <span style={{ fontSize: 7, color: valueColor }}>{value}</span>
    </div>
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 99 }}
      />
      <div style={{
        position: 'fixed',
        top: 60,
        right: 24,
        width: 280,
        background: '#0a1628',
        border: '2px solid #4dd0e1',
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
        padding: '18px 22px',
        zIndex: 100,
        fontFamily: "'Press Start 2P', monospace",
        color: '#e0f7fa',
      }}>
        {/* Title */}
        <div style={{ fontSize: 9, color: '#4dd0e1', marginBottom: 18, letterSpacing: 1 }}>
          SYSTEM STATUS
        </div>

        {/* Summary data */}
        {summary ? (
          <div style={{ borderTop: '1px solid #1a3a4a', paddingTop: 14, marginBottom: 16 }}>
            {row('OPEN TASKS', String(summary.open_tasks))}
            {row('DUE TODAY',  String(summary.tasks_due_today),
              summary.tasks_due_today > 0 ? '#ffe082' : '#4dd0e1')}
            {row('WORKOUT',
              summary.workout_today ? 'DONE' : 'NOT YET',
              summary.workout_today ? '#66bb6a' : '#ff8a65')}
            {row('LAST WORKOUT', summary.last_workout ?? 'N/A')}
            {row('DINNER', summary.dinner_tonight ?? 'not logged')}
          </div>
        ) : (
          <div style={{ fontSize: 7, color: '#546e7a', marginBottom: 16 }}>
            BACKEND OFFLINE
          </div>
        )}

        {/* Menu items */}
        <div style={{ borderTop: '1px solid #1a3a4a', paddingTop: 14 }}>
          <div style={{ fontSize: 7, color: '#546e7a', marginBottom: 10 }}>COMMANDS</div>
          {['VIEW ALL AGENTS', 'ADD NEW AGENT', 'REFRESH DATA'].map(item => (
            <div
              key={item}
              style={{
                fontSize: 7, color: '#e0f7fa', padding: '7px 0',
                borderBottom: '1px solid #111e30', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4dd0e1')}
              onMouseLeave={e => (e.currentTarget.style.color = '#e0f7fa')}
            >
              ▸ {item}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 6, color: '#1a3a4a', marginTop: 14, textAlign: 'right' }}>
          ESC TO CLOSE
        </div>
      </div>
    </>
  )
}
