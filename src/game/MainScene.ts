import Phaser from 'phaser'

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 1280
const H = 720

const ZONE = {
  topEnd:     270,   // water / grass ends
  lavaStart:  285,
  lavaEnd:    430,
  beachStart: 440,   // tall beach — takes up most of the lower half
}

// HQ sits halfway between the top of the map and the beach
const HQ = {
  cx: 640,
  cy: 220,   // halfway between y=0 and beachStart=440
  rx: 210,
  ry: 100,
}

// Angles (degrees) at which computers are placed around the outside of the HQ ellipse
const COMP_ANGLES = [-150, -120, -90, -60, -30]
// How far outside the ellipse wall the computer centre sits
const COMP_OFFSET = 24

// Zone destination hotspots per state
const ZONE_SPOTS = {
  beach: [
    { x: 180, y: 560 }, { x: 380, y: 590 }, { x: 580, y: 565 },
    { x: 780, y: 580 }, { x: 1050, y: 555 }, { x: 640, y: 620 },
  ],
  grass: [
    { x: 870, y: 80 }, { x: 1020, y: 140 }, { x: 820, y: 200 },
    { x: 1140, y: 95 }, { x: 960, y: 230 }, { x: 1200, y: 200 },
  ],
  water: [
    { x: 110, y: 75 }, { x: 240, y: 145 }, { x: 380, y: 95 },
    { x: 160, y: 215 }, { x: 320, y: 235 }, { x: 480, y: 200 },
  ],
  lava: [
    { x: 160, y: 355 }, { x: 430, y: 370 }, { x: 640, y: 357 },
    { x: 860, y: 370 }, { x: 1100, y: 355 },
  ],
}

const STATE_ZONE: Record<string, keyof typeof ZONE_SPOTS> = {
  idle:          'beach',
  done:          'beach',
  error:         'beach',
  researching:   'grass',
  communicating: 'water',
  computing:     'lava',
  thinking:      'beach', // HQ handled separately
  walking:       'beach',
}

const TOWELS    = [100, 270, 460, 640, 820, 1050]
const UMBRELLAS = [55, 390, 760, 1195]

const C = {
  water:        0x1565c0,
  waterLight:   0x1976d2,
  waterShimmer: 0x42a5f5,
  grass:        0x2e7d32,
  grassLight:   0x4caf50,
  lava:         0x7f0000,
  lavaMid:      0xb71c1c,
  lavaGlow:     0xff5722,
  lavaCrack:    0xff9800,
  beach:        0xf0b429,
  beachDark:    0xe09820,
  beachLight:   0xffd060,
  screen:       0x00e5ff,
  screenDark:   0x003322,
}

const FONT = "'Press Start 2P', monospace"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hWave(
  x0: number, x1: number, baseY: number,
  amp: number, n = 80, seed = 0,
): { x: number; y: number }[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const x = x0 + (x1 - x0) * t
    const y = baseY
      + Math.sin(t * 3.7 * Math.PI + seed)       * amp * 0.50
      + Math.sin(t * 7.1 * Math.PI + seed * 2.3)  * amp * 0.30
      + Math.sin(t * 1.9 * Math.PI + seed * 0.7)  * amp * 0.20
    return { x, y }
  })
}

function vWave(
  baseX: number, y0: number, y1: number,
  amp: number, n = 80, seed = 0,
): { x: number; y: number }[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const y = y0 + (y1 - y0) * t
    const x = baseX
      + Math.sin(t * 3.7 * Math.PI + seed)       * amp * 0.50
      + Math.sin(t * 7.1 * Math.PI + seed * 2.3)  * amp * 0.30
      + Math.sin(t * 1.9 * Math.PI + seed * 0.7)  * amp * 0.20
    return { x, y }
  })
}

// Simple seeded "random" — same seed always gives same value (no actual RNG needed)
function seededVal(x: number, y: number, scale = 1): number {
  return (Math.sin(x * 127.1 + y * 311.7) * 0.5 + 0.5) * scale
}

// ─── Scene ───────────────────────────────────────────────────────────────────
export class MainScene extends Phaser.Scene {
  private sageContainer!:    Phaser.GameObjects.Container
  private sageSprite!:       Phaser.GameObjects.Container
  private sageNameTag!:      Phaser.GameObjects.Text
  private sageBobGraphics!:  Phaser.GameObjects.Graphics
  private sageBobTween!:     Phaser.Tweens.Tween
  private sageState:         string = 'idle'
  private sageWanderEvent:   Phaser.Time.TimerEvent | null = null
  private sageMoveTween:     Phaser.Tweens.Tween | null = null
  private sageWorkingCleanup: (() => void)[] = []
  private lavaEmitter!:      Phaser.GameObjects.Particles.ParticleEmitter
  private waterEmitter!:     Phaser.GameObjects.Particles.ParticleEmitter
  private trainerContainer!: Phaser.GameObjects.Container
  private trainerSprite!:    Phaser.GameObjects.Container

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    this.buildTextures()
    this.drawZones()
    this.drawZoneBorders()
    this.drawLavaBridges()
    this.drawBuilding()
    this.drawLabEquipment()
    this.drawComputers()
    this.drawBeachDecor()
    this.animateWater()
    this.animateLava()
    this.drawZoneGlow()
    this.drawLabels()
    this.spawnTrainer()
    this.spawnSage()
    this.drawVignette()

