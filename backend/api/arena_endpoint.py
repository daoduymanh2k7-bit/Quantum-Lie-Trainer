"""Endpoint cho tính năng Scam Arena — mô phỏng cuộc gọi lừa đảo để luyện phản xạ.

CHỈ bọc lại logic có sẵn ở backend/arena/ — không viết lại kịch bản hay cách
chấm điểm ở đây. Frontend (đã tách khỏi Streamlit) chịu trách nhiệm giữ state
của phiên chơi (session_id, history, scenario_key) và gửi kèm mỗi request —
API này không lưu session ở server, đúng với cách các hàm gốc đã được thiết
kế (score_session/get_scammer_reply đều nhận đủ state qua tham số).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.arena.scam_llm import SCENARIOS, get_random_scenario_key, get_scammer_reply
from backend.arena.scorer import get_improvement_tip, score_session
from backend.models.schemas import CallSession, DialogueTurn

router = APIRouter(prefix="/api/arena", tags=["arena"])


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    return [{"key": key, "label": scenario["label"]} for key, scenario in SCENARIOS.items()]


@router.get("/scenarios/random")
def random_scenario() -> dict:
    key = get_random_scenario_key()
    return {"key": key, "label": SCENARIOS[key]["label"]}


class ReplyRequest(BaseModel):
    scenario_key: str
    history: list[DialogueTurn] = []  # các lượt hội thoại TRƯỚC lượt user_text hiện tại
    user_text: str


@router.post("/reply")
def reply(req: ReplyRequest) -> dict:
    if req.scenario_key not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy kịch bản '{req.scenario_key}'.")
    history_dicts = [turn.model_dump() for turn in req.history]
    reply_text = get_scammer_reply(req.scenario_key, history_dicts, req.user_text)
    return {"reply": reply_text}


class ScoreRequest(BaseModel):
    session_id: str
    scenario_type: str
    transcript: list[DialogueTurn]


@router.post("/score", response_model=CallSession)
def score(req: ScoreRequest) -> CallSession:
    return score_session(req.session_id, req.scenario_type, req.transcript)


@router.get("/tip")
def tip(mistake: str) -> dict:
    return {"mistake": mistake, "tip": get_improvement_tip(mistake)}
