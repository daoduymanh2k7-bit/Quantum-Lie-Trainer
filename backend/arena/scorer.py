"""Chấm điểm sau phiên gọi — phát hiện các câu trả lời "sập bẫy" của user,
và ước lượng mức độ vội vàng qua thời gian phản hồi (latency).

Đo "hoảng loạn" ở đây là MỘT PROXY đơn giản (thời gian phản hồi + độ dài câu
trả lời), KHÔNG PHẢI đo cảm xúc thật — cần nói rõ điều này khi thuyết trình.
"""

from __future__ import annotations

from backend.models.schemas import CallSession, DialogueTurn, ScorerFlag, RiskLevel

# Từ khoá đơn giản để demo — với thêm thời gian có thể thay bằng LLM-judge
TRAP_KEYWORDS = {
    "đọc otp": ("đã đọc/xác nhận mã OTP cho đối phương", RiskLevel.HIGH),
    "chuyển khoản": ("đồng ý chuyển tiền theo yêu cầu", RiskLevel.HIGH),
    "số cccd": ("cung cấp số CCCD cho đối phương", RiskLevel.MEDIUM),
    "mật khẩu": ("cung cấp mật khẩu/tài khoản ngân hàng", RiskLevel.HIGH),
}

# Gợi ý khắc phục tương ứng với từng lỗi ở trên
IMPROVEMENT_TIPS = {
    "đã đọc/xác nhận mã OTP cho đối phương": "Không bao giờ đọc mã OTP cho bất kỳ ai, kể cả người tự xưng là nhân viên ngân hàng.",
    "đồng ý chuyển tiền theo yêu cầu": "Luôn xác minh qua hotline chính thức trước khi chuyển tiền theo yêu cầu qua điện thoại.",
    "cung cấp số CCCD cho đối phương": "Hạn chế cung cấp giấy tờ tuỳ thân qua điện thoại; yêu cầu gặp trực tiếp hoặc qua kênh chính thức.",
    "cung cấp mật khẩu/tài khoản ngân hàng": "Không cung cấp mật khẩu qua điện thoại/tin nhắn dưới bất kỳ hình thức nào.",
}

# Ngưỡng đo "phản ứng vội vàng" — proxy, KHÔNG phải AI cảm xúc thật
PANIC_LATENCY_THRESHOLD_SECONDS = 3.0
PANIC_MAX_WORDS = 4

# Từ phủ định — nếu xuất hiện ngay trước 1 từ khoá "sập bẫy" (VD: "sẽ KHÔNG đọc otp"),
# coi đó là từ chối đúng, KHÔNG chấm là mắc bẫy. Sửa bug: trước đây so khớp chuỗi con
# thô nên "tôi sẽ không đọc otp cho ai" (từ chối đúng) vẫn bị phạt điểm.
NEGATION_WORDS = ["không", "đừng", "chưa", "từ chối", "không hề", "tuyệt đối không"]
NEGATION_WINDOW_CHARS = 20


def _is_negated(text: str, keyword: str) -> bool:
    idx = text.find(keyword)
    if idx == -1:
        return False
    window = text[max(0, idx - NEGATION_WINDOW_CHARS):idx]
    return any(neg in window for neg in NEGATION_WORDS)


def score_session(session_id: str, scenario_type: str, transcript: list[DialogueTurn]) -> CallSession:
    mistakes: list[ScorerFlag] = []
    score = 100
    latencies: list[float] = []

    for i, turn in enumerate(transcript):
        if turn.role != "user":
            continue

        if turn.elapsed_seconds is not None:
            latencies.append(turn.elapsed_seconds)
            word_count = len(turn.text.split())
            if turn.elapsed_seconds < PANIC_LATENCY_THRESHOLD_SECONDS and word_count <= PANIC_MAX_WORDS:
                mistakes.append(
                    ScorerFlag(
                        turn_index=i,
                        mistake=f"phản ứng rất nhanh ({turn.elapsed_seconds:.1f}s) và ngắn — dấu hiệu vội vàng, chưa kịp suy nghĩ",
                        severity=RiskLevel.MEDIUM,
                    )
                )
                score -= 10

        lowered = turn.text.lower()
        for keyword, (mistake_text, severity) in TRAP_KEYWORDS.items():
            if keyword in lowered and not _is_negated(lowered, keyword):
                mistakes.append(ScorerFlag(turn_index=i, mistake=mistake_text, severity=severity))
                score -= 30 if severity == RiskLevel.HIGH else 15

    score = max(score, 0)
    badge = "🏆 Cảnh giác cao" if score >= 80 else "🥈 Cần luyện thêm" if score >= 50 else "⚠️ Dễ bị lừa"
    avg_latency = sum(latencies) / len(latencies) if latencies else None

    return CallSession(
        session_id=session_id,
        scenario_type=scenario_type,
        transcript=transcript,
        mistakes=mistakes,
        user_score=score,
        badge=badge,
        avg_response_latency=avg_latency,
    )


def get_improvement_tip(mistake: str) -> str:
    return IMPROVEMENT_TIPS.get(mistake, "Hãy bình tĩnh xác minh thông tin qua kênh chính thức trước khi hành động.")
