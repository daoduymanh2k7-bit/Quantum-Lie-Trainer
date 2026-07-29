"""Financial Lie Detector — Người A phụ trách.

PHIÊN BẢN RULE-BASED (chưa dùng AI): phân tích rủi ro bằng cách so khớp
từ khoá nghi vấn, không gọi bất kỳ LLM/API nào. Chạy offline hoàn toàn,
không cần API key, không tốn phí.

Khi sẵn sàng nâng cấp lên AI thật: chỉ cần viết lại hàm `analyze_text()`
bên dưới để gọi Claude Vision thay vì so khớp từ khoá — vì `RiskAnalysis`
(contract) không đổi, phần UI và monte_carlo.py không cần sửa gì.
"""

from __future__ import annotations

from backend.models.schemas import RiskAnalysis

# Từ khoá theo từng loại lừa đảo. Danh sách này chỉ mang tính demo,
# nên bổ sung thêm từ khoá thật khi thu thập được nhiều mẫu hơn.
RISK_KEYWORDS: dict[str, list[str]] = {
    "trúng thưởng giả": ["trúng thưởng", "nhận giải", "phí nhận thưởng", "chương trình tri ân"],
    "giả mạo ngân hàng": ["mã otp", "otp", "khóa tài khoản", "xác minh tài khoản", "đóng băng"],
    "đầu tư giả": ["lãi suất", "sinh lời", "đầu tư", "cam kết hoàn vốn", "lợi nhuận"],
    "giả công an/cơ quan chức năng": ["công an", "cơ quan điều tra", "rửa tiền", "tài khoản tạm giữ"],
}

# Mỗi từ khoá khớp cộng thêm ngần này điểm rủi ro (tối đa 100)
POINTS_PER_MATCH = 30

# Giải thích chi tiết cho nút "Tại sao rủi ro này lại nguy hiểm?"
CATEGORY_DETAILS: dict[str, str] = {
    "trúng thưởng giả": (
        "Lừa đảo trúng thưởng luôn yêu cầu bạn đóng tiền TRƯỚC khi nhận thưởng — "
        "không có chương trình trúng thưởng hợp pháp nào bắt người thắng trả phí trước."
    ),
    "giả mạo ngân hàng": (
        "Ngân hàng thật KHÔNG BAO GIỜ gọi điện hỏi mã OTP, mật khẩu, hay yêu cầu xác minh "
        "tài khoản qua điện thoại/tin nhắn. Mọi yêu cầu như vậy đều là lừa đảo."
    ),
    "đầu tư giả": (
        "Cam kết lãi suất cao bất thường hoặc \"cam kết hoàn vốn\" là dấu hiệu kinh điển "
        "của mô hình lừa đảo kiểu Ponzi — lấy tiền người sau trả người trước."
    ),
    "giả công an/cơ quan chức năng": (
        "Cơ quan điều tra thật không làm việc qua điện thoại và không yêu cầu chuyển tiền "
        "vào \"tài khoản tạm giữ\". Đây luôn là lừa đảo, dù người gọi có vẻ chuyên nghiệp."
    ),
}


def get_category_explanation(category: str) -> str:
    return CATEGORY_DETAILS.get(category, "Chưa có giải thích chi tiết cho loại này trong danh sách hiện có.")


def analyze_text(text: str) -> RiskAnalysis:
    """Phân tích 1 đoạn text bằng luật cố định — không gọi AI."""
    lowered = text.lower()

    best_category = "Không phát hiện"
    best_flags: list[str] = []

    for category, keywords in RISK_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in lowered]
        if len(hits) > len(best_flags):
            best_category = category
            best_flags = hits

    score = min(100.0, len(best_flags) * POINTS_PER_MATCH)
    level = "LOW" if score < 34 else "MEDIUM" if score < 67 else "HIGH"

    if best_flags:
        explanation = (
            f"Phát hiện {len(best_flags)} dấu hiệu nghi vấn liên quan đến '{best_category}': "
            + ", ".join(best_flags)
            + ". Đây là kết quả từ so khớp từ khoá cố định, chưa dùng AI."
        )
    else:
        explanation = (
            "Không phát hiện từ khoá nghi vấn nào trong danh sách hiện có. "
            "Lưu ý: đây là phiên bản rule-based đơn giản, có thể bỏ sót các chiêu lừa mới."
        )

    return RiskAnalysis(
        input_type="text",
        raw_text=text,
        risk_score=score,
        risk_score_std=0.0,  # không cần đo dao động vì luật cố định, kết quả luôn giống nhau
        risk_level=level,
        scam_category=best_category,
        explanation=explanation,
        red_flags=best_flags,
    )
