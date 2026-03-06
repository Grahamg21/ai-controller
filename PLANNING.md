# AI Agent Controller — Full Build Plan
_Authored autonomously by Claude Code during planning session 2026-03-05_
_For Prime G / Graham — load this alongside BRIEF.md at the start of any coding session_

---

## How to Use This Document

This is a complete implementation plan for Phases 2–6 of the AI Agent Controller project.
Every decision has been made in advance. Each phase section contains:
- Exact file structure to create
- Implementation approach with no ambiguity
- Key code patterns to follow
- What "done" looks like before moving to the next phase

**Phase 1 is complete** (map shell, building, creatures, borders, bridges, GitHub).
Start here at Phase 2.

---

## Phase 2 — Data Layer + Agent Status

### Goal
A Python FastAPI backend reads the Assistant/ markdown files and agent JSON configs.
The React frontend polls it every 30 seconds and passes live state into Phaser via events.
Creatures don't move yet — they just reflect real status data visually (name tag color changes, idle vs. working aura).

### New File Structure
```
ai-controller/
  backend/
    main.py           # FastAPI app, all routes
    data_reader.py    # reads tasks.md, workout_log.md, dinner_log.md
    agent_manager.py  # reads/writes agents/*.json
    requirements.txt  # fastapi, uvicorn, python-dotenv
  agents/
    sage.json         # Sage's config (create this)
    trainer.json      # Trainer config (create this)
  .env                # ASSISTANT_PATH=C:/Users/Graham/Projects/Assistant
  start.sh            # boots both frontend and backend
```

### Agent Config Schema (agents/sage.json)
```json
{
  "id": "sage",
  "name": "Sage",
  "role": "Daily planning and brainstorming",
  "type": "Psychic",
  "home_zone": "beach",
  "state": "idle",
  "current_task": null,
  "last_active": null,
  "self_description": "A calm, silver-robed figure with glowing violet eyes and a small floating orb that pulses when thinking.",
  "system_prompt_path": "agents/sage/system_prompt.md",
  "memory_files": ["preferences.md", "tasks.md", "daily_log.md"],
  "tools": ["todoist_api", "google_calendar"],
  "schedule": "0 20 5 * * 1-5"
}
```

### Trainer Config (agents/trainer.json)
```json
{
  "id": "trainer",
  "name": "Prime G",
  "onboarding_complete": true,
  "sprite_variant": "blue"
}
```

### API Response Shape (GET /api/status)
```json
{
  "agents": [
    {
      "id": "sage",
      "name": "Sage",
      "type": "Psychic",
      "state": "idle",
      "current_task": null,
      "zone": "beach"
    }
  ],
  "summary": {
    "open_tasks": 12,
    "tasks_due_today": 3,
    "workout_today": false,
    "last_workout": "2026-03-03",
    "dinner_tonight": null
  },
  "trainer": {
    "name": "Prime G",
    "onboarding_complete": true
  }
}
```

### backend/main.py skeleton
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agent_manager import get_all_agents
from data_reader import get_summary
import json, os
from pathlib import Path

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/status")
def status():
    return {
        "agents": get_all_agents(),
        "summary": get_summary(),
        "trainer": json.loads(Path("agents/trainer.json").read_text())
    }

@app.patch("/api/agents/{agent_id}/state")
def set_state(agent_id: str, body: dict):
    # update agents/{agent_id}.json state field
    path = Path(f"agents/{agent_id}.json")
    config = json.loads(path.read_text())
    config["state"] = body["state"]
    config["current_task"] = body.get("current_task")
    path.write_text(json.dumps(config, indent=2))
    return config
```

### backend/data_reader.py
- Load ASSISTANT_PATH from .env
- Parse tasks.md: count open tasks, find due-today tasks (look for lines with today's date or "today" tag)
- Parse workout_log.md: check if today's date appears in last 5 lines
- Parse dinner_log.md: check if today's date appears with a dinner entry
- Return summary dict

### backend/requirements.txt
```
fastapi
uvicorn[standard]
python-dotenv
```

### start.sh
```bash
#!/bin/bash
echo "Starting AI Controller..."
cd backend && uvicorn main:app --reload --port 8000 &
cd ..
npm run dev
```

### React Side — src/api/useStatus.ts
```typescript
import { useEffect, useState } from 'react'

