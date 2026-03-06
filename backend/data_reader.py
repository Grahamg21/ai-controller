import os
import re
from pathlib import Path
from datetime import date
from dotenv import load_dotenv

load_dotenv()

ASSISTANT_PATH = Path(os.getenv("ASSISTANT_PATH", "C:/Users/Graham/Projects/Assistant"))
TODAY = date.today().isoformat()  # e.g. "2026-03-06"


def get_summary() -> dict:
    return {
        "open_tasks":     _count_open_tasks(),
        "tasks_due_today": _count_tasks_due_today(),
        "workout_today":  _workout_today(),
        "last_workout":   _last_workout_date(),
        "dinner_tonight": _dinner_tonight(),
    }


def _count_open_tasks() -> int:
    tasks_file = ASSISTANT_PATH / "tasks.md"
    if not tasks_file.exists():
        return 0
    text = tasks_file.read_text(encoding="utf-8")
    return len(re.findall(r"^- \[ \]", text, re.MULTILINE))


def _count_tasks_due_today() -> int:
    tasks_file = ASSISTANT_PATH / "tasks.md"
    if not tasks_file.exists():
        return 0
    text = tasks_file.read_text(encoding="utf-8")
    # Look for open tasks that mention today's date or "(today)"
    today_short = TODAY[5:]  # "03-06"
    count = 0
    for line in text.splitlines():
        if line.startswith("- [ ]") and (TODAY in line or today_short in line or "today" in line.lower()):
            count += 1
    return count


def _workout_today() -> bool:
    log_file = ASSISTANT_PATH / "workout_log.md"
    if not log_file.exists():
        return False
    text = log_file.read_text(encoding="utf-8")
    return TODAY in text


def _last_workout_date() -> str | None:
    log_file = ASSISTANT_PATH / "workout_log.md"
    if not log_file.exists():
        return None
    text = log_file.read_text(encoding="utf-8")
    # Find all date entries in the workout log table (format: | 2026-03-03 |)
    dates = re.findall(r"\|\s*(\d{4}-\d{2}-\d{2})\s*\|", text)
    if not dates:
        return None
    return sorted(set(dates))[-1]


def _dinner_tonight() -> str | None:
    dinner_file = ASSISTANT_PATH / "dinner_log.md"
    if not dinner_file.exists():
        return None
    text = dinner_file.read_text(encoding="utf-8")
    # Look for today's date in the dinner log table
    for line in text.splitlines():
        if TODAY in line and "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            # Table columns: Date | Day | Meal | Notes — meal is index 2
            if len(parts) >= 3:
                return parts[2]
    return None
