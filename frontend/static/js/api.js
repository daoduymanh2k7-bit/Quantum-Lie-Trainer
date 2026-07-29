/**
 * api.js — lớp mỏng gọi backend FastAPI. KHÔNG chứa logic nghiệp vụ,
 * chỉ format request/response, giống tinh thần "thin API layer" ở backend.
 * Dùng path tương đối ("/api/...") vì frontend được chính FastAPI mount và
 * serve cùng origin (xem backend/api/main.py) — không cần cấu hình base URL.
 */
const Api = (() => {
  async function asJson(res) {
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) { /* body không phải JSON */ }
      throw new Error(detail);
    }
    return res.json();
  }

  return {
    // ---------- Vision ----------
    analyzeText(text, nRuns = 1) {
      return fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, n_runs: nRuns }),
      }).then(asJson);
    },

    categoryExplanation(category) {
      const url = "/api/vision/category-explanation?category=" + encodeURIComponent(category);
      return fetch(url).then(asJson);
    },

    // ---------- Voice (dùng chung vision + arena) ----------
    transcribeAudio(blob) {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      return fetch("/api/voice/transcribe", { method: "POST", body: form }).then(asJson);
    },

    async speakText(text) {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        // Đọc "detail" thật từ backend (VD: thiếu model Piper, thiếu ffmpeg...)
        // thay vì luôn hiện 1 câu chung chung -> mới biết được lỗi thật là gì.
        let detail = "Không tạo được giọng đọc.";
        try { detail = (await res.json()).detail || detail; } catch (_) { /* body không phải JSON */ }
        throw new Error(detail);
      }
      return res.blob();
    },

    // ---------- Arena ----------
    listScenarios() {
      return fetch("/api/arena/scenarios").then(asJson);
    },

    randomScenario() {
      return fetch("/api/arena/scenarios/random").then(asJson);
    },

    scammerReply(scenarioKey, history, userText) {
      return fetch("/api/arena/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_key: scenarioKey, history, user_text: userText }),
      }).then(asJson);
    },

    scoreSession(sessionId, scenarioType, transcript) {
      return fetch("/api/arena/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, scenario_type: scenarioType, transcript }),
      }).then(asJson);
    },

    improvementTip(mistake) {
      const url = "/api/arena/tip?mistake=" + encodeURIComponent(mistake);
      return fetch(url).then(asJson);
    },

    // ---------- Knowledge ----------
    listCases() {
      return fetch("/api/knowledge/cases").then(asJson);
    },

    dailyCase(seenCaseIds) {
      return fetch("/api/knowledge/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen_case_ids: seenCaseIds }),
      }).then(asJson);
    },

    nextCase(currentCaseId, seenCaseIds) {
      return fetch("/api/knowledge/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_case_id: currentCaseId, seen_case_ids: seenCaseIds }),
      }).then(asJson);
    },
  };
})();