export function useStatus(intervalMs = 30000) {
  const [status, setStatus] = useState(null)
  const fetch = () =>
    window.fetch('http://localhost:8000/api/status')
      .then(r => r.json()).then(setStatus).catch(console.error)
  useEffect(() => { fetch(); const id = setInterval(fetch, intervalMs); return () => clearInterval(id) }, [])
  return status
}
```

### React → Phaser Bridge (src/components/GameCanvas.tsx)
After creating the Phaser game instance, attach an event emitter reference:
```typescript
// after gameRef.current = new Phaser.Game(...)
window.__phaserEvents = gameRef.current.events
```
Then in App.tsx:
```typescript
const status = useStatus()
useEffect(() => {
  if (!status || !window.__phaserEvents) return
  window.__phaserEvents.emit('statusUpdate', status)
}, [status])
```

### MainScene — listen for status
In `create()`, after spawning creatures:
```typescript
this.game.events.on('statusUpdate', (status) => this.handleStatusUpdate(status))
```
`handleStatusUpdate()` iterates agents, finds matching creature by id, updates name tag color:
- idle → dim violet
- working (any zone) → bright cyan glow pulse added to name tag
- error → red flicker

### Phase 2 Done When
- `npm run dev` + `cd backend && uvicorn main:app` both run without errors
- `/api/status` returns valid JSON
- Browser console shows status polling every 30s
- Sage's name tag glows when state is set to anything non-idle via PATCH endpoint

---

## Phase 3 — Zone Movement + Working Animations

### Goal
Creatures move to the correct zone based on their state. Zone animations intensify with occupancy.
Working animations play while in a zone. Creatures return to beach when done.

### Zone Target Hotspots (add to MainScene.ts)
```typescript
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
  hq: [], // computed from COMP_ANGLES at runtime
}
```

### State → Zone Mapping
```typescript
const STATE_ZONE: Record<string, keyof typeof ZONE_SPOTS> = {
  idle:          'beach',
  done:          'beach',
  error:         'beach',
  researching:   'grass',
  communicating: 'water',
  computing:     'lava',
  thinking:      'hq',
  walking:       'beach', // transient, will be overridden
}
```

### Creature Movement System
Each creature gets a `targetState` property. When `handleStatusUpdate` fires:
1. Compare new state to current
2. If changed: pick a random spot from ZONE_SPOTS[zone]
3. Flip sprite direction toward target
4. Tween to target (2000–4000ms, Sine ease)
5. On arrive: play zone-specific idle animation

### Working Animations per Zone

**Grass (researching):**
- Speed up the existing bob tween (duration: 400ms instead of 900ms)
- Add small green particle burst every 3 seconds (use existing spark texture, tint 0x66bb6a)
- After 3–8 seconds: emit a "found item" — a tiny bright dot rises from creature and fades

**Water (communicating):**
- Slow down bob (duration: 1800ms)
- Add ripple: `this.add.arc(x, y, 5, ...)` that expands to radius 40 and fades — repeat every 2s
- Tint existing water shimmer arcs brighter near the creature

**Lava (computing):**
- Add orange aura: arc at creature position, radius 20, ADD blend, pulses 0→0.6 every 800ms
- Increase ember particle frequency near creature (spawn a focused emitter at creature position)
- Creature bobs faster and with bigger amplitude

**HQ/Computer (thinking):**
- Creature stops bobbing
- Add thought bubble: 3 small white arcs in a diagonal arc above creature head, each pulsing sequentially
- Computer screen at that station brightens (increase flicker alpha)

**Done animation:**
- Small white flash on creature (arc scale 0→2, alpha 1→0 over 600ms)
- Brief particle burst (5–8 sparks scatter outward)
- Then tween to beach

**Error animation:**
- Red flash instead of white
- Creature briefly shakes left-right (tween x: ±5, rapid, 3 times)
- Then slow trudge to beach (longer tween duration: 5000ms)

### Zone Intensity System
Track `zoneOccupancy: Record<string, number>` in MainScene.

When a creature enters a zone:
- `zoneOccupancy[zone]++`
- Scale the zone's emitter frequency: `emitter.setFrequency(baseFreq / (1 + occupancy))`
- Scale lava pool tween durations shorter (more bubbling)
- Scale water shimmer alpha higher

When a creature leaves:
- `zoneOccupancy[zone]--`
- Revert toward baseline

Store references to zone emitters as class fields so they can be adjusted.

### Phase 3 Done When
- Manually PATCH `/api/agents/sage/state` with `{"state": "computing"}` and Sage walks to lava zone and plays fire aura animation
- PATCH back to idle and Sage walks to beach
- Multiple agents in same zone visually intensifies that zone

---

## Phase 4 — Trainer Interactions + UI Overlays

### Goal
Trainer reacts to system state. Clicking creatures/trainer opens React UI panels.
Trainer walks toward agents when interacting.

### Trainer State Machine
Add to MainScene as class field: `trainerState: 'relaxed' | 'alert' | 'busy' | 'stressed'`

State transitions (called from handleStatusUpdate):
- All agents idle → 'relaxed' (slow wandering, existing behavior)
- Any agent in non-idle, non-beach state → 'alert' (trainer stops, faces most active agent)
- Error on any agent → 'stressed' (trainer walks toward errored agent, sweat drop)
- User clicks agent → 'busy' (trainer walks to agent)

### Trainer Alert Behavior
When `trainerState = 'alert'`:
- Cancel ongoing wander tween
- Face toward the most-active agent (scaleX flip)
- Add a small "!" above trainer head: text object `'!'` in yellow, bounce tween
- Remove "!" when state returns to relaxed

### Sweat Drop (Error State)
- Small teardrop shape drawn with graphics at trainer head position +10, -5
- Light blue color (0x90caf9)
- Drip animation: tween y downward 8px, alpha 1→0, repeat 3 times

### Click Interaction Setup
In Phaser, make creature containers interactive:
```typescript
container.setInteractive(new Phaser.Geom.Circle(0, 0, 28), Phaser.Geom.Circle.Contains)
container.on('pointerdown', () => {
  this.game.events.emit('agentClicked', { id: agentId, x: container.x, y: container.y })
})
```
Same for trainer container:
```typescript
trainerContainer.setInteractive(...)
trainerContainer.on('pointerdown', () => {
  this.game.events.emit('trainerClicked', {})
})
```

### React UI Panels

**App.tsx changes:**
```typescript
const [selectedAgent, setSelectedAgent] = useState(null)
const [showCommandPanel, setShowCommandPanel] = useState(false)

