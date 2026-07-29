window.ArenaTab = {
    init: function() {
        // ---- DOM Elements ----
        const pickerScreen = document.getElementById("arena-picker");
        const sessionScreen = document.getElementById("arena-session");
        const resultScreen = document.getElementById("arena-result");

        const scenarioList = document.getElementById("arena-scenario-list");
        const scenarioLabel = document.getElementById("arena-scenario-label");
        const callTimerEl = document.getElementById("arena-call-timer");
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
        let callTimerInterval = null; // đồng hồ đếm giờ hiển thị trên UI, giống cuộc gọi thật
        let callStartedAt = null;

        // ---- Đồng hồ đếm giờ cuộc gọi (chỉ hiển thị, không dùng để chấm điểm) ----
        function formatCallDuration(ms) {
            const totalSeconds = Math.floor(ms / 1000);
            const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
            const ss = String(totalSeconds % 60).padStart(2, "0");
            return `${mm}:${ss}`;
        }

        function startCallTimer() {
            stopCallTimer();
            callStartedAt = Date.now();
            if (callTimerEl) callTimerEl.textContent = "00:00";
            callTimerInterval = setInterval(() => {
                if (callTimerEl) callTimerEl.textContent = formatCallDuration(Date.now() - callStartedAt);
            }, 1000);
        }

        function stopCallTimer() {
            if (callTimerInterval) {
                clearInterval(callTimerInterval);
                callTimerInterval = null;
            }
        }

        // ---- Màn hình chọn kịch bản: lấy từ backend thật ----
        function renderScenarios(scenarios) {
            if (!scenarioList) return;
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
                if (scenarioList) {
                    scenarioList.innerHTML = `<p class="error-text">Không tải được danh sách kịch bản: ${err.message}</p>`;
                }
            }
        }

        // ---- Giọng nói: dùng gTTS thật qua backend, không dùng speechSynthesis trình duyệt ----
        async function playScammerVoice(text) {
            if (!audioPlayer) return;
            if (btnReplayVoice) btnReplayVoice.classList.add("is-playing");
            try {
                const blob = await Api.speakText(text);
                const url = URL.createObjectURL(blob);
                audioPlayer.src = url;
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
                if (btnReplayVoice) btnReplayVoice.classList.remove("is-playing");
            }
        }

        function isCallEndedReply(text) {
            return text.includes("cúp máy") || text.includes("kết thúc cuộc gọi");
        }

        function showScammerLine(text) {
            if (transcriptBox) transcriptBox.innerText = text;
            if (statusIndicator) statusIndicator.textContent = "Hệ thống đang nói...";
            if (isCallEndedReply(text)) {
                callEnded = true;
                if (btnMic) btnMic.disabled = true;
                if (micBtnText) micBtnText.innerText = "Cuộc gọi đã kết thúc — bấm CÚP MÁY & CHẤM ĐIỂM";
            }
        }

        async function startSession(scenario) {
            currentScenario = scenario; // { key, label }
            sessionId = crypto.randomUUID();
            history = [];
            aiFinishedSpeakingAt = null;
            callEnded = false;

            if (pickerScreen) pickerScreen.hidden = true;
            if (resultScreen) resultScreen.hidden = true;
            if (sessionScreen) sessionScreen.hidden = false;

            if (scenarioLabel) scenarioLabel.innerText = scenario.label;
            if (transcriptBox) transcriptBox.innerText = "Đang kết nối...";
            if (btnMic) { btnMic.disabled = false; }
            if (micBtnText) micBtnText.innerText = "Chạm để nói (Micro)";
            startCallTimer();

            if (audioPlayer) {
                audioPlayer.src = "";
            }

            try {
                const { reply } = await Api.scammerReply(scenario.key, [], "");
                history.push({ role: "scammer_ai", text: reply, elapsed_seconds: null });
                showScammerLine(reply);
                await playScammerVoice(reply);
            } catch (err) {
                if (transcriptBox) {
                    transcriptBox.innerText = "Không kết nối được với kẻ gian (lỗi hệ thống). Vui lòng thử lại.";
                }
            }
        }

        if (btnReplayVoice) {
            btnReplayVoice.onclick = () => {
                if (currentScenario && transcriptBox) playScammerVoice(transcriptBox.innerText);
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
                    if (audioPlayer) {
                        audioPlayer.hidden = true;
                        audioPlayer.src = "";
                    }
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
                stopCallTimer();
                if (sessionScreen) sessionScreen.hidden = true;
                if (resultScreen) resultScreen.hidden = false;

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
                stopCallTimer();
                if (isRecording && window.appAudioRecorder) {
                    await window.appAudioRecorder.stop();
                    isRecording = false;
                    btnMic.classList.remove("recording");
                    micBtnText.innerText = "Chạm để nói (Micro)";
                }
                if (audioPlayer) audioPlayer.src = "";
                if (sessionScreen) sessionScreen.hidden = true;
                if (pickerScreen) pickerScreen.hidden = false;
            };
        }

        // ---- Chơi lại ----
        if (btnRestart) {
            btnRestart.onclick = () => {
                if (resultScreen) resultScreen.hidden = true;
                if (pickerScreen) pickerScreen.hidden = false;
            };
        }

        loadScenarios();
    }
};