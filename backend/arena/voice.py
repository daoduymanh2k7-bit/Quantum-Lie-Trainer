"""STT (Whisper) + TTS (gTTS) — tách riêng để dễ đổi sang API nếu máy yếu.

Nếu máy không có GPU tốt, cân nhắc thay whisper local bằng Whisper API.
"""

from __future__ import annotations

import io
import os
import shutil
import sys
import tempfile

# Whisper gọi lệnh "ffmpeg" (đúng tên đó, không có hậu tố) trực tiếp qua
# subprocess — nếu máy chưa cài ffmpeg hoặc chưa có trong PATH (thường gặp
# trên Windows), sẽ báo lỗi kiểu "WinError 2: The system cannot find the file
# specified". Nếu có cài gói imageio-ffmpeg (pip install imageio-ffmpeg), tạo
# 1 bản sao/symlink tên đúng "ffmpeg"/"ffmpeg.exe" trỏ tới binary đóng gói sẵn
# trong đó (tên gốc có hậu tố version, VD "ffmpeg-win-x86_64-v7.1.exe", nên
# PATH lookup thường sẽ không tìm ra nếu không đổi tên) rồi thêm vào PATH của
# tiến trình hiện tại — không cần cài ffmpeg hệ thống.
try:
    import imageio_ffmpeg

    _real_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    _alias_dir = os.path.join(tempfile.gettempdir(), "lie_trainer_ffmpeg_bin")
    os.makedirs(_alias_dir, exist_ok=True)
    _alias_name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    _alias_path = os.path.join(_alias_dir, _alias_name)
    if not os.path.exists(_alias_path):
        try:
            os.symlink(_real_ffmpeg, _alias_path)
        except OSError:
            shutil.copy2(_real_ffmpeg, _alias_path)  # VD trên Windows chưa bật quyền tạo symlink
    if _alias_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _alias_dir + os.pathsep + os.environ.get("PATH", "")
except ImportError:
    pass  # chưa cài imageio-ffmpeg -> rơi về ffmpeg hệ thống (cần có trong PATH)

import whisper
from gtts import gTTS

_model = None  # load lazy để app khởi động nhanh


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base")  # "tiny" nếu máy yếu, chậm hơn nhưng nhẹ hơn
    return _model


def speech_to_text(audio_bytes: bytes) -> str:
    # Dùng mkstemp thay vì NamedTemporaryFile: trên Windows, file mở bởi
    # NamedTemporaryFile vẫn bị Python giữ khoá trong lúc ffmpeg (tiến trình
    # khác) cố mở lại để đọc -> "PermissionError: Error opening input file...
    # Permission denied". Phải đóng hẳn handle trước khi gọi whisper/ffmpeg.
    fd, path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)
        result = _get_model().transcribe(path, language="vi")
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    return result["text"].strip()


def text_to_speech(text: str) -> bytes:
    tts = gTTS(text=text, lang="vi")
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()