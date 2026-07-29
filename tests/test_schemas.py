"""Test contract — đảm bảo schema dùng chung giữa 2 module luôn hợp lệ."""

from backend.models.schemas import RiskAnalysis, RiskLevel, CallSession, DialogueTurn, ScorerFlag


def test_risk_analysis_valid():
    r = RiskAnalysis(
        input_type="text",
        raw_text="mẫu test",
        risk_score=80,
        risk_level=RiskLevel.HIGH,
        scam_category="giả ngân hàng",
        explanation="giải thích test",
        red_flags=["dấu hiệu 1"],
    )
    assert r.risk_level == RiskLevel.HIGH
    assert r.risk_score == 80


def test_call_session_default_score():
    session = CallSession(session_id="s1", scenario_type="bank")
    assert session.user_score == 100
    assert session.mistakes == []


def test_call_session_with_transcript():
    turns = [DialogueTurn(role="user", text="alo")]
    flags = [ScorerFlag(turn_index=0, mistake="test", severity=RiskLevel.MEDIUM)]
    session = CallSession(session_id="s2", scenario_type="police", transcript=turns, mistakes=flags)
    assert len(session.transcript) == 1
    assert len(session.mistakes) == 1
