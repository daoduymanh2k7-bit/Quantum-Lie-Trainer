"""CONTRACT CHUNG — chốt trước khi code, sau đó ai muốn sửa field phải báo người kia.

2 module (kinh_lup, scam_arena) trao đổi dữ liệu qua đúng các model dưới đây,
để 2 người có thể code song song mà không cần chờ nhau.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskAnalysis(BaseModel):
    """Output của module kinh_lup (Financial Lie Detector) cho MỘT ảnh/tin nhắn."""

    input_type: str  # "text" | "image"
    raw_text: str  # nội dung đã đọc được từ ảnh/tin nhắn (OCR do Vision LLM tự làm)
    risk_score: float  # 0-100, trung bình sau N lần chạy Monte Carlo
    risk_score_std: float = 0.0  # độ lệch chuẩn giữa các lần chạy — thể hiện "độ tin cậy"
    risk_level: RiskLevel
    scam_category: str  # "đầu tư giả", "giả mạo ngân hàng", "trúng thưởng"...
    explanation: str  # giải thích ngắn gọn, ngôn ngữ dễ hiểu cho người lớn tuổi
    red_flags: list[str] = Field(default_factory=list)  # các dấu hiệu cụ thể phát hiện được


class DialogueTurn(BaseModel):
    role: str  # "user" | "scammer_ai"
    text: str
    elapsed_seconds: float | None = None  # thời gian user mất để phản hồi lượt trước (chỉ có ý nghĩa với role="user")


class ScorerFlag(BaseModel):
    """Một lần user "sập bẫy" trong lúc tập, ghi lại để hiển thị sau khi kết thúc."""

    turn_index: int
    mistake: str  # ví dụ: "đã đọc số OTP cho đối phương"
    severity: RiskLevel


class CallSession(BaseModel):
    """Output của module scam_arena cho MỘT phiên gọi giả lập."""

    session_id: str
    scenario_type: str  # loại kịch bản: "giả nhân viên ngân hàng", "giả công an"...
    transcript: list[DialogueTurn] = Field(default_factory=list)
    mistakes: list[ScorerFlag] = Field(default_factory=list)
    user_score: int = 100  # bắt đầu 100, trừ điểm theo mistakes
    badge: str | None = None  # gắn khi kết thúc, dựa theo user_score
    avg_response_latency: float | None = None  # giây, trung bình các lượt user — proxy độ vội vàng, KHÔNG phải AI cảm xúc


class CaseStudy(BaseModel):
    """Một case study trong Kho tri thức (Module 3) — biên tập thủ công, không cần AI tổng hợp."""

    case_id: str
    scam_category: str  # dùng chung tên loại với RiskAnalysis.scam_category để liên kết module
    title: str
    summary: str
    takeaway: str  # bài học rút ra, hiển thị ngắn gọn
    source: str = "Tổng hợp từ báo chí"
    video_url: str | None = None
    audio_script: str | None = None  # văn bản dài hơn, tối ưu cho đọc to (dạng "Nghe"); None nếu case chưa có bản audio


class KnowledgeProgress(BaseModel):
    """Tiến độ học của user, lưu ở localStorage (xem frontend/static/js/knowledge.js).

    Model này KHÔNG được backend dùng để lưu trạng thái (server không có DB ở bản
    demo) — khai báo ở đây chỉ để làm tài liệu contract, tránh 2 phía (backend/
    frontend) hiểu khác nhau về hình dạng dữ liệu tiến độ.
    """

    points: int = 0
    streak: int = 0
    last_seen_date: str | None = None  # "YYYY-MM-DD", để tính streak đúng nghĩa (theo NGÀY, không theo lượt bấm)
    seen_case_ids: list[str] = Field(default_factory=list)
    unlocked_achievements: list[str] = Field(default_factory=list)
