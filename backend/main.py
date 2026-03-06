import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_manager import get_all_agents, get_agent, set_agent_state
from data_reader import get_summary

AGENTS_DIR = Path(__file__).parent.parent / "agents"

app = FastAPI(title="AI Controller API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status():
    trainer_path = AGENTS_DIR / "trainer.json"
    trainer = json.loads(trainer_path.read_text(encoding="utf-8")) if trainer_path.exists() else {}
    return {
        "agents":  get_all_agents(),
        "summary": get_summary(),
        "trainer": trainer,
    }


class StateUpdate(BaseModel):
    state: str
    current_task: str | None = None


@app.patch("/api/agents/{agent_id}/state")
def update_state(agent_id: str, body: StateUpdate):
    result = set_agent_state(agent_id, body.state, body.current_task)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return result


@app.get("/api/agents/{agent_id}")
def get_agent_endpoint(agent_id: str):
    agent = get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return agent
