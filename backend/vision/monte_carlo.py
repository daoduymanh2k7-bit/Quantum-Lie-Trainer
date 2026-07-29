"""Điểm vào chính cho module Kính Lúp — giữ nguyên tên/API để UI không cần sửa
khi sau này nâng cấp lên AI thật.

PHIÊN BẢN HIỆN TẠI (rule-based): chỉ gọi analyzer 1 lần vì kết quả luôn
xác định (deterministic) — không có gì để lấy trung bình hay đo độ dao động.

Khi nâng cấp lên AI (LLM có temperature > 0), có thể khôi phục lại việc
chạy N lần lấy risk_score trung bình + độ lệch chuẩn để đo "độ tin cậy" —
đây là lý do các trường risk_score_std vẫn được giữ trong contract.
"""

from __future__ import annotations

from backend.models.schemas import RiskAnalysis
from backend.vision.analyzer import analyze_text


def run_monte_carlo(image_bytes: bytes | None = None, text: str | None = None, n_runs: int = 1) -> RiskAnalysis:
    if image_bytes is not None:
        raise NotImplementedError(
            "Chưa hỗ trợ đọc ảnh ở phiên bản rule-based (cần OCR hoặc AI Vision). "
            "Vui lòng dán nội dung text để kiểm tra."
        )
    if not text:
        raise ValueError("Cần cung cấp text để phân tích.")

    return analyze_text(text)