    // Listen for live status data pushed from React via the event bridge
    this.game.events.on('statusUpdate', (status: any) => this.handleStatusUpdate(status))
  }

  // ── Particle textures ─────────────────────────────────────────────────────────
  private buildTextures() {
    if (!this.textures.exists('ember')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff); g.fillCircle(4, 4, 4)
      g.generateTexture('ember', 8, 8); g.destroy()
    }
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff); g.fillCircle(3, 3, 3)
      g.generateTexture('spark', 6, 6); g.destroy()
    }
  }

  // ── Organic zone fills ────────────────────────────────────────────────────────
  private drawZones() {
    const g = this.add.graphics()

    // ── Water zone ──────────────────────────────────────────────────────────
    const div = vWave(615, 0, ZONE.topEnd, 50, 80, 1.2)

    g.fillStyle(C.waterLight)
    g.fillPoints([{ x: 0, y: 0 }, ...div, { x: 0, y: ZONE.topEnd }], true)

    // Organic depth blobs instead of stripes
    for (let i = 0; i < 60; i++) {
      const bx = seededVal(i, 0) * 560 + 15
      const by = seededVal(i, 1) * (ZONE.topEnd - 20) + 10
      const br = seededVal(i, 2) * 22 + 8
      g.fillStyle(C.waterShimmer, seededVal(i, 3) * 0.18 + 0.04)
      g.fillEllipse(bx, by, br * 2.2, br * 1.1)
    }

    // ── Grass zone ───────────────────────────────────────────────────────────
    g.fillStyle(C.grass)
    g.fillPoints([...div, { x: W, y: ZONE.topEnd }, { x: W, y: 0 }], true)

    // Organic grass texture — layered blobs of greens (no triangles)
    // Dark base blobs
    for (let i = 0; i < 60; i++) {
      const bx = seededVal(i, 10) * 600 + 650
      const by = seededVal(i, 11) * (ZONE.topEnd - 16) + 8
      const br = seededVal(i, 12) * 20 + 10
      g.fillStyle(0x1b5e20, seededVal(i, 14) * 0.28 + 0.10)
      g.fillEllipse(bx, by, br * 2.4, br * 1.4)
    }
    // Mid green blobs
    for (let i = 0; i < 70; i++) {
      const bx = seededVal(i + 100, 10) * 610 + 645
      const by = seededVal(i + 100, 11) * (ZONE.topEnd - 14) + 7
      const br = seededVal(i + 100, 12) * 13 + 6
      g.fillStyle(C.grassLight, seededVal(i + 100, 14) * 0.22 + 0.07)
      g.fillEllipse(bx, by, br * 2.0, br * 1.5)
    }
    // Bright highlight dots
    for (let i = 0; i < 45; i++) {
      const bx = seededVal(i + 200, 10) * 590 + 655
      const by = seededVal(i + 200, 11) * (ZONE.topEnd - 24) + 12
      const br = seededVal(i + 200, 12) * 5 + 2
      g.fillStyle(0xa5d6a7, seededVal(i + 200, 14) * 0.18 + 0.05)
      g.fillCircle(bx, by, br)
    }
    // Tiny wildflowers — pink and yellow specks
    for (let i = 0; i < 35; i++) {
      const fx = seededVal(i + 300, 10) * 570 + 660
      const fy = seededVal(i + 300, 11) * (ZONE.topEnd - 20) + 10
      const fc = seededVal(i + 300, 15) > 0.5 ? 0xf8bbd0 : 0xfff9c4
      g.fillStyle(fc, seededVal(i + 300, 14) * 0.55 + 0.3)
      g.fillCircle(fx, fy, seededVal(i + 300, 12) * 2.5 + 1.5)
    }
    // Pebbles — small dark ellipses
    for (let i = 0; i < 28; i++) {
      const px = seededVal(i + 400, 10) * 560 + 665
      const py = seededVal(i + 400, 11) * (ZONE.topEnd - 18) + 9
      g.fillStyle(0x37474f, seededVal(i + 400, 14) * 0.25 + 0.10)
      g.fillEllipse(px, py, seededVal(i + 400, 12) * 8 + 3, seededVal(i + 400, 13) * 4 + 2)
    }

    // ── Lava zone ────────────────────────────────────────────────────────────
    const lavaTop    = hWave(0, W, ZONE.lavaStart, 20, 90, 0.5)
    const lavaBottom = hWave(0, W, ZONE.lavaEnd,   16, 90, 1.8)

    g.fillStyle(C.lava)
    g.fillPoints([...lavaTop, ...[...lavaBottom].reverse()], true)

    // Organic lava pools — ellipses not rectangles
    for (let i = 0; i < 28; i++) {
      const px = seededVal(i, 20) * (W - 60) + 30
      const py = ZONE.lavaStart + seededVal(i, 21) * (ZONE.lavaEnd - ZONE.lavaStart - 20) + 10
      const prx = seededVal(i, 22) * 40 + 14
      const pry = seededVal(i, 23) * 16 + 6
      g.fillStyle(C.lavaMid, seededVal(i, 24) * 0.55 + 0.35)
      g.fillEllipse(px, py, prx * 2, pry * 2)
    }
    // Bright lava veins — thin organic blobs
    for (let i = 0; i < 14; i++) {
      const vx = seededVal(i, 30) * (W - 40) + 20
      const vy = ZONE.lavaStart + seededVal(i, 31) * (ZONE.lavaEnd - ZONE.lavaStart - 10) + 5
      const vrx = seededVal(i, 32) * 18 + 4
      const vry = seededVal(i, 33) * 6 + 2
      g.fillStyle(C.lavaGlow, seededVal(i, 34) * 0.4 + 0.25)
      g.fillEllipse(vx, vy, vrx * 2, vry * 2)
    }

    // ── Beach — tall, takes up most of the lower map ─────────────────────────
    const shoreline = hWave(0, W, ZONE.beachStart, 16, 90, 0.8)

    g.fillStyle(C.beach)
    g.fillPoints([...shoreline, { x: W, y: H }, { x: 0, y: H }], true)

    // Wet sand near shore (slightly darker strip)
    g.fillStyle(C.beachDark, 0.35)
    g.fillRect(0, H - 60, W, 40)

    // Organic sand texture — varied circles instead of a grid
    for (let i = 0; i < 200; i++) {
      const sx = seededVal(i, 40) * W
      const sy = ZONE.beachStart + 20 + seededVal(i, 41) * (H - ZONE.beachStart - 30)
      const sr = seededVal(i, 42) * 3.5 + 1
      const alpha = seededVal(i, 43) * 0.18 + 0.06
      g.fillStyle(C.beachDark, alpha)
      g.fillCircle(sx, sy, sr)
    }
    // Scattered lighter sand highlights
    for (let i = 0; i < 80; i++) {
      const sx = seededVal(i + 200, 40) * W
      const sy = ZONE.beachStart + 30 + seededVal(i + 200, 41) * (H - ZONE.beachStart - 50)
      const sr = seededVal(i + 200, 42) * 2.5 + 1
      g.fillStyle(C.beachLight, seededVal(i + 200, 43) * 0.14 + 0.04)
      g.fillCircle(sx, sy, sr)
    }

    // Shore water
    g.fillStyle(C.waterLight, 0.58);    g.fillRect(0, H - 22, W, 22)
    g.fillStyle(C.waterShimmer, 0.30);  g.fillRect(0, H - 22, W, 10)

    // Zone boundary blending
    g.fillGradientStyle(0x4a3728, 0x4a3728, 0x1565c0, 0x2e7d32, 0.52, 0.52, 0, 0)
    g.fillRect(0, ZONE.topEnd - 20, W, 30)
    g.fillGradientStyle(0x4a3728, 0x4a3728, 0x7f0000, 0x7f0000, 0.42, 0.42, 0, 0)
    g.fillRect(0, ZONE.lavaStart - 20, W, 34)
    g.fillGradientStyle(0x7f0000, 0x7f0000, 0xf0b429, 0xf0b429, 0, 0, 0.38, 0.38)
    g.fillRect(0, ZONE.lavaEnd - 14, W, 55)
  }

  // ── Round HQ building ─────────────────────────────────────────────────────────
  private drawBuilding() {
    const g = this.add.graphics()
    g.setDepth(3)

    const { cx, cy, rx, ry } = HQ
    const floorRx = rx - 16
    const floorRy = ry - 16

    // Drop shadow
    g.fillStyle(0x000000, 0.5)
    g.fillEllipse(cx + 10, cy + 14, (rx + 12) * 2, (ry + 10) * 2)

    // Outer wall layers (dark tech-stone)
    g.fillStyle(0x1a2b36); g.fillEllipse(cx, cy, rx * 2, ry * 2)
    g.fillStyle(0x243b4a); g.fillEllipse(cx, cy, (rx - 5)  * 2, (ry - 5)  * 2)
    g.fillStyle(0x30505f, 0.55); g.fillEllipse(cx, cy, (rx - 11) * 2, (ry - 11) * 2)

    // Interior floor
    g.fillStyle(0x060c13); g.fillEllipse(cx, cy, floorRx * 2, floorRy * 2)

    // Floor grid — thin lines clipped to the ellipse
    g.fillStyle(0x182840, 0.55)
    for (let gx = cx - floorRx + 24; gx < cx + floorRx - 14; gx += 42) {
      const dx = gx - cx
      const maxH = floorRy * Math.sqrt(Math.max(0, 1 - (dx / floorRx) ** 2))
      g.fillRect(gx, cy - maxH, 1, maxH * 2)
    }
    for (let gy = cy - floorRy + 18; gy < cy + floorRy - 12; gy += 36) {
      const dy = gy - cy
      const maxW = floorRx * Math.sqrt(Math.max(0, 1 - (dy / floorRy) ** 2))
      g.fillRect(cx - maxW, gy, maxW * 2, 1)
    }

    // South entrance — cut a door gap in the wall
    const doorW = 58
    const doorTop = cy + ry - 26
    g.fillStyle(C.beach); g.fillRect(cx - doorW / 2, doorTop, doorW, 30)
    g.fillStyle(0x060c13); g.fillRect(cx - doorW / 2 + 5, doorTop - 5, doorW - 10, 22)

    // Door frame posts
    g.fillStyle(0x4dd0e1, 0.9)
    g.fillRect(cx - doorW / 2 - 3, doorTop - 10, 5, 28)
    g.fillRect(cx + doorW / 2 - 2, doorTop - 10, 5, 28)

    // Tech accent lights on wall
    const accentAngles = [-90, -35, 215]
    accentAngles.forEach((deg, i) => {
      const rad = Phaser.Math.DegToRad(deg)
      const ax = cx + (rx - 9) * Math.cos(rad)
      const ay = cy + (ry - 7) * Math.sin(rad)
      const lt = this.add.arc(ax, ay, 5, 0, 360, false, 0x00e5ff, 0.4)
      lt.setBlendMode(Phaser.BlendModes.ADD); lt.setDepth(4)
      this.tweens.add({
        targets: lt, fillAlpha: 0.9, scaleX: 1.7, scaleY: 1.7,
        duration: 1400 + i * 420, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 320,
      })
    })

    // Central console glow
    const con = this.add.arc(cx, cy + 18, 13, 0, 360, false, 0x00e5ff, 0.1)
    con.setBlendMode(Phaser.BlendModes.ADD); con.setDepth(4)
    this.tweens.add({
      targets: con, fillAlpha: 0.42, scaleX: 1.6, scaleY: 1.6,
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    this.add.text(cx, cy - ry - 12, 'AGENT HQ', {
      fontSize: '8px', color: '#4dd0e1', fontFamily: FONT, align: 'center',
    }).setOrigin(0.5, 1).setDepth(5)
  }

  // ── Computers along the inside wall of HQ — screens face inward ──────────────
  private drawComputers() {
    COMP_ANGLES.forEach((angleDeg, i) => {
      const rad = Phaser.Math.DegToRad(angleDeg)
      // Position on the inside of the ellipse wall
      const px = HQ.cx + (HQ.rx - COMP_OFFSET) * Math.cos(rad)
      const py = HQ.cy + (HQ.ry - COMP_OFFSET) * Math.sin(rad)
      // Rotation: screen (-Y local) faces inward toward centre — formula: angleDeg - 90
      const rotation = Phaser.Math.DegToRad(angleDeg - 90)

      const comp = this.add.container(px, py)
      comp.setDepth(6)
      comp.setRotation(rotation)

      // Computer body centred at origin, screen at local -Y (inward)
      const g = this.add.graphics()
      g.fillStyle(0x1c2733);       g.fillRect(-18, -22, 36, 26)   // body
      g.fillStyle(C.screenDark);   g.fillRect(-14, -20, 28, 18)   // bezel
      g.fillStyle(C.screen, 0.88); g.fillRect(-12, -18, 24, 14)   // screen
      g.fillStyle(C.screenDark)
      g.fillRect(-9, -15, 11, 2)
      g.fillRect(-9, -11, 16, 2)
      g.fillRect(-9,  -7,  8, 2)
      g.fillStyle(0x1c2733)
      g.fillRect(-3, 4, 6, 6)      // neck
      g.fillRect(-10, 9, 20, 3)    // base
      comp.add(g)

      const flicker = this.add.rectangle(0, -11, 24, 14, C.screen, 0.05)
      flicker.setBlendMode(Phaser.BlendModes.ADD)
      comp.add(flicker)
      this.tweens.add({
        targets: flicker, fillAlpha: 0.30,
        duration: 1100 + i * 370, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 550,
      })

      // Label on the inward side in world space (not rotated)
      const lx = HQ.cx + (HQ.rx - COMP_OFFSET - 28) * Math.cos(rad)
      const ly = HQ.cy + (HQ.ry - COMP_OFFSET - 28) * Math.sin(rad)
      this.add.text(lx, ly,
        i === 0 ? 'SAGE' : '[ empty ]',
        { fontSize: '6px', color: i === 0 ? '#00e5ff' : '#1e3a4a', fontFamily: FONT, align: 'center' },
      ).setOrigin(0.5, 0.5).setDepth(7)
    })
  }

  // ── Lab equipment inside HQ ───────────────────────────────────────────────────
  private drawLabEquipment() {
    const g = this.add.graphics()
    g.setDepth(5)
    const { cx, cy } = HQ

    // Lab bench — curved counter in the lower interior
    g.fillStyle(0x1a3a2a); g.fillRect(cx - 58, cy + 34, 116, 16)
    g.fillStyle(0x1f4a35); g.fillRect(cx - 58, cy + 34, 116, 2)

    // Beakers on the bench
    const beakerCols = [0x00e5ff, 0x69f0ae, 0xffca28, 0xff4081]
    for (let b = 0; b < 4; b++) {
      const bx = cx - 42 + b * 24
      const bc = beakerCols[b]
      g.fillStyle(0x263238)
      g.fillPoints([
        { x: bx - 7, y: cy + 26 }, { x: bx - 5, y: cy + 34 },
        { x: bx + 5, y: cy + 34 }, { x: bx + 7, y: cy + 26 },
      ], true)
      g.fillStyle(bc, 0.5); g.fillRect(bx - 4, cy + 28, 8, 5)
      g.fillStyle(0x37474f); g.fillRect(bx - 8, cy + 24, 16, 3)

      const glow = this.add.arc(bx, cy + 30, 5, 0, 360, false, bc, 0.1)
      glow.setBlendMode(Phaser.BlendModes.ADD); glow.setDepth(6)
      this.tweens.add({
        targets: glow, fillAlpha: 0.45, scaleX: 1.6, scaleY: 1.6,
        duration: 1200 + b * 310, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: b * 420,
      })
    }

    // Holographic rings in the centre of the floor
    for (let r = 0; r < 3; r++) {
      const ring = this.add.arc(cx, cy + 8, 10 + r * 8, 0, 360, false, 0x00e5ff, 0)
      ring.setStrokeStyle(1, 0x00e5ff, 0.28)
      ring.setBlendMode(Phaser.BlendModes.ADD)
      ring.setScale(1, 0.45); ring.setDepth(6)
      this.tweens.add({
        targets: ring, alpha: 0.8, angle: 360,
        duration: 2200 + r * 600, repeat: -1,
        ease: 'Linear', delay: r * 500,
      })
    }

    // Telescope/antenna — left interior
    g.fillStyle(0x37474f); g.fillRect(cx - 72, cy + 8, 4, 22)
    g.fillStyle(0x546e7a); g.fillRect(cx - 86, cy + 5, 22, 4)
    g.fillStyle(0x455a64); g.fillEllipse(cx - 75, cy + 5, 18, 10)

    // Server rack — right interior
    g.fillStyle(0x1a2b36); g.fillRect(cx + 54, cy - 8, 20, 38)
    for (let r = 0; r < 4; r++) {
      g.fillStyle(0x1e3a4a); g.fillRect(cx + 56, cy - 6 + r * 9, 16, 7)
      const ledCol = [0x00e5ff, 0x69f0ae, 0x69f0ae, 0xff4081][r]
      g.fillStyle(ledCol, 0.9); g.fillCircle(cx + 69, cy - 3 + r * 9, 2)
    }
  }

  // ── Rock bridges across the lava ──────────────────────────────────────────────
  private drawLavaBridges() {
    const g = this.add.graphics()
    g.setDepth(2)

    const bridgeXs = [285, 970]
    const bw = 44
    const blockH = 16
    const numBlocks = Math.ceil((ZONE.lavaEnd - ZONE.lavaStart) / blockH)

    bridgeXs.forEach((bx, bi) => {
      for (let j = 0; j < numBlocks; j++) {
        const by = ZONE.lavaStart + j * blockH
        const jit = seededVal(bi * 20 + j, 80) * 8 - 4
        const bwj = bw + seededVal(bi * 20 + j, 81) * 10 - 5

        g.fillStyle(0x546e7a); g.fillRect(bx - bwj / 2 + jit, by, bwj, blockH - 2)
        g.fillStyle(0x78909c, 0.6); g.fillRect(bx - bwj / 2 + jit, by, bwj, 3)
        g.fillStyle(0x37474f, 0.5); g.fillRect(bx - bwj / 2 + jit, by + blockH - 4, bwj, 3)
        // crack line
        g.fillStyle(0x263238, seededVal(bi * 20 + j, 82) * 0.25 + 0.08)
        g.fillRect(bx + jit, by + 6, seededVal(bi * 20 + j, 83) * 14 + 4, 1)
      }

      // Side pillar columns
      g.fillStyle(0x37474f, 0.75)
      g.fillRect(bx - bw / 2 - 7, ZONE.lavaStart, 7, ZONE.lavaEnd - ZONE.lavaStart)
      g.fillRect(bx + bw / 2,     ZONE.lavaStart, 7, ZONE.lavaEnd - ZONE.lavaStart)

      // Lava glow seeping through gaps between blocks
      for (let j = 0; j < numBlocks; j++) {
        const gy = ZONE.lavaStart + j * blockH + blockH - 2
        const gap = this.add.rectangle(bx, gy, bw - 10, 2, C.lavaGlow, 0.25)
        gap.setBlendMode(Phaser.BlendModes.ADD); gap.setDepth(2.5)
        this.tweens.add({
          targets: gap, fillAlpha: 0.65,
          duration: 750 + j * 130, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut', delay: bi * 180 + j * 70,
        })
      }
    })
  }

  // ── Zone border decorations ────────────────────────────────────────────────────
  private drawZoneBorders() {
    const g = this.add.graphics()
    g.setDepth(2)

    // ── Cherry blossom trees along the grass / water divider ──
    const div = vWave(615, 0, ZONE.topEnd, 50, 80, 1.2)
    const treeTs = [0.08, 0.22, 0.38, 0.54, 0.70, 0.86]

    treeTs.forEach((t, i) => {
      const idx = Math.min(Math.floor(t * div.length), div.length - 1)
      const tx = div[idx].x
      const ty = div[idx].y
      const sc = 0.72 + seededVal(i, 90) * 0.45

      // Trunk
      g.fillStyle(0x5d4037); g.fillRect(tx - 3 * sc, ty - 28 * sc, 6 * sc, 28 * sc)
      // Branches
      g.fillStyle(0x4e342e)
      g.fillRect(tx - 14 * sc, ty - 20 * sc, 12 * sc, 3 * sc)
      g.fillRect(tx +  2 * sc, ty - 16 * sc, 12 * sc, 3 * sc)
      // Blossom clusters
      for (let c = 0; c < 7; c++) {
        const cx = tx + (seededVal(i * 10 + c, 91) * 32 - 16) * sc
        const cy = ty - 30 * sc + seededVal(i * 10 + c, 92) * 18 * sc
        const cr = (seededVal(i * 10 + c, 93) * 9 + 7) * sc
        g.fillStyle(0xf48fb1, seededVal(i * 10 + c, 94) * 0.35 + 0.30)
        g.fillCircle(cx, cy, cr)
      }
      // Bright inner blooms
      for (let c = 0; c < 4; c++) {
        const cx = tx + (seededVal(i * 10 + c + 50, 91) * 22 - 11) * sc
        const cy = ty - 32 * sc + seededVal(i * 10 + c + 50, 92) * 14 * sc
        g.fillStyle(0xf06292, seededVal(i * 10 + c + 50, 94) * 0.3 + 0.35)
        g.fillCircle(cx, cy, (seededVal(i * 10 + c + 50, 93) * 5 + 4) * sc)
      }
      // Fallen petals
      for (let p = 0; p < 6; p++) {
        const px = tx + (seededVal(i * 10 + p, 95) * 44 - 22)
        const py = ty + seededVal(i * 10 + p, 96) * 12
        g.fillStyle(0xf48fb1, seededVal(i * 10 + p, 97) * 0.4 + 0.12)
        g.fillEllipse(px, py, seededVal(i * 10 + p, 98) * 6 + 3, 2)
      }
    })

    // ── Dark mountain range at the top edge of the lava zone ──
    const mtBase = ZONE.topEnd + 10
    const peaks = [
      { x: 50,   h: 52 }, { x: 120, h: 38 }, { x: 195, h: 65 },
      { x: 278,  h: 44 }, { x: 358, h: 72 }, { x: 448, h: 50 },
      { x: 538,  h: 46 }, { x: 628, h: 68 }, { x: 720, h: 48 },
      { x: 810,  h: 62 }, { x: 895, h: 40 }, { x: 978, h: 70 },
      { x: 1065, h: 52 }, { x: 1148, h: 42 }, { x: 1225, h: 58 },
    ]

    // Back layer — darkest
    peaks.forEach((mt, i) => {
      const w = mt.h * 0.68 + 10
      g.fillStyle(0x12131f, 0.75)
      g.fillTriangle(mt.x, mtBase - mt.h, mt.x - w, mtBase + 8, mt.x + w, mtBase + 8)
    })
    // Front layer — slightly lighter, offset
    peaks.forEach((mt, i) => {
      const ox = seededVal(i, 101) * 28 - 14
      const oh = mt.h * 0.68
      const w = oh * 0.55 + 7
      g.fillStyle(0x1e2040, 0.82)
      g.fillTriangle(mt.x + ox, mtBase - oh, mt.x + ox - w, mtBase + 5, mt.x + ox + w, mtBase + 5)
      // Purple-blue snow highlight on tip
      g.fillStyle(0x5c6bc0, 0.22)
      g.fillTriangle(
        mt.x + ox,           mtBase - oh,
        mt.x + ox - w * 0.3, mtBase - oh * 0.72,
        mt.x + ox + w * 0.3, mtBase - oh * 0.72,
      )
    })
    // Base fill strip — ties mountains into lava border
    g.fillStyle(0x0a0b16, 0.55); g.fillRect(0, mtBase, W, 12)
  }

  // ── Beach decor ───────────────────────────────────────────────────────────────
  private drawBeachDecor() {
    const g = this.add.graphics()
    const towelColors = [0xe53935, 0x1e88e5, 0x43a047, 0xfb8c00, 0x8e24aa, 0x00897b]

    // Towels — organic slightly rotated quads using fillPoints
    TOWELS.forEach((tx, i) => {
      const ty = ZONE.beachStart + 90 + (i % 2) * 80
      const col = towelColors[i % towelColors.length]
      // Slight organic warp so they don't look perfectly rectangular
      const warp = seededVal(i, 50) * 4 - 2
      g.fillStyle(col)
      g.fillPoints([
        { x: tx - 22 + warp, y: ty },
        { x: tx + 22, y: ty - 1 },
        { x: tx + 22 - warp, y: ty + 22 },
        { x: tx - 22, y: ty + 23 },
      ], true)
      // Stripe
      g.fillStyle(0xffffff, 0.22)
      g.fillPoints([
        { x: tx - 22 + warp, y: ty + 5 },
        { x: tx + 22, y: ty + 4 },
        { x: tx + 22 - warp, y: ty + 9 },
        { x: tx - 22, y: ty + 10 },
      ], true)
    })

    // Umbrellas — rounder canopy with fillPoints
    UMBRELLAS.forEach((ux, idx) => {
      const uy = ZONE.beachStart + 35 + (idx % 2) * 55
      // Pole
      g.fillStyle(0x795548); g.fillRect(ux - 2, uy, 4, 55)
      // Canopy as polygon arc (more dome-like than a triangle)
      const canopyPts: { x: number; y: number }[] = []
      for (let a = 180; a <= 360; a += 12) {
        const rad = Phaser.Math.DegToRad(a)
        canopyPts.push({
          x: ux + 40 * Math.cos(rad),
          y: uy + 22 * Math.sin(rad) + 2,
        })
      }
      canopyPts.push({ x: ux, y: uy })
      g.fillStyle(0xfdd835); g.fillPoints(canopyPts, true)
      // Canopy inner highlight
      const innerPts: { x: number; y: number }[] = []
      for (let a = 190; a <= 350; a += 16) {
        const rad = Phaser.Math.DegToRad(a)
        innerPts.push({
          x: ux + 26 * Math.cos(rad),
          y: uy + 14 * Math.sin(rad) + 4,
        })
      }
      innerPts.push({ x: ux, y: uy + 4 })
      g.fillStyle(0xf9a825, 0.6); g.fillPoints(innerPts, true)
      g.fillStyle(0xf57f17); g.fillCircle(ux, uy, 4)

      // Umbrella shadow on sand
      g.fillStyle(0x000000, 0.1)
      g.fillEllipse(ux + 8, uy + 58, 60, 14)
    })

    // Scattered seashells — small organic blobs
    for (let i = 0; i < 30; i++) {
      const sx = seededVal(i, 60) * (W - 60) + 30
      const sy = ZONE.beachStart + 60 + seededVal(i, 61) * (H - ZONE.beachStart - 100)
      const sr = seededVal(i, 62) * 4 + 2
      g.fillStyle(0xfff8e7, seededVal(i, 63) * 0.5 + 0.2)
      g.fillEllipse(sx, sy, sr * 2.4, sr * 1.4)
    }

    // Shore waves
    for (let i = 0; i < 3; i++) {
      const wave = this.add.rectangle(W / 2, H - 18 - i * 9, W, 4, 0x90caf9, 0)
      this.tweens.add({
        targets: wave, fillAlpha: 0.46, scaleX: 0.70,
        duration: 2000 + i * 650, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 720,
      })
    }
  }

  // ── Animated water ────────────────────────────────────────────────────────────
  private animateWater() {
    // Organic shimmer blobs instead of stripes
    for (let i = 0; i < 8; i++) {
      const bx = 80 + i * 62
      const by = 30 + (i % 3) * 80
      const shimmer = this.add.arc(bx, by, 20 + (i % 3) * 12, 0, 360, false, C.waterShimmer, 0)
      shimmer.setBlendMode(Phaser.BlendModes.ADD)
      shimmer.setScale(2.8, 0.9)
      this.tweens.add({
        targets: shimmer, fillAlpha: 0.42,
        duration: 1700 + i * 310, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 380,
      })
    }

    this.waterEmitter = this.add.particles(295, 135, 'spark', {
      x: { min: -275, max: 275 }, y: { min: -125, max: 125 },
      speedY: { min: -25, max: -8 }, speedX: { min: -10, max: 10 },
      alpha: { start: 0.7, end: 0 }, scale: { start: 0.7, end: 0 },
      tint: [0x42a5f5, 0x90caf9, 0xe3f2fd],
      lifespan: { min: 1800, max: 3000 }, frequency: 320, quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    })
  }

  // ── Animated lava ─────────────────────────────────────────────────────────────
  private animateLava() {
    const midY = ZONE.lavaStart + (ZONE.lavaEnd - ZONE.lavaStart) / 2

    // Pulsing glow pools — ellipses of varying sizes
    for (let i = 0; i < 10; i++) {
      const px = 70 + i * 118
      const py = midY + seededVal(i, 70) * 30 - 15
      const pool = this.add.arc(px, py, 16 + (i % 3) * 6, 0, 360, false, C.lavaCrack, 0)
      pool.setScale(2.0, 1.0)
      pool.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: pool, fillAlpha: 0.68, scaleX: 2.8, scaleY: 1.4,
        duration: 950 + i * 200, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 215,
      })
    }

    // Crack veins — thin ellipses not rectangles
    for (let i = 0; i < 10; i++) {
      const vx = 50 + i * 120
      const vy = ZONE.lavaStart + seededVal(i, 75) * (ZONE.lavaEnd - ZONE.lavaStart - 16) + 8
      const vein = this.add.arc(vx, vy, 5, 0, 360, false, 0xff9800, 0)
      vein.setScale(1.2, 6)
      vein.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: vein, fillAlpha: 0.52,
        duration: 1300 + i * 240, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 370,
      })
    }

    this.lavaEmitter = this.add.particles(W / 2, ZONE.lavaEnd - 18, 'ember', {
      x: { min: -(W / 2), max: W / 2 }, y: { min: -18, max: 8 },
      speedY: { min: -80, max: -28 }, speedX: { min: -20, max: 20 },
      alpha: { start: 0.9, end: 0 }, scale: { start: 0.55, end: 0 },
      tint: [0xff5722, 0xff9800, 0xffcc02, 0xffffff],
      lifespan: { min: 1000, max: 2600 }, frequency: 65, quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    })
  }

  // ── Zone glow ─────────────────────────────────────────────────────────────────
  private drawZoneGlow() {
    const g = this.add.graphics()
    g.fillGradientStyle(0xff5722, 0xff5722, 0xff5722, 0xff5722, 0, 0, 0.3, 0.3)
    g.fillRect(0, ZONE.topEnd + 18, W, 42)
    g.fillGradientStyle(0xff5722, 0xff5722, 0xff5722, 0xff5722, 0.24, 0.24, 0, 0)
    g.fillRect(0, ZONE.lavaEnd - 10, W, 44)
    g.fillGradientStyle(0x1976d2, 0x1976d2, 0x1976d2, 0x1976d2, 0.15, 0.15, 0, 0)
    g.fillRect(0, ZONE.topEnd - 36, 590, 36)
  }

  // ── Labels ────────────────────────────────────────────────────────────────────
  private drawLabels() {
    const s = { fontFamily: FONT, fontSize: '10px' }
    this.add.text(14,  10,                  '~ WATER',   { ...s, color: '#90caf9' }).setDepth(5)
    this.add.text(658, 10,                  'GRASS ~',    { ...s, color: '#81c784' }).setDepth(5)
    this.add.text(14,  ZONE.lavaStart +  8, 'LAVA ZONE', { ...s, color: '#ff8a65' }).setDepth(5)
    this.add.text(14,  ZONE.beachStart + 8, 'IDLE ZONE', { ...s, color: '#ffe082' }).setDepth(5)
  }

  // ── Vignette ──────────────────────────────────────────────────────────────────
  private drawVignette() {
    const g = this.add.graphics()
    g.setDepth(50)
    const v = 0.88, e = 110
    g.fillGradientStyle(0, 0, 0, 0, v,    v,    0,    0   ); g.fillRect(0,     0,     W, e)
    g.fillGradientStyle(0, 0, 0, 0, 0,    0,    v,    v   ); g.fillRect(0,     H - e, W, e)
    g.fillGradientStyle(0, 0, 0, 0, v*.7, 0,    v*.7, 0   ); g.fillRect(0,     0,     e, H)
    g.fillGradientStyle(0, 0, 0, 0, 0,    v*.7, 0,    v*.7); g.fillRect(W - e, 0,     e, H)
  }

  // ── Creatures ─────────────────────────────────────────────────────────────────

  private spawnSage() {
    this.sageContainer = this.add.container(200, ZONE.beachStart + 80)
    this.sageContainer.setDepth(10)
    this.sageSprite = this.add.container(0, 0)
    this.buildSageSprite(this.sageSprite)
    this.sageContainer.add(this.sageSprite)
    this.sageNameTag = this.add.text(0, 28, 'SAGE', {
      fontSize: '7px', color: '#ce93d8', fontFamily: FONT,
    }).setOrigin(0.5, 0)
    this.sageContainer.add(this.sageNameTag)
    this.wanderSage()
  }

  private buildSageSprite(c: Phaser.GameObjects.Container) {
    const g = this.add.graphics()
    g.fillStyle(0x9c27b0, 0.16); g.fillCircle(0, 0, 24)
    g.fillStyle(0x7e57c2);       g.fillEllipse(0, 7, 24, 18)
    g.fillStyle(0x9575cd);       g.fillCircle(0, -8, 13)
    g.fillStyle(0xb39ddb)
    g.fillTriangle(-12, -14, -8, -25, -3, -12)
    g.fillTriangle( 12, -14,  8, -25,  3, -12)
    g.fillStyle(0xce93d8, 0.5)
    g.fillTriangle(-10, -15, -8, -22, -5, -13)
    g.fillTriangle( 10, -15,  8, -22,  5, -13)
    g.fillStyle(0xffffff)
    g.fillCircle(-4.5, -9, 3.5); g.fillCircle(4.5, -9, 3.5)
    g.fillStyle(0x311b92)
    g.fillCircle(-4, -9, 2);     g.fillCircle(5, -9, 2)
    g.fillStyle(0xffffff)
    g.fillCircle(-5, -10.5, 1);  g.fillCircle(4, -10.5, 1)
    g.fillStyle(0xf48fb1, 0.42)
    g.fillCircle(-8, -5, 4);     g.fillCircle(8, -5, 4)
    c.add(g)
    const orb = this.add.arc(20, -20, 6, 0, 360, false, 0xce93d8, 0.88)
    orb.setBlendMode(Phaser.BlendModes.ADD); c.add(orb)
    this.tweens.add({
      targets: orb, y: '-=6', scaleX: 1.4, scaleY: 1.4, alpha: 0.42,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    // Store reference so zone animations can change bob speed
    this.sageBobGraphics = g
    this.sageBobTween = this.tweens.add({
      targets: g, y: '-=5',
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  private spawnTrainer() {
    this.trainerContainer = this.add.container(HQ.cx, HQ.cy + 25)
    this.trainerContainer.setDepth(10)
    this.trainerSprite = this.add.container(0, 0)
    this.buildTrainerSprite(this.trainerSprite)
    this.trainerContainer.add(this.trainerSprite)
    this.trainerContainer.add(
      this.add.text(0, 30, 'PRIME G', {
        fontSize: '7px', color: '#81d4fa', fontFamily: FONT,
      }).setOrigin(0.5, 0),
    )
    this.wanderTrainer()
  }

  private buildTrainerSprite(c: Phaser.GameObjects.Container) {
    const g = this.add.graphics()
    g.fillStyle(0x0288d1, 0.16); g.fillCircle(0, 0, 24)
    g.fillStyle(0x01579b);       g.fillRect(-11, -2, 22, 20)
    g.fillStyle(0x0288d1);       g.fillCircle(0, -13, 12)
    g.fillStyle(0x01579b);       g.fillRect(-15, -19, 30, 6)
    g.fillStyle(0x0277bd);       g.fillRect(-10, -28, 20, 11)
    g.fillStyle(0xffffff);       g.fillCircle(0, -23, 2.5)
    g.fillStyle(0xffffff)
    g.fillCircle(-4, -13, 3); g.fillCircle(4, -13, 3)
    g.fillStyle(0x1a237e)
    g.fillCircle(-3.5, -13, 1.8); g.fillCircle(4.5, -13, 1.8)
    g.fillStyle(0xffffff)
    g.fillCircle(-4.5, -14, 0.9); g.fillCircle(4, -14, 0.9)
    c.add(g)
    this.tweens.add({
      targets: g, y: '-=3',
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  // ── Status updates from backend ───────────────────────────────────────────────

  private handleStatusUpdate(status: any) {
    if (!status?.agents) return
    const sage = status.agents.find((a: any) => a.id === 'sage')
    if (!sage || !this.sageNameTag) return

    const newState: string = sage.state

    // Update name tag color
    this.tweens.killTweensOf(this.sageNameTag)
    this.sageNameTag.setAlpha(1)
    switch (newState) {
      case 'idle':
      case 'done':
        this.sageNameTag.setColor('#ce93d8')
        break
      case 'error':
        this.sageNameTag.setColor('#ef5350')
        this.tweens.add({
          targets: this.sageNameTag, alpha: 0.2,
          duration: 180, yoyo: true, repeat: 5, ease: 'Linear',
          onComplete: () => this.sageNameTag.setAlpha(1),
        })
        break
      default:
        this.sageNameTag.setColor('#00e5ff')
        this.tweens.add({
          targets: this.sageNameTag, alpha: 0.35,
          duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
    }

    // Trigger movement only when state actually changes
    if (newState !== this.sageState) {
      this.sageState = newState
      this.moveSageToState(newState)
    }
  }

  // ── Movement routing ──────────────────────────────────────────────────────────

  private moveSageToState(state: string) {
    this.stopSageWander()
    this.clearWorkingEffects()

    if (state === 'done') {
      this.playDoneAnimation(() => this.moveSageToBeach(false))
      return
    }
    if (state === 'error') {
      this.playErrorAnimation(() => this.moveSageToBeach(true))
      return
    }
    if (state === 'idle') {
      this.moveSageToBeach(false)
      return
    }

    if (state === 'thinking') {
      this.moveToHQ()
      return
    }

    const zone = STATE_ZONE[state] ?? 'beach'
    const spots = ZONE_SPOTS[zone as keyof typeof ZONE_SPOTS] as { x: number; y: number }[]
    const target = Phaser.Utils.Array.GetRandom(spots)

    this.sageSprite.scaleX = target.x > this.sageContainer.x ? 1 : -1
    this.sageMoveTween = this.tweens.add({
      targets: this.sageContainer, x: target.x, y: target.y,
      duration: Phaser.Math.Between(2000, 4000),
      ease: 'Sine.easeInOut',
      onComplete: () => this.playZoneAnimation(zone),
    })
  }

  private moveToHQ() {
    const rad = Phaser.Math.DegToRad(COMP_ANGLES[0])
    const target = {
      x: HQ.cx + (HQ.rx - COMP_OFFSET) * Math.cos(rad),
      y: HQ.cy + (HQ.ry - COMP_OFFSET) * Math.sin(rad) + 20,
    }
    this.sageSprite.scaleX = target.x > this.sageContainer.x ? 1 : -1
    this.sageMoveTween = this.tweens.add({
      targets: this.sageContainer, x: target.x, y: target.y,
      duration: Phaser.Math.Between(2000, 4000),
      ease: 'Sine.easeInOut',
      onComplete: () => this.playZoneAnimation('hq'),
    })
  }

  private moveSageToBeach(slow: boolean) {
    const target = Phaser.Utils.Array.GetRandom(ZONE_SPOTS.beach)
    this.sageSprite.scaleX = target.x > this.sageContainer.x ? 1 : -1
    this.sageMoveTween = this.tweens.add({
      targets: this.sageContainer, x: target.x, y: target.y,
      duration: slow ? 5000 : Phaser.Math.Between(2000, 3500),
      ease: 'Sine.easeInOut',
      onComplete: () => this.wanderSage(),
    })
  }

  private stopSageWander() {
    if (this.sageWanderEvent) {
      this.sageWanderEvent.remove(false)
      this.sageWanderEvent = null
    }
    if (this.sageMoveTween) {
      this.sageMoveTween.stop()
      this.sageMoveTween = null
    }
    this.tweens.killTweensOf(this.sageContainer)
  }

  private clearWorkingEffects() {
    this.sageWorkingCleanup.forEach(fn => fn())
    this.sageWorkingCleanup = []
    if (this.sageBobTween) this.sageBobTween.timeScale = 1
  }

  // ── Zone working animations ────────────────────────────────────────────────────

  private playZoneAnimation(zone: string) {
    this.clearWorkingEffects()
    switch (zone) {
      case 'grass': this.playGrassAnimation(); break
      case 'water': this.playWaterAnimation(); break
      case 'lava':  this.playLavaAnimation();  break
      case 'hq':    this.playHQAnimation();    break
    }
  }

  private playGrassAnimation() {
    if (this.sageBobTween) this.sageBobTween.timeScale = 2.2

    const burst = () => {
      if (this.sageState !== 'researching') return
      for (let i = 0; i < 4; i++) {
        const px = this.sageContainer.x + Phaser.Math.Between(-18, 18)
        const py = this.sageContainer.y + Phaser.Math.Between(-10, 10)
        const dot = this.add.arc(px, py, 3, 0, 360, false, 0x66bb6a, 0.9)
        dot.setBlendMode(Phaser.BlendModes.ADD).setDepth(11)
        this.tweens.add({
          targets: dot, y: py - 32, alpha: 0,
          duration: 900, ease: 'Sine.easeOut',
          onComplete: () => dot.destroy(),
        })
      }
      const item = this.add.arc(
        this.sageContainer.x, this.sageContainer.y - 12,
        4, 0, 360, false, 0xfff176, 1,
      )
      item.setBlendMode(Phaser.BlendModes.ADD).setDepth(12)
      this.tweens.add({
        targets: item, y: this.sageContainer.y - 50, alpha: 0,
        duration: 1400, ease: 'Sine.easeOut',
        onComplete: () => item.destroy(),
      })
    }

    burst()
    const event = this.time.addEvent({ delay: 3000, callback: burst, loop: true })
    this.sageWorkingCleanup.push(() => {
      event.remove(false)
      if (this.sageBobTween) this.sageBobTween.timeScale = 1
    })
  }

  private playWaterAnimation() {
    if (this.sageBobTween) this.sageBobTween.timeScale = 0.55

    const ripple = () => {
      if (this.sageState !== 'communicating') return
      const ring = this.add.arc(
        this.sageContainer.x, this.sageContainer.y + 14,
        5, 0, 360, false, 0x42a5f5, 0,
      )
      ring.setStrokeStyle(1.5, 0x42a5f5, 0.8)
      ring.setBlendMode(Phaser.BlendModes.ADD).setDepth(11)
      this.tweens.add({
        targets: ring, scaleX: 9, scaleY: 9, alpha: 0,
        duration: 1800, ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      })
    }

    ripple()
    const event = this.time.addEvent({ delay: 2000, callback: ripple, loop: true })
    this.sageWorkingCleanup.push(() => {
      event.remove(false)
      if (this.sageBobTween) this.sageBobTween.timeScale = 1
    })
  }

  private playLavaAnimation() {
    if (this.sageBobTween) this.sageBobTween.timeScale = 1.9

    const aura = this.add.arc(
      this.sageContainer.x, this.sageContainer.y,
      22, 0, 360, false, 0xff5722, 0,
    )
    aura.setBlendMode(Phaser.BlendModes.ADD).setDepth(9)
    const auraTween = this.tweens.add({
      targets: aura, fillAlpha: 0.6, scaleX: 1.6, scaleY: 1.6,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    const emitter = this.add.particles(
      this.sageContainer.x, this.sageContainer.y - 10, 'ember', {
        x: { min: -12, max: 12 }, y: { min: -12, max: 12 },
        speedY: { min: -60, max: -20 }, speedX: { min: -15, max: 15 },
        alpha: { start: 0.8, end: 0 }, scale: { start: 0.5, end: 0 },
        tint: [0xff5722, 0xff9800, 0xffcc02],
        lifespan: { min: 600, max: 1200 }, frequency: 120, quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      },
    )
    emitter.setDepth(11)

    this.sageWorkingCleanup.push(() => {
      auraTween.stop(); aura.destroy(); emitter.destroy()
      if (this.sageBobTween) this.sageBobTween.timeScale = 1
    })
  }

  private playHQAnimation() {
    if (this.sageBobTween) this.sageBobTween.timeScale = 0

    const bubbles: Phaser.GameObjects.Arc[] = []
    for (let i = 0; i < 3; i++) {
      const b = this.add.arc(
        this.sageContainer.x + 4 + i * 7,
        this.sageContainer.y - 28 - i * 6,
        3 + i, 0, 360, false, 0xffffff, 0,
      )
      b.setDepth(11)
      this.tweens.add({
        targets: b, fillAlpha: 0.7,
        duration: 400, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 250,
      })
      bubbles.push(b)
    }

    const cloud = this.add.arc(
      this.sageContainer.x + 20, this.sageContainer.y - 44,
      9, 0, 360, false, 0xffffff, 0,
    )
    cloud.setDepth(11)
    const cloudTween = this.tweens.add({
      targets: cloud, fillAlpha: 0.65, scaleX: 1.7, scaleY: 0.9,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    this.sageWorkingCleanup.push(() => {
      bubbles.forEach(b => b.destroy())
      cloudTween.stop(); cloud.destroy()
      if (this.sageBobTween) this.sageBobTween.timeScale = 1
    })
  }

  // ── Done / Error animations ───────────────────────────────────────────────────

  private playDoneAnimation(onComplete: () => void) {
    const cx = this.sageContainer.x
    const cy = this.sageContainer.y

    const flash = this.add.arc(cx, cy, 28, 0, 360, false, 0xffffff, 0.7)
    flash.setBlendMode(Phaser.BlendModes.ADD).setDepth(12)
    this.tweens.add({
      targets: flash, scaleX: 2.6, scaleY: 2.6, fillAlpha: 0,
      duration: 600, ease: 'Sine.easeOut',
      onComplete: () => { flash.destroy(); onComplete() },
    })

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      const spark = this.add.arc(cx, cy, 3, 0, 360, false, 0xfff9c4, 1)
      spark.setBlendMode(Phaser.BlendModes.ADD).setDepth(12)
      this.tweens.add({
        targets: spark,
        x: cx + Math.cos(angle) * 42,
        y: cy + Math.sin(angle) * 42,
        alpha: 0,
        duration: 520, ease: 'Sine.easeOut',
        onComplete: () => spark.destroy(),
      })
    }
  }

  private playErrorAnimation(onComplete: () => void) {
    const cx = this.sageContainer.x
    const cy = this.sageContainer.y

    const flash = this.add.arc(cx, cy, 28, 0, 360, false, 0xef5350, 0.6)
    flash.setBlendMode(Phaser.BlendModes.ADD).setDepth(12)
    this.tweens.add({
      targets: flash, scaleX: 2.4, scaleY: 2.4, fillAlpha: 0,
      duration: 500, ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })

    const origX = this.sageContainer.x
    let shakes = 0
    const shake = () => {
      if (shakes >= 5) { this.sageContainer.x = origX; onComplete(); return }
      shakes++
      this.tweens.add({
        targets: this.sageContainer,
        x: origX + (shakes % 2 === 0 ? 7 : -7),
        duration: 55, ease: 'Linear',
        onComplete: shake,
      })
    }
    shake()
  }

  // ── Movement ──────────────────────────────────────────────────────────────────

  private wanderSage() {
    // Only wander when on the beach
    if (!['idle', 'done', 'error'].includes(this.sageState)) return
    this.sageWanderEvent = this.time.addEvent({
      delay: Phaser.Math.Between(2800, 5200),
      callback: () => {
        if (!['idle', 'done', 'error'].includes(this.sageState)) return
        const tx = Phaser.Math.Between(80, W - 80)
        const ty = Phaser.Math.Between(ZONE.beachStart + 40, H - 44)
        this.sageSprite.scaleX = tx > this.sageContainer.x ? 1 : -1
        this.sageMoveTween = this.tweens.add({
          targets: this.sageContainer, x: tx, y: ty,
          duration: Phaser.Math.Between(1800, 3200),
          ease: 'Sine.easeInOut',
          onComplete: () => this.wanderSage(),
        })
      },
    })
  }

  private wanderTrainer() {
    // Compute a few computer positions to visit
    const compSpot = (idx: number) => {
      const rad = Phaser.Math.DegToRad(COMP_ANGLES[idx])
      return {
        x: HQ.cx + (HQ.rx - COMP_OFFSET) * Math.cos(rad),
        y: HQ.cy + (HQ.ry - COMP_OFFSET) * Math.sin(rad) + 22,
      }
    }
    const spots = [
      { x: HQ.cx,           y: HQ.cy + 22 },
      compSpot(0),
      compSpot(2),
      compSpot(4),
      { x: 380,             y: ZONE.beachStart + 55 },
      { x: 900,             y: ZONE.beachStart + 60 },
      { x: HQ.cx,           y: HQ.cy + HQ.ry + 18 },
    ]
    this.time.addEvent({
      delay: Phaser.Math.Between(4000, 7000),
      callback: () => {
        const target = Phaser.Utils.Array.GetRandom(spots)
        this.trainerSprite.scaleX = target.x > this.trainerContainer.x ? 1 : -1
        this.tweens.add({
          targets: this.trainerContainer, ...target,
          duration: Phaser.Math.Between(2000, 4000),
          ease: 'Sine.easeInOut',
          onComplete: () => this.wanderTrainer(),
        })
      },
    })
  }
}
