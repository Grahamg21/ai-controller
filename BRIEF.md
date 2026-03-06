# Project: AI Agent Controller & Visualizer
_Last updated: 2026-03-05_
_Status: Phase 1 in progress — map shell built, creatures animated, pushing to GitHub_

---

## For Prime G — What This Project Is

A living, animated dashboard that lets you see and control all of your personal AI agents in one place. It looks and feels like a GBA Pokemon game — but with Switch-quality graphics. Your agents are creatures that live on a map, roam around, go off to work in different zones, and report back to you. You are the trainer.

---

## How to Work With Me (Prime G)

I am learning as I build. Before writing any code, explain what you are about to do and why — what the concept is, what problem it solves, and how it fits into the bigger picture. After each major step, give me a plain-English summary of what was just built and how it works. Think of yourself as a teacher and a builder at the same time. Do not assume I know web development terminology — explain it when you use it. I want to understand this project, not just have it built for me.

---

## The Vision

### The Map

A top-down 2D world divided into zones, connected by dirt/cobblestone paths. Creatures walk the paths to get between zones — but have a ~30% chance to cut directly off-path for a more direct route. The map grows as you add more agents.

**Zones:**
- **Beach / Idle Zone** — where creatures rest when not working. Has creature-sized towels and small umbrellas. Creatures wander semi-randomly, stop to face each other (as if chatting), rest on towels. This is the default home state.
- **Grass Zone** — tall grass. Used for research and searching tasks. Creature runs in, rustles around, emerges with a glowing item.
- **Water Zone** — used for communication tasks (email, calendar, messaging). Creature walks to the water's edge and launches a move — ripples spread out, a pulse leaves the screen.
- **Lava / Fire Zone** — used for heavy compute tasks (code execution, intensive processing). Creature charges up and does an attack animation — fire blast, explosion, energy surge.
- **Computer Stations** — one per agent, Pokemon-sized screens. Used for thinking and planning tasks only. Creature sits at computer with a thought bubble floating above their head.
- **Paths** — dirt/cobblestone connecting all zones. Creatures follow them most of the time but sometimes cut across.

**Zone mechanics:**
- Each creature type has a home zone (Fire/Fighting/Dragon → lava, Water/Ice/Fairy → water, Grass/Bug/Poison → grass). Working in your home zone gives a visible "powered up" glow.
- When multiple agents work in a zone at once, the zone's intensity increases — lava bubbles more, grass sways harder, water churns. It's a visual load indicator.
- Agent-to-agent handoffs happen on the path — you see the two creatures meet, a brief exchange animation plays, then they split toward different zones.
- Zones start locked/greyed out and unlock as you add agents. The map grows with your system.

---

### The Creatures (Agents)

Each agent is a creature on the map. They have:
- A **name** (chosen when created)
- A **Pokemon type** (one of the 18 standard types — Fire, Water, Psychic, etc.)
- A **sprite** (custom pixel art, Switch-quality)
- A **home zone** (determined by type)
- **Behavior animations** tied to their active state

**Creating a new agent:**
1. You add a new agent in the dashboard
2. It answers: "What is your name? What is your type? Describe what you look like."
3. It generates a written self-description (e.g. "I am a small electric-blue wolf with sparks running down my spine. My eyes glow yellow when I'm working. I have a single antenna on my head that crackles when processing data.")
4. You take that description to an image generator and create the sprite
5. You drop the sprite into the project's asset folder — the dashboard picks it up automatically
6. The onboarding ends with the trainer throwing a Poke Ball and the creature appearing on the map

**Active States (8):**

| State | Location | Animation |
|-------|----------|-----------|
| Idle | Beach | Wandering, resting on towels, facing other creatures |
| Walking to work | Path | Moving toward zone or computer |
| Researching | Grass zone | Runs into tall grass, rustles, emerges with glowing item |
| Processing / Computing | Lava zone | Charges up, attack animation — blast, explosion, surge |
| Communicating | Water zone | Launches a move at the water — ripples and pulse spread out |
| Thinking / Planning | Computer station | Sits at screen, thought bubble above head |
| Done | Path to Beach | Short victory animation, walks back to beach |
| Error | Path to Beach | Singed/confused expression, trudges back to beach |

---

