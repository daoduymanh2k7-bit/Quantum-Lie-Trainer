"""Kho tri thức & Daily Scam Alert — Module 3.

PHIÊN BẢN RULE-BASED: case study được biên tập thủ công bởi đội ngũ (đúng tinh
thần "đội ngũ duyệt trước khi phát hành" trong ý tưởng gốc) — không cần AI tổng
hợp ngay từ đầu, kể cả ở sản phẩm thật cũng cần bước duyệt này.

Nâng cấp sau này: thêm hàm generate_daily_case() gọi LLM để GỢI Ý case mới,
nhưng vẫn giữ bước con người duyệt trước khi thêm vào case_studies.json.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from backend.models.schemas import CaseStudy

FIXTURES_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "case_studies.json"

_cases_cache: list[CaseStudy] | None = None


def load_case_studies() -> list[CaseStudy]:
    global _cases_cache
    if _cases_cache is None:
        raw = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
        _cases_cache = [CaseStudy(**item) for item in raw]
    return _cases_cache


def get_case_by_id(case_id: str) -> CaseStudy | None:
    return next((c for c in load_case_studies() if c.case_id == case_id), None)


def get_daily_case(seen_case_ids: list[str]) -> CaseStudy:
    """Chọn 1 case chưa xem; hết case chưa xem thì random lại toàn bộ."""
    cases = load_case_studies()
    unseen = [c for c in cases if c.case_id not in seen_case_ids]
    return random.choice(unseen if unseen else cases)


def get_next_case(current_case: CaseStudy, seen_case_ids: list[str]) -> CaseStudy:
    """Gợi ý case tiếp theo — ưu tiên cùng scam_category và chưa xem."""
    cases = load_case_studies()

    same_category_unseen = [
        c
        for c in cases
        if c.scam_category == current_case.scam_category
        and c.case_id != current_case.case_id
        and c.case_id not in seen_case_ids
    ]
    if same_category_unseen:
        return random.choice(same_category_unseen)

    unseen = [c for c in cases if c.case_id not in seen_case_ids and c.case_id != current_case.case_id]
    if unseen:
        return random.choice(unseen)

    others = [c for c in cases if c.case_id != current_case.case_id]
    return random.choice(others) if others else current_case
