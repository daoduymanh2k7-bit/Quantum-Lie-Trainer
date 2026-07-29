"""Test analyzer rule-based - không cần API key, chạy được ngay."""

from backend.vision.analyzer import analyze_text


def test_detects_otp_scam():
    result = analyze_text("Vui lòng đọc mã OTP để xác minh tài khoản, nếu không sẽ bị khóa tài khoản.")
    assert result.risk_level.value in ("MEDIUM", "HIGH")
    assert result.scam_category == "giả mạo ngân hàng"
    assert len(result.red_flags) > 0


def test_detects_lottery_scam():
    result = analyze_text("Chúc mừng bạn trúng thưởng, vui lòng đóng phí nhận thưởng để nhận giải.")
    assert result.scam_category == "trúng thưởng giả"


def test_safe_text_low_risk():
    result = analyze_text("Chào bạn, hẹn gặp lại vào cuối tuần nhé.")
    assert result.risk_level.value == "LOW"
    assert result.red_flags == []
