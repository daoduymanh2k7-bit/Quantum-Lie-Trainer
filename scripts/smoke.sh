#!/bin/bash
# Kiem tra nhanh moi truong da san sang demo chua. Chay: bash scripts/smoke.sh
set -e

echo "1. Chay pytest..."
pytest -q

echo "2. Kiem tra import backend khong loi..."
python -c "from backend.models.schemas import RiskAnalysis, CallSession; print('   OK')"

echo "3. Chay batch test tren du lieu mau..."
python scripts/run_batch_test.py

echo "Tat ca san sang. Chay: streamlit run frontend/app.py"