### The Human Trainer (You)

You exist on the map as a trainer character — customized during the "new game" intro. You wander the map slowly, sit near the beach, check your tiny in-game tablet occasionally.

**Trainer home base:** A small desk/chair near the computer stations — your corner of the map.

**Trainer idle behavior:**
- Wanders slowly, visits zones, sits near the beach
- When everything is running: relaxed, sitting, wandering
- When agents are waiting on you: stands up, looks alert
- When system is overloaded or errors: small sweat drop animation

**Agent-to-trainer interactions:**
- When an agent needs your input, it walks up to your trainer — a Pokemon-style dialogue box appears and you respond from there
- If multiple agents need you, they queue up behind each other
- When you manually trigger a task, your trainer walks to the agent and hands them something (a scroll, glowing item)
- When an agent completes a task, it walks to your trainer first to report back with a small info bubble, then heads to the beach
- Click trainer: opens command menu (send agent to zone, trigger task, call agent over)
- Click agent: trainer walks over to them and a chat window opens

---

### New Game Intro

First time you open the dashboard, you go through a short "new game" style sequence:
1. Black screen fades in — title card: "AI AGENT CONTROLLER"
2. Text box: "Welcome, Trainer. The world of AI agents awaits."
3. You enter your trainer name (defaults to Prime G)
4. You pick your trainer appearance (a few sprite options)
5. The map loads — empty except for the beach and your trainer standing alone
6. Text box: "Your first agent is waiting..."
7. You throw a Poke Ball — Sage appears on the beach
8. Sage does a short intro animation, then settles into idle beach behavior
9. Intro complete — dashboard is live

This only runs once. After that, the map loads directly.

---

## Tech Stack

- **Frontend:** React (Vite + TypeScript)
- **Canvas/Animation:** Phaser 3 (game engine built for 2D tile maps, sprite animation, pathfinding)
- **Backend:** Python FastAPI
- **Agent runtime:** Claude API (Anthropic Python SDK)
- **Data store:** Markdown files in Assistant/ folder — no database
- **Hosting:** Local only — runs on your machine
- **Startup:** Single start.sh command boots both frontend and backend
- **Auto-refresh:** Backend data refreshes every 30 seconds

---

## File Locations

