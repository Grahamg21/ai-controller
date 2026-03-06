import { useEffect, useState } from 'react'

export interface AgentStatus {
  id: string
  name: string
  type: string
  state: string
  current_task: string | null
  zone: string
}

export interface DashboardSummary {
  open_tasks: number
  tasks_due_today: number
  workout_today: boolean
  last_workout: string | null
  dinner_tonight: string | null
}

export interface StatusPayload {
  agents: AgentStatus[]
  summary: DashboardSummary
  trainer: { name: string; onboarding_complete: boolean }
}

export function useStatus(intervalMs = 30000): StatusPayload | null {
  const [status, setStatus] = useState<StatusPayload | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('http://localhost:8000/api/status')
        .then(r => r.json())
        .then(setStatus)
        .catch(() => {/* backend not running yet — fail silently */})

    load()
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return status
}