useEffect(() => {
  window.__phaserEvents?.on('agentClicked', (data) => setSelectedAgent(data))
  window.__phaserEvents?.on('trainerClicked', () => setShowCommandPanel(true))
}, [])
```

**AgentPanel component (src/components/AgentPanel.tsx):**
- Pokemon-style dialogue box: dark border, light inner, pixel font
- Shows: agent name, type, current state, current task
- Buttons: "Send to Zone", "View History", "Close"
- Position: bottom-center of screen, 600px wide
- Dismiss: click outside or press Escape

**CommandPanel component (src/components/CommandPanel.tsx):**
- Top-right overlay, 280px wide
- Options: "View All Agents", "Add New Agent", "System Status"
- Shows summary data (tasks count, workout status)
- Pixel font, dark tech aesthetic matching the game

**Styling:**
- All UI panels use `font-family: 'Press Start 2P'`
- Dark background: `#0a1628`, border: `2px solid #4dd0e1`
- Text color: `#e0f7fa`
- No rounded corners (GBA aesthetic)
- Box shadow: `0 0 20px rgba(0, 229, 255, 0.3)`

### Trainer Walk-to-Agent
When agentClicked fires and trainer is in 'relaxed' or 'alert' state:
```typescript
// in MainScene
game.events.on('agentClicked', (data) => {
  this.trainerState = 'busy'
  const targetX = data.x + 35  // stand next to agent
  const targetY = data.y
  this.trainerSprite.scaleX = targetX > this.trainerContainer.x ? 1 : -1
  this.tweens.add({
    targets: this.trainerContainer, x: targetX, y: targetY,
    duration: 1200, ease: 'Sine.easeInOut'
  })
})
```

### Phase 4 Done When
- Clicking Sage in the browser opens a panel showing Sage's name, type, and state
- Clicking the trainer opens the command panel
- When Sage's state is set to computing, trainer's "!" appears above their head
- Trainer walks toward Sage when Sage is clicked

---

## Phase 5 — New Game Intro + Agent Onboarding

### Goal
First-run cinematic sequence. Add agent UI flow. Procedural creature generation from type+description.

### First-Run Detection
On app load, check `trainer.json.onboarding_complete`.
If false: load `IntroScene` instead of `MainScene`.
Store this check in React, pass as prop to GameCanvas, GameCanvas passes to Phaser config:
```typescript
scene: [onboardingComplete ? MainScene : IntroScene, MainScene]
```

