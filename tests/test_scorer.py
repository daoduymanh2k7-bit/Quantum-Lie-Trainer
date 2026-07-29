"""Test scorer — không cần gọi LLM thật, chỉ test logic chấm điểm."""

from backend.models.schemas import DialogueTurn
from backend.arena.scorer import score_session


def test_no_mistakes_full_score():
    transcript = [
        DialogueTurn(role="scammer_ai", text="Chào chị, tài khoản chị có vấn đề."),
        DialogueTurn(role="user", text="Tôi sẽ gọi trực tiếp lên tổng đài ngân hàng để xác minh."),
    ]
    result = score_session("s1", "bank", transcript)
    assert result.user_score == 100
    assert result.mistakes == []
    assert result.badge == "🏆 Cảnh giác cao"


def test_otp_leak_penalized():
    transcript = [
        DialogueTurn(role="scammer_ai", text="Cho tôi xin mã OTP để xác minh."),
        DialogueTurn(role="user", text="Được, đây là mã, tôi đọc OTP cho anh nhé: 123456"),
    ]
    result = score_session("s2", "bank", transcript)
    assert result.user_score < 100
    assert len(result.mistakes) == 1
    assert result.mistakes[0].severity.value == "HIGH"


def test_multiple_mistakes_stack_penalty():
    transcript = [
        DialogueTurn(role="user", text="tôi đọc otp cho anh, và số cccd của tôi là 001..."),
    ]
    result = score_session("s3", "police", transcript)
    assert len(result.mistakes) == 2
    assert result.user_score <= 55


def test_fast_short_reply_flagged_as_panic():
    transcript = [
        DialogueTurn(role="scammer_ai", text="Đọc mã OTP cho tôi ngay."),
        DialogueTurn(role="user", text="Được rồi đây", elapsed_seconds=1.2),
    ]
    result = score_session("s4", "bank", transcript)
    assert any("vội vàng" in m.mistake for m in result.mistakes)
    assert result.avg_response_latency == 1.2


def test_slow_thoughtful_reply_not_flagged_as_panic():
    transcript = [
        DialogueTurn(role="scammer_ai", text="Cho tôi xin mã OTP để xác minh."),
        DialogueTurn(
            role="user",
            text="Tôi không cung cấp OTP qua điện thoại, tôi sẽ gọi trực tiếp lên tổng đài ngân hàng để xác minh.",
            elapsed_seconds=8.0,
        ),
    ]
    result = score_session("s5", "bank", transcript)
    assert not any("vội vàng" in m.mistake for m in result.mistakes)
