class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.audioUrl = null;
    }

    // Yêu cầu quyền và bắt đầu ghi âm
    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            return true;
        } catch (error) {
            console.error("Lỗi khi truy cập micro:", error);
            alert("Không thể truy cập Micro. Bác vui lòng cấp quyền cho trình duyệt nhé.");
            return false;
        }
    }

    // Dừng ghi âm và trả về file âm thanh
    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                // Đóng gói dữ liệu thành file audio
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.audioUrl = URL.createObjectURL(this.audioBlob);
                
                // Tắt hoàn toàn micro để tắt đèn đỏ trên trình duyệt
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                resolve({ blob: this.audioBlob, url: this.audioUrl });
            };

            this.mediaRecorder.stop();
        });
    }
}

// Khởi tạo global để có thể gọi từ bất kỳ file JS nào (như arena.js)
window.appAudioRecorder = new AudioRecorder();

/**
 * recorder.js — bọc MediaRecorder thành 1 nút bấm-để-ghi-âm/bấm-để-dừng,
 * dùng chung cho Camera Kính Lúp và Scam Arena (cả 2 đều cần STT).
 */
function attachMicButton(buttonEl, statusEl, onTranscribed) {
  if (!buttonEl) return;
  let mediaRecorder = null;
  let chunks = [];
  let isRecording = false;

  buttonEl.addEventListener("click", async () => {
    if (isRecording) {
      if (mediaRecorder) mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        buttonEl.classList.remove("is-recording");
        isRecording = false;
        if (statusEl) statusEl.textContent = "Đang chuyển giọng nói thành văn bản...";
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const { text } = await Api.transcribeAudio(blob);
          if (statusEl) statusEl.textContent = "";
          onTranscribed(text);
        } catch (err) {
          if (statusEl) statusEl.textContent = "Không nhận diện được giọng nói: " + err.message;
        }
      };
      mediaRecorder.start();
      isRecording = true;
      buttonEl.classList.add("is-recording");
      if (statusEl) statusEl.textContent = "Đang ghi âm... bấm lại để dừng.";
    } catch (err) {
      if (statusEl) statusEl.textContent = "Không truy cập được micro: " + err.message;
    }
  });
}