### IntroScene.ts — Sequence
```
1. Black screen (backgroundColor: #000000)
2. Fade in title text: "AI AGENT CONTROLLER" — Press Start 2P, 24px, white, centered
3. Wait 1800ms
4. Fade out title
5. Dialogue box appears (bottom): "Welcome, Trainer. The world of AI agents awaits."
6. Wait for spacebar or click to advance
7. Dialogue: "What is your name?"
8. Show name input field (HTML input element, positioned over canvas)
9. On confirm: "Welcome, [name]. Your first agent is waiting..."
10. Dialogue: "Choose your look:" — show 3 trainer color variants as clickable sprites
11. On selection: fade to black
12. MainScene loads
13. After 1200ms: dialogue "Something is stirring on the beach..."
14. PokeBall appears at trainer position, arcs to beach center (Phaser tween path)
15. Ball lands, flash effect (white rectangle, alpha 1→0 over 300ms)
16. Sage appears at beach center with scale 0→1 tween (200ms)
17. Sage does bounce animation 3 times, then settles into wander
18. Dialogue: "Sage has joined your team!"
19. Write trainer.json with chosen name + onboarding_complete: true
20. Scene transitions to normal MainScene operation
```

### Pokeball Graphics (drawn at runtime)
```typescript
// Draw in IntroScene or as a texture
const g = this.make.graphics({ add: false })
g.fillStyle(0xff0000); g.fillCircle(12, 12, 12)         // top half red
g.fillStyle(0xffffff); g.fillRect(0, 12, 24, 12)         // bottom half white
g.fillStyle(0x000000); g.fillRect(0, 10, 24, 4)          // center band
g.fillStyle(0xffffff); g.fillCircle(12, 12, 5)           // center button
g.fillStyle(0x000000); g.fillCircle(12, 12, 3)           // center button inner
g.generateTexture('pokeball', 24, 24)
g.destroy()
```

### PokeBall Throw Tween
```typescript
const ball = this.add.image(trainerX, trainerY, 'pokeball')
this.tweens.add({
  targets: ball,
  x: beachCenterX, y: beachCenterY,
  duration: 900,
  ease: 'Sine.easeIn',
  onComplete: () => {
    // flash
    const flash = this.add.rectangle(W/2, H/2, W, H, 0xffffff, 1)
    this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => {
      flash.destroy(); ball.destroy()
      // spawn creature at beach center
      this.spawnSageAt(beachCenterX, beachCenterY)
    }})
  }
})
```

### Add Agent UI Flow (Phase 5 — React)

**"Add Agent" button:** Fixed position bottom-right of screen, always visible in CommandPanel.

**AddAgentModal component:**
- Step 1: Enter name (text input)
- Step 2: Choose type — grid of 18 type buttons, each colored by type theme
- Step 3: Self-description textarea ("Describe what your agent looks like")
- Step 4: Review + Confirm
- On confirm: POST to `/api/agents` → backend creates agents/{name}.json
- Game emits 'agentAdded' event → PokeBall throw animation → new creature on beach

### Procedural Creature Generation

Each type has a generator. The `buildCreatureSprite()` function in MainScene accepts a type and draws a themed creature:

```typescript
const TYPE_THEMES = {
  psychic:  { body: 0x7e57c2, head: 0x9575cd, accent: 0xce93d8, glow: 0xf48fb1, ears: 'pointed' },
  fire:     { body: 0xbf360c, head: 0xe64a19, accent: 0xff8a65, glow: 0xffcc02, ears: 'none' },
  water:    { body: 0x1565c0, head: 0x1976d2, accent: 0x64b5f6, glow: 0x90caf9, ears: 'round' },
  grass:    { body: 0x2e7d32, head: 0x388e3c, accent: 0x81c784, glow: 0xdcedc8, ears: 'leaf' },
  electric: { body: 0xf57f17, head: 0xf9a825, accent: 0xffee58, glow: 0xffffff, ears: 'pointed' },
  ice:      { body: 0x0277bd, head: 0x0288d1, accent: 0x80deea, glow: 0xe0f7fa, ears: 'round' },
  dragon:   { body: 0x4527a0, head: 0x5c35cc, accent: 0x7c4dff, glow: 0x00e5ff, ears: 'horns' },
  dark:     { body: 0x1a1a2e, head: 0x212121, accent: 0x616161, glow: 0x9e9e9e, ears: 'pointed' },
  steel:    { body: 0x546e7a, head: 0x607d8b, accent: 0xb0bec5, glow: 0xeceff1, ears: 'none' },
  ghost:    { body: 0x311b92, head: 0x4527a0, accent: 0x7c4dff, glow: 0xb39ddb, ears: 'none' },
  fairy:    { body: 0xad1457, head: 0xc2185b, accent: 0xf48fb1, glow: 0xfce4ec, ears: 'round' },
  fighting: { body: 0xbf360c, head: 0xd84315, accent: 0xff8a65, glow: 0xffccbc, ears: 'none' },
  poison:   { body: 0x6a1b9a, head: 0x7b1fa2, accent: 0xce93d8, glow: 0xf3e5f5, ears: 'pointed' },
  ground:   { body: 0x4e342e, head: 0x5d4037, accent: 0xa1887f, glow: 0xd7ccc8, ears: 'round' },
  flying:   { body: 0x01579b, head: 0x0277bd, accent: 0x4fc3f7, glow: 0xe1f5fe, ears: 'wing' },
  bug:      { body: 0x33691e, head: 0x558b2f, accent: 0xaed581, glow: 0xdcedc8, ears: 'antenna' },
  rock:     { body: 0x37474f, head: 0x455a64, accent: 0x90a4ae, glow: 0xcfd8dc, ears: 'none' },
  normal:   { body: 0x6d4c41, head: 0x795548, accent: 0xbcaaa4, glow: 0xefebe9, ears: 'round' },
}
```

