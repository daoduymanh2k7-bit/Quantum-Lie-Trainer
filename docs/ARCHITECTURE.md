# Kiến trúc dự án

## Sơ đồ luồng dữ liệu

```
Tin nhắn text/giọng nói ──► backend/vision (rule-based) ──► frontend (Camera Kính Lúp)
Giọng nói               ──► backend/arena (scripted)     ──► frontend (Scam Arena)
Case study thủ công     ──► backend/knowledge             ──► frontend (Kho tri thức)
```

## Phiên bản hiện tại: rule-based, chưa dùng AI

Quyết định có chủ đích: bản demo đầu tiên **không gọi LLM/API nào**, để:
- Chạy được ngay, không cần xin API key, không phát sinh chi phí.
- Dễ viết test tự động (`tests/`) vì kết quả luôn xác định (deterministic).
- Team có thể tập trung hoàn thiện UI/UX và luồng sản phẩm trước, thêm AI sau.

| Module | Cách hoạt động hiện tại |
|---|---|
| `backend/vision/analyzer.py` | So khớp từ khoá theo danh sách `RISK_KEYWORDS`, cộng điểm theo số từ khoá khớp |
| `backend/arena/scam_llm.py` | Kịch bản hội thoại cố định (`SCENARIOS[...]["script"]`), có nhánh rẽ đơn giản khi user dùng từ khoá từ chối |
| `backend/knowledge/knowledge_base.py` | Case study biên tập thủ công trong `case_studies.json` — **module này không cần AI ngay từ đầu**, vì "đội ngũ duyệt trước khi phát hành" trong ý tưởng gốc vốn đã là con người làm, kể cả ở sản phẩm thật |

Lưu ý riêng cho Scam Arena: chỉ số "độ vội vàng" trong `scorer.py` được đo bằng
thời gian phản hồi (latency) + độ dài câu trả lời — đây là **proxy**, không phải
đo cảm xúc/AI thật, cần nói rõ khi thuyết trình.

## Đường nâng cấp lên AI thật (sau này)

Nhờ tách contract (`backend/models/schemas.py`) từ đầu, khi muốn thêm AI
thật, chỉ cần sửa **đúng các file logic**, không đụng vào UI hay contract:

1. `backend/vision/analyzer.py` — viết lại `analyze_text()` để gọi Claude
   Vision (đọc được cả ảnh), vẫn trả về đúng `RiskAnalysis`.
2. `backend/arena/scam_llm.py` — viết lại `get_scammer_reply()` để gọi LLM
   đóng vai kẻ lừa đảo linh hoạt hơn kịch bản cố định.
3. `backend/knowledge/knowledge_base.py` — thêm hàm `generate_daily_case()`
   gọi LLM để **gợi ý** case mới, vẫn giữ bước con người duyệt trước khi thêm
   vào `case_studies.json`.

`frontend/static/js/vision.js`, `frontend/static/js/arena.js` và
`frontend/static/js/knowledge.js` không cần sửa gì, vì chúng chỉ gọi qua
API (`backend/api/`) và phụ thuộc vào contract, không quan tâm bên trong
dùng luật cố định hay AI.

## Cấu trúc thư mục — vì sao chia như vậy

| Thư mục | Người phụ trách | Vai trò |
|---|---|---|
| `backend/models/` | Cả 2 (chốt trước) | Contract — schema dữ liệu dùng chung |
| `backend/vision/` | Người A | Financial Lie Detector (Camera Kính Lúp) |
| `backend/arena/` | Người B | Scam Arena (cuộc gọi giả lập) |
| `backend/knowledge/` | Cả 2 | Kho tri thức & Daily Scam Alert |
| `frontend/` | Cả 2, ghép cuối | Giao diện Streamlit |
| `data/fixtures/` | Cả 2 | Dữ liệu mẫu để đo số liệu trước khi demo |
| `tests/` | Cả 2 | Test tự động, không cần API key |
| `scripts/` | Cả 2 | Script tiện ích chạy độc lập |
