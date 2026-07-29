"""Test Module 3 — Kho tri thức & Daily Scam Alert."""

from backend.knowledge.knowledge_base import get_case_by_id, get_daily_case, get_next_case, load_case_studies


def test_load_case_studies_not_empty():
    cases = load_case_studies()
    assert len(cases) >= 5
    assert all(c.case_id for c in cases)


def test_get_case_by_id_found_and_not_found():
    cases = load_case_studies()
    first_id = cases[0].case_id
    assert get_case_by_id(first_id) is not None
    assert get_case_by_id("khong-ton-tai") is None


def test_daily_case_prefers_unseen():
    cases = load_case_studies()
    all_ids_except_last = [c.case_id for c in cases[:-1]]
    result = get_daily_case(all_ids_except_last)
    assert result.case_id == cases[-1].case_id


def test_next_case_prefers_same_category():
    cases = load_case_studies()
    current = cases[0]
    same_category_others = [c for c in cases if c.scam_category == current.scam_category and c.case_id != current.case_id]
    if same_category_others:
        next_case = get_next_case(current, seen_case_ids=[])
        assert next_case.scam_category == current.scam_category


def test_next_case_never_returns_current_when_alternatives_exist():
    cases = load_case_studies()
    current = cases[0]
    next_case = get_next_case(current, seen_case_ids=[])
    assert next_case.case_id != current.case_id