The `buildCreatureSprite(container, type)` function:
- Draws body ellipse using theme.body
- Draws head circle using theme.head
- Draws ears based on theme.ears variant
- Draws eyes (always white + dark pupil + white highlight)
- Draws blush circles using theme.accent
- Adds floating orb (Psychic), flame (Fire), water droplet (Water) etc. based on type
- Adds type-appropriate idle tween

### Phase 5 Done When
- Fresh clone: opening app shows intro sequence
- After intro: map loads with Sage appearing via PokeBall throw
- "Add Agent" in command panel opens the multi-step form
- Completing the form spawns a new type-themed creature on the beach

---

## Phase 6 — Claude API Integration

### Goal
Real agents execute real tasks via Claude API. State updates in real-time.
The map becomes a live dashboard for actual AI work happening on your machine.

### Backend Architecture

**backend/task_runner.py:**
```python
import anthropic
from pathlib import Path
import json, asyncio
from agent_manager import get_agent, set_agent_state

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

async def run_task(agent_id: str, task: dict):
    agent = get_agent(agent_id)
    zone = detect_zone(task['content'])

    # Set state to walking, then working
    set_agent_state(agent_id, 'walking', task['content'])
    await asyncio.sleep(2)  # simulate walk time
    set_agent_state(agent_id, zone_to_state(zone), task['content'])

    # Build messages
    messages = load_history(agent_id)
    messages.append({"role": "user", "content": task['content']})

    # Call Claude
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=load_system_prompt(agent),
        messages=messages
    )

    result = response.content[0].text

    # Save to history
    messages.append({"role": "assistant", "content": result})
    save_history(agent_id, messages[-40:])  # keep last 40 turns

    # Done
    set_agent_state(agent_id, 'done', None)
    return result
```

**Zone detection:**
```python
def detect_zone(task: str) -> str:
    task_lower = task.lower()
    scores = {
        'grass':  sum(1 for w in ['research','search','find','look','investigate','what is'] if w in task_lower),
        'water':  sum(1 for w in ['email','calendar','message','send','schedule','notify','contact'] if w in task_lower),
        'lava':   sum(1 for w in ['code','compute','run','execute','process','build','analyze data'] if w in task_lower),
        'hq':     sum(1 for w in ['plan','think','decide','brainstorm','organize','prioritize'] if w in task_lower),
    }
    return max(scores, key=scores.get) if max(scores.values()) > 0 else 'hq'

def zone_to_state(zone: str) -> str:
    return {'grass': 'researching', 'water': 'communicating', 'lava': 'computing', 'hq': 'thinking'}[zone]
```

**Todoist Polling (backend/todoist_poller.py):**
```python
import requests, asyncio
from pathlib import Path
import re, json

def get_token():
    src = Path("../sync_todoist.py").read_text()
    return re.search(r'TODOIST_API_TOKEN = "(.+?)"', src).group(1)

async def poll_todoist(run_task_fn):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    seen_task_ids = set()

    while True:
        resp = requests.get("https://api.todoist.com/api/v1/tasks", headers=headers)
        tasks = resp.json()
        for task in tasks:
            if task['id'] not in seen_task_ids:
                if task.get('assignee') == 'sage' or 'sage:' in task['content'].lower():
                    seen_task_ids.add(task['id'])
                    asyncio.create_task(run_task_fn('sage', task))
        await asyncio.sleep(60)
```

