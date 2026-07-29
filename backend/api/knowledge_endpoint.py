"""Endpoint cho tính năng Kho tri thức & Daily Scam Alert (Module 3).

CHỈ bọc lại logic có sẵn ở backend/knowledge/knowledge_base.py. Điểm/streak/
seen_case_ids (KnowledgeProgress) do FRONTEND tự giữ và gửi kèm mỗi request —
API không lưu tiến độ học ở server, giống cách backend/arena/ đang thiết kế.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.knowledge.knowledge_base import get_case_by_id, get_daily_case, get_next_case, load_case_studies
from backend.models.schemas import CaseStudy

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/cases", response_model=list[CaseStudy])
def list_cases() -> list[CaseStudy]:
    return load_case_studies()


@router.get("/cases/{case_id}", response_model=CaseStudy)
def get_case(case_id: str) -> CaseStudy:
    case = get_case_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy case '{case_id}'.")
    return case


class DailyRequest(BaseModel):
    seen_case_ids: list[str] = []


@router.post("/daily", response_model=CaseStudy)
def daily_case(req: DailyRequest) -> CaseStudy:
    return get_daily_case(req.seen_case_ids)


class NextRequest(BaseModel):
    current_case_id: str
    seen_case_ids: list[str] = []


@router.post("/next", response_model=CaseStudy)
def next_case(req: NextRequest) -> CaseStudy:
    current_case = get_case_by_id(req.current_case_id)
    if current_case is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy case '{req.current_case_id}'.")
    return get_next_case(current_case, req.seen_case_ids)
