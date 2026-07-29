document.addEventListener("DOMContentLoaded", () => {
    // ---- DOM Elements ----
    const pickerScreen = document.getElementById("arena-picker");
    const sessionScreen = document.getElementById("arena-session");
    const resultScreen = document.getElementById("arena-result");

    const scenarioList = document.getElementById("arena-scenario-list");
    const scenarioLabel = document.getElementById("arena-scenario-label");
    const transcriptBox = document.getElementById("arena-transcript");
    const statusIndicator = document.querySelector("#arena-session .status-indicator");

    const btnRandom = document.getElementById("arena-random-btn");
    const btnReplayVoice = document.getElementById("arena-replay-voice");
    const btnMic = document.getElementById("arena-mic-btn");
    const micBtnText = document.getElementById("mic-btn-text");
    const btnFinish = document.getElementById("arena-finish-btn");
    const btnRestart = document.getElementById("arena-restart-btn");
    const btnCancel = document.getElementById("arena-cancel-btn");
    const audioPlayer = document.getElementById("arena-audio-player");

    // ---- State phiên hiện tại ----
    let currentScenario = null; // { key, label }
    let sessionId = null;
    let history = []; // list các DialogueTurn {role, text, elapsed_seconds} đã xảy ra trong phiên
    let aiFinishedSpeakingAt = null; // mốc thời gian AI vừa nói xong lượt gần nhất — dùng đo elapsed_seconds
    let isRecording = false;
    let callEnded = false; // true khi kẻ gian đã "cúp máy" hoặc hết kịch bản

    // ---- Màn hình chọn kịch bản: lấy từ backend thật ----
    function renderScenarios(scenarios) {
        scenarioList.innerHTML = "";
        scenarios.forEach((scen) => {
            const btn = document.createElement("button");
            btn.className = "scenario-btn";
            btn.innerHTML = `<strong>${scen.label}</strong>`;
            btn.onclick = () => startSession(scen);
            scenarioList.appendChild(btn);
        });
    }

    async function loadScenarios() {
        try {
            const scenarios = await Api.listScenarios();
            renderScenarios(scenarios);
        } catch (err) {
            scenarioList.innerHTML = `<p class="error-text">Không tải được danh sách kịch bản: ${err.message}</p>`;
        }
    }

    // ---- Giọng nói: dùng gTTS thật qua backend, không dùng speechSynthesis trình duyệt ----
    async function playScammerVoice(text) {
        if (!audioPlayer) return;
        try {
            const blob = await Api.speakText(text);
            const url = URL.createObjectURL(blob);
            audioPlayer.src = url;
            audioPlayer.hidden = false;
            audioPlayer.controls = true;
            await audioPlayer.play().catch(() => { /* autoplay có thể bị chặn, không sao */ });
            await new Promise((resolve) => {
                audioPlayer.onended = resolve;
                audioPlayer.onerror = resolve;
                // Phòng khi trình duyệt chặn autoplay và sự kiện "ended" không bao giờ bắn ra
                setTimeout(resolve, 15000);
            });
        } catch (err) {
            console.error("Không tạo được giọng đọc:", err);
        } finally {
            aiFinishedSpeakingAt = Date.now();
        }
    }

    function isCallEndedReply(text) {
        return text.includes("cúp máy") || text.includes("kết thúc cuộc gọi");
    }

    function showScammerLine(text) {
        transcriptBox.innerText = text;
        if (statusIndicator) statusIndicator.textContent = "Hệ thống đang nói...";
        if (isCallEndedReply(text)) {
            callEnded = true;
            if (btnMic) btnMic.disabled = true;
            micBtnText.innerText = "Cuộc gọi đã kết thúc — bấm CÚP MÁY & CHẤM ĐIỂM";
        }
    }

    async function startSession(scenario) {
        currentScenario = scenario; // { key, label }
        sessionId = crypto.randomUUID();
        history = [];
        aiFinishedSpeakingAt = null;
        callEnded = false;

        pickerScreen.hidden = true;
        resultScreen.hidden = true;
        sessionScreen.hidden = false;

        scenarioLabel.innerText = scenario.label;
        transcriptBox.innerText = "Đang kết nối...";
        if (btnMic) { btnMic.disabled = false; }
        micBtnText.innerText = "Chạm để nói (Micro)";

        if (audioPlayer) {
            audioPlayer.hidden = true;
            audioPlayer.src = "";
        }

        try {
            const { reply } = await Api.scammerReply(scenario.key, [], "");
            history.push({ role: "scammer_ai", text: reply, elapsed_seconds: null });
            showScammerLine(reply);
            await playScammerVoice(reply);
        } catch (err) {
            transcriptBox.innerText = "Không kết nối được với kẻ gian (lỗi hệ thống). Vui lòng thử lại.";
        }
    }

    if (btnReplayVoice) {
        btnReplayVoice.onclick = () => {
            if (currentScenario) playScammerVoice(transcriptBox.innerText);
        };
    }

    if (btnRandom) {
        btnRandom.onclick = async () => {
            try {
                const scen = await Api.randomScenario();
                startSession(scen);
            } catch (err) {
                alert("Không lấy được kịch bản ngẫu nhiên: " + err.message);
            }
        };
    }

    // ---- Nút Ghi Âm: ghi âm thật -> gửi STT -> lấy câu trả lời của AI lừa đảo ----
    if (btnMic) {
        btnMic.onclick = async () => {
            if (callEnded) return;

            if (!isRecording) {
                if (!window.appAudioRecorder) return;
                await window.appAudioRecorder.start();
                isRecording = true;
                btnMic.classList.add("recording");
                micBtnText.innerText = "Đang ghi âm... (Bấm lần nữa để dừng)";
                audioPlayer.hidden = true;
                audioPlayer.src = "";
            } else {
                isRecording = false;
                btnMic.classList.remove("recording");
                btnMic.disabled = true;
                micBtnText.innerText = "Đang xử lý...";

                if (!window.appAudioRecorder) { btnMic.disabled = false; return; }
                const audioData = await window.appAudioRecorder.stop();
                if (!audioData) {
                    micBtnText.innerText = "Chạm để nói (Micro)";
                    btnMic.disabled = false;
                    return;
                }

                try {
                    const { text } = await Api.transcribeAudio(audioData.blob);
                    const elapsed = aiFinishedSpeakingAt ? (Date.now() - aiFinishedSpeakingAt) / 1000 : null;
                    const userText = text || "";

                    transcriptBox.innerText = userText ? `Bác vừa nói: "${userText}"` : "(Không nghe rõ, bác thử lại nhé)";
                    if (statusIndicator) statusIndicator.textContent = "Đang chờ phản hồi...";

                    // history hiện tại (TRƯỚC lượt user_text này) — đúng contract của /api/arena/reply
                    const { reply } = await Api.scammerReply(currentScenario.key, history, userText);

                    history.push({ role: "user", text: userText, elapsed_seconds: elapsed });
                    history.push({ role: "scammer_ai", text: reply, elapsed_seconds: null });

                    showScammerLine(reply);
                    await playScammerVoice(reply);
                } catch (err) {
                    transcriptBox.innerText = "Có lỗi khi xử lý câu trả lời: " + err.message;
                } finally {
                    micBtnText.innerText = callEnded ? "Cuộc gọi đã kết thúc — bấm CÚP MÁY & CHẤM ĐIỂM" : "Chạm để nói (Micro)";
                    btnMic.disabled = callEnded;
                }
            }
        };
    }

    // ---- Nút Chấm Điểm: gọi backend chấm điểm thật ----
    if (btnFinish) {
        btnFinish.onclick = async () => {
            if (audioPlayer) audioPlayer.pause();
            sessionScreen.hidden = true;
            resultScreen.hidden = false;

            document.getElementById("arena-score").innerText = "…";
            document.getElementById("arena-badge").innerText = "Đang chấm điểm...";
            document.getElementById("arena-mistakes-wrap").hidden = true;
            document.getElementById("arena-no-mistakes").hidden = true;

            try {
                const result = await Api.scoreSession(sessionId, currentScenario.label, history);

                document.getElementById("arena-score").innerText = String(result.user_score);
                document.getElementById("arena-badge").innerText = result.badge || "—";

                const latencyEl = document.getElementById("arena-latency");
                if (latencyEl) {
                    latencyEl.innerHTML = result.avg_response_latency != null
                        ? `⏱️ Tốc độ phản hồi trung bình: <strong>${result.avg_response_latency.toFixed(1)}s</strong>`
                        : `⏱️ Tốc độ phản hồi trung bình: <strong>—</strong>`;
                }

                const mistakesWrap = document.getElementById("arena-mistakes-wrap");
                const noMistakesEl = document.getElementById("arena-no-mistakes");
                const mistakesList = document.getElementById("arena-mistakes");

                if (result.mistakes && result.mistakes.length) {
                    mistakesWrap.hidden = false;
                    noMistakesEl.hidden = true;
                    mistakesList.innerHTML = "";
                    result.mistakes.forEach((flag) => {
                        const li = document.createElement("li");
                        const icon = flag.severity === "HIGH" ? "🔴" : flag.severity === "MEDIUM" ? "🟡" : "🟢";
                        li.textContent = `${icon} ${flag.mistake}`;
                        mistakesList.appendChild(li);
                    });
                } else {
                    mistakesWrap.hidden = true;
                    noMistakesEl.hidden = false;
                }
            } catch (err) {
                document.getElementById("arena-badge").innerText = "Không chấm điểm được";
                document.getElementById("arena-score").innerText = "—";
                document.getElementById("arena-mistakes-wrap").hidden = false;
                document.getElementById("arena-no-mistakes").hidden = true;
                document.getElementById("arena-mistakes").innerHTML =
                    `<li>❌ Lỗi khi gọi hệ thống chấm điểm: ${err.message}</li>`;
            }
        };
    }

    // ---- Nút Dừng lại ----
    if (btnCancel) {
        btnCancel.onclick = async () => {
            if (audioPlayer) audioPlayer.pause();
            if (isRecording && window.appAudioRecorder) {
                await window.appAudioRecorder.stop();
                isRecording = false;
                btnMic.classList.remove("recording");
                micBtnText.innerText = "Chạm để nói (Micro)";
            }
            audioPlayer.hidden = true;
            audioPlayer.src = "";
            sessionScreen.hidden = true;
            pickerScreen.hidden = false;
        };
    }

    // ---- Chơi lại ----
    if (btnRestart) {
        btnRestart.onclick = () => {
            resultScreen.hidden = true;
            pickerScreen.hidden = false;
        };
    }

    loadScenarios();
});
