"""Endpoint cho tính năng Camera Kính Lúp (Financial Lie Detector).

CHỈ bọc lại logic có sẵn ở backend/vision/ — không viết lại thuật toán ở đây.
Nếu sau này đổi sang AI Vision thật (đọc ảnh), chỉ cần sửa
backend/vision/monte_carlo.py và backend/vision/analyzer.py, file này
không cần đổi gì (đúng contract-first, xem backend/models/schemas.py).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models.schemas import RiskAnalysis
from backend.vision.analyzer import get_category_explanation
from backend.vision.monte_carlo import run_monte_carlo

router = APIRouter(prefix="/api/vision", tags=["vision"])


class AnalyzeRequest(BaseModel):
    text: str
    n_runs: int = 1  # số lần chạy Monte Carlo — nhiều hơn thì risk_score_std đáng tin hơn nhưng chậm hơn


@router.post("/analyze", response_model=RiskAnalysis)
def analyze(req: AnalyzeRequest) -> RiskAnalysis:
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Thiếu nội dung cần kiểm tra.")
    return run_monte_carlo(text=req.text, n_runs=req.n_runs)


@router.get("/category-explanation")
def category_explanation(category: str) -> dict:
    """Giải thích chi tiết vì sao 1 loại lừa đảo (scam_category) lại nguy hiểm.

    Dùng query param (?category=...) thay vì path param vì category có dấu
    tiếng Việt và khoảng trắng (vd "giả mạo ngân hàng") — tránh lỗi encode URL.
    """
    return {"category": category, "explanation": get_category_explanation(category)}