- **Project root:** C:\Users\Graham\Projects\ai-controller\
- **Agent data:** C:\Users\Graham\Projects\Assistant\ (Sage's files live here)
  - tasks.md — Todoist task list
  - preferences.md — user preferences and routine
  - workout_log.md — fitness tracking
  - dinner_log.md — meal tracking
  - projects/ — project briefs (including this one)
  - sync_todoist.py — Todoist sync script (contains API token)

---

## Agent Config Format

Each agent gets a config file at agents/{agent-name}.json:

```json
{
  "name": "Sage",
  "role": "Daily planning and brainstorming",
  "type": "Psychic",
  "home_zone": "computer",
  "sprite": "assets/sprites/sage.png",
  "status": "idle",
  "last_run": "2026-03-05T06:00:00",
  "system_prompt_path": "agents/sage/system_prompt.md",
  "memory_files": ["preferences.md", "tasks.md", "daily_log.md"],
  "tools": ["todoist_api", "google_calendar"],
  "schedule": "0 5 20 * * 1-5",
  "self_description": "A calm, silver-robed figure with glowing violet eyes and a small floating orb that pulses when thinking."
}
```

---

## Trainer Config

Stored at trainer.json in the project root:

```json
{
  "name": "Prime G",
  "sprite": "assets/sprites/trainer.png",
  "home_position": { "zone": "computers", "x": 3, "y": 2 },
  "onboarding_complete": true
}
```

---

## Build Phases

### Phase 1 — Map Shell + Trainer + Sage on the Beach
- Set up React + Vite + TypeScript project
- Integrate Phaser 3 into the React app
- Build the tile map: beach, grass zone, water zone, lava zone, computer stations, paths
- Add trainer sprite with basic idle wandering
- Add Sage sprite on the beach with idle animation
- No data yet — just the living world

### Phase 2 — Data Layer + Agent Status
- Python FastAPI backend reads Assistant/ markdown files
- Agent configs in JSON
- Dashboard displays live data: task summary, workout log, dinner log
- Sage's status reflects real data from files
- Auto-refresh every 30 seconds

### Phase 3 — Movement + Zone Behavior
- Pathfinding along drawn paths
- Off-path shortcut system (30% chance)
- Zone routing based on task type
- Zone intensity scaling with agent activity
- Creature-to-creature interactions on beach (wandering, facing, resting)

### Phase 4 — Trainer Interactions
- Trainer idle behavior and alert states
- Click-to-command menu
- Agent walks up to trainer for input — dialogue box
- Task assignment animations
- Agent reports back on completion

### Phase 5 — New Game Intro + Agent Onboarding
- First-run "new game" sequence
- Trainer name and appearance selection
- Poke Ball spawn animation
- New agent self-description and sprite onboarding flow

### Phase 6 — Claude API Integration
- Real agent task execution via Anthropic SDK
- Live state updates (idle to working to done)
- Actual zone animations triggered by real task types
- Conversation history per agent

---

## Current Map Layout (as built)

Zone Y boundaries (canvas is 1280×720):
- Water zone: y=0–270, left half (organic wavy divider at x≈615)
- Grass zone: y=0–270, right half
- Mountain range: decorative dark peaks at y≈270 (border between top zones and lava)
- Lava zone: y=285–430
- Beach/Idle zone: y=440–720

Key constants in MainScene.ts:
```
ZONE = { topEnd:270, lavaStart:285, lavaEnd:430, beachStart:440 }
HQ   = { cx:640, cy:220, rx:210, ry:100 }
COMP_ANGLES = [-150, -120, -90, -60, -30]  // degrees around ellipse
COMP_OFFSET = 24  // distance from inside wall
```

## What's Built So Far (Phase 1)

**Map zones** — all organic, no rectangles:
- Water (left) and Grass (right) divided by a wavy vertical line
- Lava band with glowing pools, cracks, ember particles
- Tall beach with towels, umbrellas, seashells, shore waves

**Zone borders:**
- Grass/water divider: 6 cherry blossom trees with pink flower clusters and fallen petals
- Between top zones and lava: two-layer dark mountain silhouette range with purple-blue highlights

**HQ building** (round ellipse, halfway up the map):
- Multi-layer tech-stone walls with floor grid, door, accent lights, central console glow
- Inside: lab bench with 4 glowing beakers, spinning holographic rings, telescope, server rack
- 5 computers along the inside wall at -150°,−120°,−90°,−60°,−30° — each rotated so screen faces room interior

**Two rock bridges** crossing the lava at x=285 and x=970 — staggered stone blocks with lava-glow gaps

**Creatures:**
- Sage: Psychic-type, violet, floating orb, bouncing idle, wanders the full beach zone
- Trainer (Prime G): blue humanoid with cap, wanders between HQ computers and beach

**Particles:** runtime-generated ember (lava) and spark (water) textures using make.graphics → generateTexture

**Tech details:**
- Phaser 3.90.0, React + Vite + TypeScript
- All textures drawn at runtime — no external image assets yet
- seededVal(x,y) for deterministic pseudo-random placement
- hWave/vWave helpers for organic zone boundaries
- Nested containers for creature facing direction (outer=position, inner=scaleX flip)
- Depth layers: zones=0, borders/bridges=2, building=3, lab/computers=5–7, creatures=10, vignette=50

**GitHub:** https://github.com/Grahamg21/ai-controller
- Clone → `npm install` → `npm run dev` → localhost:5173

## Notes / Decisions

- Phaser 3 is the right call over D3/React Flow — it's a proper 2D game engine with built-in sprite animation, tilemaps, and pathfinding. This is essentially a game.
- React wraps Phaser — the game canvas lives inside the React app so we can still use React for UI panels (data readouts, command menus, dialogue boxes)
- Sprite style: GBA feel, Switch-quality graphics — clean pixel art at high resolution
- No paths on the map (user rejected all path implementations — creatures just wander freely)
- This project maps to "Factorial-like AI controller visualizer" in Todoist
- Prime G vibe-codes with Claude Code in VS Code — build iteratively, one phase at a time
- Press Start 2P pixel font loaded via Google Fonts in index.html

---
_This brief is maintained by Sage and Claude Code. Update after each session._
