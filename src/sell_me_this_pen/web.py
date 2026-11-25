from __future__ import annotations

import json
import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from sell_me_this_pen.buy_sell import (
    MAX_SELLER_TRIES,
    MAX_SELLER_WORDS,
    Day,
    GameSession,
    Memory,
    PitchOutcome,
    day_end_message,
    day_end_reason,
    day_to_dict,
)

STATIC_DIR = Path(__file__).resolve().with_name("static")

app = FastAPI(title="Shopkeeper")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class StartRequest(BaseModel):
    mode: Literal["continue", "new"]


class PitchRequest(BaseModel):
    pitch: str


class _Game:
    """The single game this local server plays."""

    def __init__(self) -> None:
        self.session: GameSession | None = None
        self.lock = threading.Lock()


_game = _Game()


@contextmanager
def _exclusive() -> Iterator[None]:
    if not _game.lock.acquire(blocking=False):
        raise HTTPException(409, "The game is still working on the last request.")
    try:
        yield
    finally:
        _game.lock.release()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/state")
def get_state() -> dict:
    return _snapshot()


@app.post("/api/start")
def start_game(request: StartRequest) -> dict:
    with _exclusive():
        saved, _ = _load_saved()
        if request.mode == "continue" and saved is not None:
            memory = saved
        else:
            Memory().clear()
            memory = Memory()
        _game.session = GameSession(memory)
        return _snapshot()


@app.post("/api/day")
def start_day() -> dict:
    with _exclusive():
        session = _require_session()
        try:
            session.start_day()
        except Exception as error:
            raise HTTPException(502, f"Could not generate a buyer: {error}") from error
        return _snapshot()


@app.post("/api/pitch")
def submit_pitch(request: PitchRequest) -> dict:
    with _exclusive():
        session = _require_session()
        if session.pending is None:
            raise HTTPException(409, "No day is open.")
        outcome = session.submit_pitch(request.pitch)
        return {"outcome": _outcome_json(outcome), "state": _snapshot()}


@app.post("/api/pass")
def pass_day() -> dict:
    with _exclusive():
        session = _require_session()
        if session.pending is None:
            raise HTTPException(409, "No day is open.")
        session.pass_day()
        return _snapshot()


@app.post("/api/title")
def return_to_title() -> dict:
    with _exclusive():
        _game.session = None
        return _snapshot()


def _require_session() -> GameSession:
    if _game.session is None:
        raise HTTPException(409, "Start or continue a game first.")
    return _game.session


def _load_saved() -> tuple[Memory | None, str | None]:
    try:
        return Memory.load(), None
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        return None, f"Could not read the saved game: {error}"


def _snapshot() -> dict:
    limits = {"words": MAX_SELLER_WORDS, "tries": MAX_SELLER_TRIES}
    session = _game.session
    if session is None:
        saved, error = _load_saved()
        return {
            "screen": "title",
            "limits": limits,
            "saved": saved.describe() if saved is not None else None,
            "save_error": error,
        }

    days = session.days
    snapshot: dict = {
        "limits": limits,
        "record": {"days": len(days), "sold": sum(1 for day in days if day.sold)},
    }
    if session.pending is not None:
        snapshot["screen"] = "day"
        snapshot["day"] = _day_json(session.pending)
    elif days:
        last = days[-1]
        snapshot["screen"] = "between"
        snapshot["day"] = {
            **_day_json(last),
            "end": day_end_reason(last),
            "end_message": day_end_message(last),
        }
    else:
        snapshot["screen"] = "start"
    return snapshot


def _day_json(day: Day) -> dict:
    return {**day_to_dict(day), "tries_used": len(day.exchanges)}


def _outcome_json(outcome: PitchOutcome) -> dict:
    exchange = outcome.exchange
    return {
        "kind": outcome.kind,
        "message": outcome.message,
        "words": outcome.words,
        "category": outcome.category,
        "traced": outcome.traced,
        "exchange": None
        if exchange is None
        else {
            "seller_said": exchange.seller_said,
            "buyer_said": exchange.buyer_said,
            "convinced": exchange.convinced,
            "mood": exchange.mood,
        },
    }


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    print(f"Shopkeeper is running at http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