### Frontend Real-time Updates

Upgrade polling to SSE (Server-Sent Events) for real-time state:

**backend/main.py — add SSE endpoint:**
```python
from fastapi.responses import StreamingResponse
import asyncio

@app.get("/api/stream")
async def stream():
    async def event_gen():
        while True:
            data = json.dumps(get_all_agents())
            yield f"data: {data}\n\n"
            await asyncio.sleep(2)
    return StreamingResponse(event_gen(), media_type="text/event-stream")
```

**src/api/useStream.ts:**
```typescript
export function useAgentStream() {
  const [agents, setAgents] = useState([])
  useEffect(() => {
    const es = new EventSource('http://localhost:8000/api/stream')
    es.onmessage = (e) => setAgents(JSON.parse(e.data))
    return () => es.close()
  }, [])
  return agents
}
```

### Agent Memory System
- Each agent stores conversation history in `agents/{id}/history.jsonl`
- Each line is a JSON object: `{"role": "user"|"assistant", "content": "...", "timestamp": "..."}`
- On task start: load last 20 exchanges as context
- On task complete: append new exchange
- History viewer in AgentPanel shows last 5 exchanges

### Conversation History Viewer (AgentPanel Phase 6 upgrade)
- Add "History" tab to AgentPanel
- Shows last 5 task/response pairs
- Task text in cyan, response text in white
- Scrollable, pixel font, dark background
- "Export" button copies full history to clipboard

### Live Task Progress (Optional Stretch)
If streaming is implemented:
- Stream Claude's response token by token
- Display streaming text in a "thought bubble" above the creature
- Bubble expands as tokens arrive, truncated to last 200 chars
- On completion, bubble fades out and result goes to history

### Todoist Integration — Marking Tasks Complete
After Sage completes a task:
```python
requests.post(
    f"https://api.todoist.com/api/v1/tasks/{task_id}/close",
    headers={"Authorization": f"Bearer {token}"}
)
```

### ANTHROPIC_API_KEY Setup
- Add to .env: `ANTHROPIC_API_KEY=your_key_here`
- .env is gitignored (already in .gitignore via Vite default)
- Document in README that user must add their own key

### Phase 6 Done When
- Adding "sage: research the best morning routine" to Todoist causes Sage to walk to grass zone and animate
- 60 seconds later Sage is back on the beach
- AgentPanel history tab shows the task + response
- Task is marked complete in Todoist

---

## Cross-Phase Technical Decisions

### Never Do These
- No external tile assets (all art drawn at runtime in Phaser Graphics)
- No paths on the map (creatures wander freely to zone hotspots)
- No Redux or complex state management (React useState is enough)
- No database (markdown files + JSON configs only)
- No auth (local-only tool)

### Always Do These
- Keep all Phaser drawing in MainScene.ts methods, named clearly
- Keep React components thin — they just display data and relay events
- Commit after each working phase before starting the next
- Update BRIEF.md after each session with new "What's Built" entries
- Use `seededVal(x, y)` for any deterministic random placement
- Depth layers: zones=0, borders=2, building=3, lab/equipment=5-7, creatures=10, UI=50+

### File Organization (End State)
```
ai-controller/
  src/
    api/
      useStatus.ts      # polling hook
      useStream.ts      # SSE hook (Phase 6)
    components/
      GameCanvas.tsx    # Phaser mount
      AgentPanel.tsx    # creature click overlay
      CommandPanel.tsx  # trainer click overlay
      AddAgentModal.tsx # new agent flow
    game/
      MainScene.ts      # all Phaser drawing + game logic
      IntroScene.ts     # first-run cinematic (Phase 5)
    App.tsx
  backend/
    main.py
    agent_manager.py
    data_reader.py
    task_runner.py
    todoist_poller.py
    requirements.txt
  agents/
    sage.json
    trainer.json
    sage/
      history.jsonl
      system_prompt.md
  BRIEF.md
  PLANNING.md
  start.sh
  .env (gitignored)
```

---

## Suggested Next Session Start

When picking this up on a new machine or in a new session:
1. Read BRIEF.md for overall vision and current state
2. Read PLANNING.md (this file) for implementation details
3. Run `npm install && npm run dev` to verify it works
4. Start at the next incomplete phase
5. Update BRIEF.md "What's Built" section when done
6. Commit and push before ending session

---
_Generated 2026-03-05 — autonomous planning session by Claude Code_
