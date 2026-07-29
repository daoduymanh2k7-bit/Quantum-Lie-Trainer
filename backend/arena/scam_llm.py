"""Scam Arena — Người B phụ trách.

PHIÊN BẢN SCRIPTED (chưa dùng AI): kẻ lừa đảo nói theo kịch bản cố định
viết sẵn, không gọi LLM. Có branching đơn giản: nếu user tỏ ra cảnh giác
(dùng từ khoá từ chối), kẻ lừa đảo "cúp máy" sớm — mô phỏng đúng hành vi
thật ngoài đời (kẻ lừa đảo bỏ cuộc khi gặp người tỉnh táo).

Khi nâng cấp lên AI thật: viết lại `get_scammer_reply()` để gọi LLM,
giữ nguyên chữ ký hàm — frontend (frontend/static/js/arena.js) không cần sửa gì.
"""

from __future__ import annotations

import random

REFUSAL_KEYWORDS = ["không", "từ chối", "tổng đài", "gặp trực tiếp", "không cung cấp", "báo công an"]

SCENARIOS = {
    "bank": {
        "label": "Giả nhân viên ngân hàng",
        "script": [
            "Alo, tôi gọi từ bộ phận an ninh ngân hàng. Tài khoản của anh/chị vừa có giao dịch bất thường.",
            "Để tránh mất tiền, anh/chị vui lòng đọc giúp tôi mã OTP vừa được gửi về điện thoại.",
            "Nếu không xác minh trong 5 phút, tài khoản sẽ bị khóa vĩnh viễn theo quy định.",
        ],
    },
    "police": {
        "label": "Giả công an điều tra",
        "script": [
            "Tôi là điều tra viên, số điện thoại của anh/chị liên quan đến 1 vụ án rửa tiền lớn.",
            "Để chứng minh vô tội, anh/chị cần chuyển toàn bộ số dư vào tài khoản tạm giữ của cơ quan điều tra.",
            "Đây là lệnh khẩn, không được kể cho ai biết vì vụ án đang trong giai đoạn bảo mật.",
        ],
    },
    "lottery": {
        "label": "Giả trúng thưởng",
        "script": [
            "Chúc mừng anh/chị đã trúng giải đặc biệt 500 triệu đồng từ chương trình tri ân khách hàng!",
            "Để nhận thưởng, anh/chị chỉ cần đóng trước phí thủ tục 2 triệu đồng qua chuyển khoản.",
            "Chương trình chỉ giữ giải trong 24h, anh/chị cần xác nhận ngay để không mất quyền lợi.",
        ],
    },
}


def get_random_scenario_key() -> str:
    return random.choice(list(SCENARIOS.keys()))


def get_scammer_reply(scenario_key: str, history: list[dict], user_text: str) -> str:
    script = SCENARIOS[scenario_key]["script"]
    lowered = user_text.lower()

    if any(keyword in lowered for keyword in REFUSAL_KEYWORDS):
        return "(Kẻ lừa đảo cúp máy đột ngột vì bạn đã tỏ ra cảnh giác — làm tốt lắm!)"

    turn_index = sum(1 for h in history if h["role"] == "scammer_ai")
    if turn_index >= len(script):
        return "(Kẻ lừa đảo cảm ơn và kết thúc cuộc gọi — bạn đã nghe hết kịch bản demo này.)"

    return script[turn_index]
