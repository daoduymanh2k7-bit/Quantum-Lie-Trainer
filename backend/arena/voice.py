"""STT (Whisper) + TTS (Piper — neural TTS chạy local) — tách riêng để dễ đổi
sang API nếu máy yếu.

TTS đã đổi từ gTTS sang Piper (https://github.com/OHF-voice/piper1-gpl):
- Chạy hoàn toàn offline trên CPU, không gọi mạng -> không có network
  round-trip -> hết delay do mạng chậm lúc demo.
- Giọng neural tự nhiên hơn hẳn gTTS.

FIX NGẮT CÂU (quan trọng): bản thân Piper 1.6 sinh audio theo TỪNG CÂU rồi
NỐI THẲNG các câu lại với nhau, khoảng lặng giữa 2 câu = 0 giây (xem
piper.voice.PiperVoice.synthesize_wav). Đó là lý do nghe "dồn dập"/robot dù
đã đổi engine. Hàm text_to_speech() bên dưới không dùng synthesize_wav() có
sẵn nữa, mà tự lặp qua từng câu và CHÈN THÊM khoảng lặng (mặc định 350ms)
giữa các câu trước khi ghép thành 1 file WAV.

CÀI ĐẶT (làm 1 lần trên máy chạy server):

    pip install piper-tts --break-system-packages

    python -m piper.download_voices vi_VN-vais1000-medium --download-dir voices

Lệnh trên tải 2 file vào thư mục "voices/" ở gốc project:
    voices/vi_VN-vais1000-medium.onnx
    voices/vi_VN-vais1000-medium.onnx.json

Muốn đổi giọng khác thì đổi tên voice trong lệnh download và trong
biến môi trường PIPER_VOICE_PATH bên dưới. Danh sách giọng tiếng Việt hiện có
xem tại: https://github.com/rhasspy/piper/blob/master/VOICES.md (mục vi_VN).

LƯU Ý: hàm text_to_speech() trả về audio định dạng WAV (trước đây gTTS trả
về MP3). File backend/api/voice_endpoint.py cần đổi media_type của response
/api/voice/speak từ "audio/mpeg" thành "audio/wav" (xem file đi kèm).
"""

from __future__ import annotations

import io
import os
import shutil
import sys
import tempfile
import wave
from pathlib import Path

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
from piper import PiperVoice

_model = None  # whisper — load lazy để app khởi động nhanh
_voice = None  # piper — load lazy, model + inference session khá nặng để load


# Thư mục "voices/" ở gốc project (backend/arena/voice.py -> lùi 2 cấp).
# Có thể override bằng biến môi trường PIPER_VOICE_PATH nếu đặt model ở chỗ khác.
_DEFAULT_VOICE_DIR = Path(__file__).resolve().parent.parent.parent / "voices"
_VOICE_MODEL_PATH = Path(
    os.environ.get("PIPER_VOICE_PATH", str(_DEFAULT_VOICE_DIR / "vi_VN-vais1000-medium.onnx"))
)

# Khoảng lặng chèn giữa 2 câu (ms). Tăng lên nếu vẫn thấy dồn dập, giảm
# xuống nếu thấy đọc bị "khựng" quá lâu giữa các câu. Có thể chỉnh nhanh
# qua biến môi trường PIPER_SENTENCE_PAUSE_MS mà không cần sửa code.
_SENTENCE_PAUSE_MS = int(os.environ.get("PIPER_SENTENCE_PAUSE_MS", "350"))


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base")  # "tiny" nếu máy yếu, chậm hơn nhưng nhẹ hơn
    return _model


def _get_voice() -> PiperVoice:
    global _voice
    if _voice is None:
        if not _VOICE_MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Không tìm thấy model giọng Piper tại '{_VOICE_MODEL_PATH}'.\n"
                "Chạy lệnh sau để tải model (1 lần):\n"
                f"  python -m piper.download_voices vi_VN-vais1000-medium "
                f"--download-dir {_DEFAULT_VOICE_DIR}"
            )
        # config_path=None -> Piper tự tìm file "<model>.onnx.json" cùng thư mục
        _voice = PiperVoice.load(str(_VOICE_MODEL_PATH))
    return _voice


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
    """Sinh audio WAV (bytes) đọc "text" bằng giọng Piper tiếng Việt.

    Tự chèn khoảng lặng _SENTENCE_PAUSE_MS giữa các câu (Piper mặc định nối
    liền không có khoảng nghỉ) để giọng đọc có nhịp nghỉ tự nhiên hơn thay
    vì đọc dồn hết một mạch nghe rất máy móc.
    """
    voice = _get_voice()
    chunks = list(voice.synthesize(text))
    if not chunks:
        raise ValueError("Không tạo được audio: văn bản rỗng sau khi xử lý.")

    sample_rate = chunks[0].sample_rate
    sample_width = chunks[0].sample_width
    channels = chunks[0].sample_channels

    silence_samples = int(sample_rate * _SENTENCE_PAUSE_MS / 1000)
    silence_bytes = b"\x00" * (silence_samples * sample_width * channels)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setframerate(sample_rate)
        wav_file.setsampwidth(sample_width)
        wav_file.setnchannels(channels)
        for i, chunk in enumerate(chunks):
            wav_file.writeframes(chunk.audio_int16_bytes)
            if i < len(chunks) - 1:
                wav_file.writeframes(silence_bytes)
    buf.seek(0)
    return buf.read()