import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { MainScene } from '../game/MainScene'

// GameCanvas mounts a Phaser game inside a React component.
// React handles the UI shell; Phaser handles everything drawn on the canvas.
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    // Don't create the game twice (React StrictMode runs effects twice in dev)
    if (!containerRef.current || gameRef.current) return

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,        // auto-picks WebGL if available, falls back to Canvas
      width: 1280,
      height: 720,
      parent: containerRef.current,
      backgroundColor: '#0a0e1a',
      scene: [MainScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    })

    // Cleanup when the component unmounts
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '1280px', height: '720px', maxWidth: '100vw', maxHeight: '100vh' }}
    />
  )
}
