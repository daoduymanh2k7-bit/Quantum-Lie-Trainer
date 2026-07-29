<div align="center">

  # 🛡️ Lie Trainer

  **Phòng tập phản xạ chống lừa đảo tài chính — kiểm tra tin nhắn/lời mời đầu tư nghi vấn, luyện phản xạ qua cuộc gọi lừa đảo giả lập, và học từ case study thật.**

  ![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
  ![Tests](https://img.shields.io/badge/tests-16%20passing-2ea44f)
  ![Status](https://img.shields.io/badge/status-MVP%20rule--based-yellow)

</div>

---

## Mục lục

- [1. Tổng quan & bài toán](#1-tổng-quan--bài-toán)
- [2. Ba module](#2-ba-module)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
- [4. Kiến trúc](#4-kiến-trúc)
- [5. Cài đặt & chạy thử](#5-cài-đặt--chạy-thử)
- [6. Test](#6-test)
- [7. Hiện trạng: chưa dùng AI](#7-hiện-trạng-chưa-dùng-ai)
- [8. Hạn chế hiện tại](#8-hạn-chế-hiện-tại)
- [9. Hướng phát triển](#9-hướng-phát-triển)
- [10. Tác giả & Giấy phép](#10-tác-giả--giấy-phép)

---

## 1. Tổng quan & bài toán

Lừa đảo tài chính qua điện thoại/tin nhắn (giả ngân hàng, giả công an, trúng thưởng giả, đầu tư giả...) nhắm nhiều vào nhóm ít cập nhật công nghệ. Vấn đề không chỉ là **thiếu thông tin** mà là **thiếu phản xạ** — biết lý thuyết "đừng đọc OTP cho ai" nhưng khi bị dồn ép qua điện thoại thật vẫn dễ mắc bẫy vì hoảng loạn.

**Lie Trainer** tiếp cận theo hướng "phòng tập": thay vì chỉ đọc cảnh báo, người dùng luyện tập tình huống giả lập có chấm điểm, đồng thời có công cụ kiểm tra nhanh một tin nhắn/lời mời đang nhận được.

## 2. Ba module

| Module | Chức năng | Vị trí code |
|---|---|---|
| 🔍 **Camera Kính Lúp** | Dán văn bản (hoặc đọc bằng giọng nói) một tin nhắn/lời mời nghi vấn → chấm điểm rủi ro, chỉ ra loại lừa đảo và các dấu hiệu (`red_flags`) cụ thể | `backend/vision/` |
| 📞 **Cuộc gọi giả lập** | Cuộc gọi lừa đảo giả lập theo 3 kịch bản (giả ngân hàng, giả công an, giả trúng thưởng), có thoại bằng giọng nói; sau cuộc gọi được chấm điểm, chỉ ra từng lỗi ("đã đọc OTP", "đồng ý chuyển khoản"...) kèm gợi ý khắc phục | `backend/arena/` |
| 📚 **Kho kiến thức & Daily Scam Alert** | 20 case study thật (11 loại lừa đảo khác nhau), gợi ý case tiếp theo cùng chuyên đề, gamification nhẹ (điểm/streak/huy hiệu) | `backend/knowledge/` |

Ba module trao đổi dữ liệu qua contract chung tại `backend/models/schemas.py`, chốt trước khi code để 2 người có thể làm song song không cần chờ nhau.

## 3. Cấu trúc thư mục

```
project/
├── backend/
│   ├── models/
│   │   ├── schemas.py         # Contract chung — mọi module trao đổi qua đây
│   │   └── quantum_scorer.py  # Prototype: mạch lượng tử (PennyLane) chấm rủi ro — chưa gắn vào API
│   ├── vision/                # Camera Kính Lúp: analyzer.py (rule-based) + monte_carlo.py (entry point)
│   ├── arena/                 # Cuộc gọi giả lập: kịch bản (scam_llm.py) + chấm điểm (scorer.py) + voice.py (STT/TTS)
│   ├── knowledge/             # Kho kiến thức: knowledge_base.py
│   └── api/                   # Router FastAPI cho từng module, main.py chỉ gộp lại
├── frontend/static/           # Giao diện: index.html + css/ + js/ (HTML/CSS/JS thuần, không build step)
├── data/fixtures/             # case_studies.json (20 case), sample_scam_messages.json
├── tests/                     # 16 test tự động (analyzer, scorer, knowledge, schemas)
├── scripts/                   # run_batch_test.py, smoke.sh
├── docs/ARCHITECTURE.md       # Quyết định thiết kế + đường nâng cấp AI thật
├── requirements.txt
└── pyproject.toml
```

## 4. Kiến trúc

FastAPI (backend) + frontend tĩnh, tách hẳn qua REST API — `backend/api/main.py` chỉ import và gộp router, không chứa logic.

```
Tin nhắn text/giọng nói ──► backend/vision  (rule-based)  ──► /api/vision
Giọng nói (cuộc gọi giả) ──► backend/arena  (kịch bản)     ──► /api/arena
Case study thủ công      ──► backend/knowledge             ──► /api/knowledge
Ghi âm / đọc to          ──► backend/arena/voice.py (Whisper + gTTS) ──► /api/voice
```

Nguyên tắc **contract-first**: mọi module chỉ trao đổi qua các model Pydantic trong `schemas.py`. Nhờ vậy, khi nâng cấp phần lõi lên AI thật (xem [§9](#9-hướng-phát-triển)), chỉ cần sửa đúng file logic bên trong từng module — endpoint FastAPI và JS ở frontend không cần đổi gì.

## 5. Cài đặt & chạy thử

```bash
pip install -r requirements.txt --break-system-packages
uvicorn backend.api.main:app --reload
```

Mở `http://127.0.0.1:8000` — FastAPI tự phục vụ `frontend/static/` tại `/`, API nằm ở `/api/vision`, `/api/arena`, `/api/knowledge`, `/api/voice`, và `/health` để kiểm tra server còn sống.

Không cần khai báo API key ở bản demo này.

## 6. Test

```bash
pytest -q             # 16 test, chạy ngay không cần cấu hình gì thêm
bash scripts/smoke.sh # kiểm tra nhanh trước khi demo: pytest + import + batch test
```

## 7. Hiện trạng: chưa dùng AI

Bản demo hiện tại chạy hoàn toàn bằng **luật cố định (rule-based)**, không gọi LLM/API nào — chạy offline, không tốn phí (trừ Whisper/gTTS cần tải model hoặc mạng cho phần giọng nói):

- **Camera Kính Lúp** — so khớp từ khoá theo 4 nhóm lừa đảo trong `RISK_KEYWORDS` (`analyzer.py`), cộng điểm theo số từ khoá khớp.
- **Scam Arena** — kịch bản hội thoại cố định (`SCENARIOS` trong `scam_llm.py`), có nhánh rẽ đơn giản khi người dùng dùng từ khoá từ chối; chấm điểm "sập bẫy" qua từ khoá + thời gian phản hồi (**proxy đơn giản, không phải đo cảm xúc thật**).
- **Kho tri thức** — case study biên tập thủ công trong `case_studies.json`, đúng tinh thần "đội ngũ duyệt trước khi phát hành".

Ngoài ra, `backend/models/quantum_scorer.py` là một **prototype độc lập**: mạch lượng tử 2-qubit (PennyLane, `default.qubit`) nhận 2 đặc trưng tài chính (`roi_claim`, `urgency_score`) và trả về điểm rủi ro. Module này **chưa được gọi từ bất kỳ endpoint nào** và `pennylane` chưa có trong `requirements.txt` — đây là hướng thử nghiệm cho phần "quantum" của ý tưởng, chưa phải tính năng chạy được trong bản demo.

Xem `docs/ARCHITECTURE.md` để biết chi tiết đường nâng cấp lên AI thật mà không cần sửa lại contract.

## 8. Hạn chế hiện tại

- Camera Kính Lúp chỉ nhận **text/giọng nói**, chưa đọc được ảnh (cần OCR hoặc AI Vision ở bản sau).
- Danh sách từ khoá trong `analyzer.py` còn ít (4 nhóm), dễ bỏ sót chiêu lừa mới ngoài danh sách.
- Scam Arena đi theo kịch bản cố định, chưa phản ứng linh hoạt với mọi câu trả lời của người dùng — chỉ nhận diện được vài từ khoá "từ chối" đơn giản.
- **Đo "độ vội vàng" trong Scam Arena là một proxy đơn giản** (thời gian phản hồi + độ dài câu trả lời), **không phải đo cảm xúc thật** — cần nói rõ điều này khi thuyết trình.
- `quantum_scorer.py` là prototype tách rời, chưa gắn vào luồng API/UI, chưa có test.
- API không lưu session ở server — frontend tự giữ state (session_id, lịch sử hội thoại, tiến độ Kho tri thức) và gửi kèm mỗi request; điểm/streak chỉ tồn tại phía client, chưa có database.

## 9. Hướng phát triển

Nhờ tách contract từ đầu (`backend/models/schemas.py`), khi nâng cấp lên AI/quantum thật, chỉ cần sửa đúng các file logic, không đụng vào UI hay contract:

1. `backend/vision/analyzer.py` → viết lại `analyze_text()` để gọi Claude Vision (đọc được cả ảnh), vẫn trả về đúng `RiskAnalysis`.
2. `backend/arena/scam_llm.py` → viết lại `get_scammer_reply()` để gọi LLM đóng vai kẻ lừa đảo linh hoạt hơn kịch bản cố định.
3. `backend/knowledge/knowledge_base.py` → thêm `generate_daily_case()` gọi LLM để gợi ý case mới, vẫn giữ bước con người duyệt trước khi thêm vào `case_studies.json`.
4. `backend/models/quantum_scorer.py` → hoàn thiện và gắn vào `backend/vision/monte_carlo.py` như một tầng chấm điểm bổ sung (chạy N lần lấy `risk_score` trung bình + độ lệch chuẩn `risk_score_std` — trường này đã có sẵn trong contract chờ dùng), sau khi đã thêm `pennylane` vào `requirements.txt` và có test riêng.

Các file JS trong `frontend/static/js/` không cần sửa gì trong các bước trên, vì chúng chỉ gọi qua `backend/api/` và phụ thuộc vào contract, không quan tâm bên trong dùng luật cố định, LLM hay mạch lượng tử.

## 10. Tác giả & Giấy phép

Dự án cá nhân/học tập, xây dựng theo mô hình contract-first tham khảo từ dự án LAWGIC (VAIC 2026).

**Giấy phép:** phục vụ mục đích học tập và demo. Không thu thập hay lưu trữ nội dung người dùng nhập vào ở bản demo hiện tại.