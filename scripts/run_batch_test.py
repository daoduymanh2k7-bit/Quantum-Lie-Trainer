"""Chay toan bo data/fixtures/sample_scam_messages.json qua analyzer,
in ra bang so sanh ket qua that vs ky vong - de do so lieu truoc khi demo.

Chay: python scripts/run_batch_test.py
Khong can API key vi analyzer dang dung luat co dinh (rule-based).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.vision.analyzer import analyze_text

FIXTURES_PATH = Path(__file__).resolve().parent.parent / "data" / "fixtures" / "sample_scam_messages.json"


def main():
    cases = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    correct = 0

    for i, case in enumerate(cases, 1):
        result = analyze_text(case["text"])
        match = result.risk_level.value == case["expected_level"]
        correct += match
        print(f"[{i}] {'OK' if match else 'SAI'} ky vong={case['expected_level']:6} thuc te={result.risk_level.value:6} "
              f"| score={result.risk_score:.0f} | {case['text'][:50]}...")

    print(f"\nKet qua: {correct}/{len(cases)} dung ({correct / len(cases) * 100:.0f}%)")


if __name__ == "__main__":
    main()
