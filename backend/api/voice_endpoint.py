"""Endpoint dùng chung cho giọng nói — cả Camera Kính Lúp và Scam Arena
đều gọi lại đúng backend/arena/voice.py này (tái dùng, không tách trùng lặp
theo từng tính năng, vì bản chất là cùng 1 logic STT/TTS).
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Giới hạn để tránh treo server khi ai đó gửi file/nội dung quá khổ (bản demo, chưa có hàng đợi/queue).
MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15MB — đủ cho vài phút ghi âm webm, chặn upload bất thường
# Không còn giới hạn số ký tự cho /speak: Piper chạy local, không tốn phí theo
# ký tự như API đám mây. Case study ở Kho tri thức có thể dài hơn 800 ký tự
# (mức cũ dành riêng cho lời thoại ngắn của Scam Arena) nên bỏ hẳn giới hạn.


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict:
    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Không nhận được dữ liệu âm thanh (file rỗng).")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File âm thanh quá lớn (tối đa {MAX_AUDIO_BYTES // (1024 * 1024)}MB). Vui lòng ghi âm ngắn hơn.",
        )

    # Import ở đây (không phải đầu file) vì whisper load model nặng —
    # chỉ load khi thực sự có người bấm ghi âm hợp lệ, không chặn lúc khởi động API
    # và không tốn công import cho những request bị chặn ở trên.
    from backend.arena.voice import speech_to_text

    try:
        text = speech_to_text(audio_bytes)
    except Exception as exc:  # noqa: BLE001 — trả lỗi rõ ràng cho frontend hiển thị
        raise HTTPException(status_code=500, detail=f"Không nhận diện được giọng nói: {exc}") from exc
    return {"text": text}


class SpeakRequest(BaseModel):
    text: str


@router.post("/speak")
def speak(req: SpeakRequest) -> Response:
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Thiếu nội dung cần đọc.")

    from backend.arena.voice import text_to_speech

    try:
        audio_bytes = text_to_speech(req.text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Không tạo được giọng đọc: {exc}") from exc
    # Piper trả về WAV (trước đây gTTS trả về MP3 -> "audio/mpeg")
    return Response(content=audio_bytes, media_type="audio/wav")