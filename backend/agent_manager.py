import json
from pathlib import Path

AGENTS_DIR = Path(__file__).parent.parent / "agents"


def get_all_agents() -> list[dict]:
    agents = []
    for f in AGENTS_DIR.glob("*.json"):
        if f.stem == "trainer":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            agents.append({
                "id":           data.get("id", f.stem),
                "name":         data.get("name", f.stem),
                "type":         data.get("type", "Normal"),
                "state":        data.get("state", "idle"),
                "current_task": data.get("current_task"),
                "zone":         _state_to_zone(data.get("state", "idle")),
            })
        except Exception:
            pass
    return agents


def get_agent(agent_id: str) -> dict | None:
    path = AGENTS_DIR / f"{agent_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def set_agent_state(agent_id: str, state: str, current_task: str | None = None) -> dict | None:
    path = AGENTS_DIR / f"{agent_id}.json"
    if not path.exists():
        return None
    config = json.loads(path.read_text(encoding="utf-8"))
    config["state"] = state
    config["current_task"] = current_task
    path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config


def _state_to_zone(state: str) -> str:
    mapping = {
        "idle":          "beach",
        "done":          "beach",
        "error":         "beach",
        "researching":   "grass",
        "communicating": "water",
        "computing":     "lava",
        "thinking":      "hq",
        "walking":       "beach",
    }
    return mapping.get(state, "beach")
