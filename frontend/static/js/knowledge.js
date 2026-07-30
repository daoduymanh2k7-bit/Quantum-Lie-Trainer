/**
 * knowledge.js — tính năng Kho tri thức & Daily Scam Alert (Module 3).
 * Server không lưu điểm/streak — tiến độ lưu ở localStorage trình duyệt.
 * Streak tính theo NGÀY thực tế (last_seen_date), không theo số lần bấm.
 * Thành tích (achievements) rule-based, tính từ progress hiện có.
 *
 * 3 dạng tiếp nhận kiến thức: Đọc (mặc định, luồng gốc) / Nghe (audio,
 * dùng TTS backend gTTS qua Api.speakText) / Xem (đang hoàn thiện).
 * Cả 3 dạng dùng CHUNG cơ chế điểm/streak/thành tích qua markSeen().
 */
const KnowledgeTab = (() => {
  const STORAGE_KEY = "qlt_knowledge_progress";
  let progress = {
    points: 0,
    streak: 0,
    last_seen_date: null,
    seen_case_ids: [],
    unlocked_achievements: [],
    share_count: 0,
  };
  let currentCase = null; // case đang mở ở panel Đọc
  let currentListenCase = null; // case đang mở ở panel Nghe
  let allCases = [];

  const ACHIEVEMENTS = [
    { id: "first_case", icon: "🌱", name: "Case đầu tiên", check: (p) => p.seen_case_ids.length >= 1 },
    { id: "five_cases", icon: "📖", name: "Học 5 case", check: (p) => p.seen_case_ids.length >= 5 },
    { id: "ten_cases", icon: "🧠", name: "Học 10 case", check: (p) => p.seen_case_ids.length >= 10 },
    { id: "all_cases", icon: "🏅", name: "Học hết kho", check: (p) => allCases.length > 0 && p.seen_case_ids.length >= allCases.length },
    { id: "streak_3", icon: "🔥", name: "Streak 3 ngày", check: (p) => p.streak >= 3 },
    { id: "streak_7", icon: "🚀", name: "Streak 7 ngày", check: (p) => p.streak >= 7 },
    {
      id: "category_master",
      icon: "🎯",
      name: "Am hiểu 1 chủ đề",
      check: (p) => {
        const byCategory = {};
        allCases.forEach((c) => { byCategory[c.scam_category] = (byCategory[c.scam_category] || 0) + 1; });
        return Object.entries(byCategory).some(([cat, total]) => {
          const seenInCat = allCases.filter((c) => c.scam_category === cat && p.seen_case_ids.includes(c.case_id)).length;
          return seenInCat >= total && total > 0;
        });
      },
    },
    { id: "sharer", icon: "📢", name: "Nhà lan tỏa", check: (p) => (p.share_count || 0) >= 1 },
  ];

  const $ = (id) => document.getElementById(id); // helper ngắn gọn, mọi nơi gọi qua đây đều nên kiểm tra null trước khi dùng

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) progress = Object.assign(progress, JSON.parse(raw));
    } catch (_) { /* localStorage không khả dụng — dùng giá trị mặc định trong bộ nhớ */ }
  }

  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) { /* bỏ qua nếu bị chặn */ }
  }

  function renderStats() {
    const p = $("kb-points"), s = $("kb-streak");
    if (p) p.textContent = progress.points;
    if (s) s.textContent = progress.streak;
  }

  function renderAlertBanner() {
    const banner = $("kb-alert-banner");
    if (!banner) return;
    banner.hidden = progress.last_seen_date === todayStr();
  }

  function renderAchievements() {
    const grid = $("kb-achievements-grid");
    if (!grid) return;
    grid.innerHTML = "";
    ACHIEVEMENTS.forEach((ach) => {
      const unlocked = progress.unlocked_achievements.includes(ach.id);
      const el = document.createElement("div");
      el.className = "kb-badge" + (unlocked ? " unlocked" : "");
      el.innerHTML = `<span class="kb-badge-icon">${ach.icon}</span><span class="kb-badge-name">${ach.name}</span>`;
      grid.appendChild(el);
    });
  }

  function showToast(text) {
    let toast = $("kb-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "kb-toast";
      toast.className = "kb-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function checkAchievements() {
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach((ach) => {
      const already = progress.unlocked_achievements.includes(ach.id);
      if (!already && ach.check(progress)) {
        progress.unlocked_achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    });
    if (newlyUnlocked.length > 0) {
      saveProgress();
      renderAchievements();
      newlyUnlocked.forEach((ach, i) => {
        setTimeout(() => showToast(`🏆 Mở khóa thành tích: ${ach.name}`), i * 1400);
      });
    }
  }

  function bumpStreakForToday() {
    const today = todayStr();
    if (progress.last_seen_date === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.streak = progress.last_seen_date === yesterday ? progress.streak + 1 : 1;
    progress.last_seen_date = today;
  }

  /** Cộng điểm/streak/thành tích cho 1 case — DÙNG CHUNG cho cả Đọc và Nghe. */
  function grantPoints(caseStudy, points) {
    if (!progress.seen_case_ids.includes(caseStudy.case_id)) {
      progress.seen_case_ids.push(caseStudy.case_id);
    }
    progress.points += points;
    bumpStreakForToday();
    saveProgress();
    renderStats();
    renderAlertBanner();
    checkAchievements();
  }

  // ============== PANEL: ĐỌC ==============

  function renderCase(caseStudy) {
    currentCase = caseStudy;
    const category = $("kb-category"), title = $("kb-title"), summary = $("kb-summary");
    const takeaway = $("kb-takeaway"), source = $("kb-source");
    if (category) category.textContent = "Loại lừa đảo: " + caseStudy.scam_category;
    if (title) title.textContent = caseStudy.title;
    if (summary) summary.textContent = caseStudy.summary;
    if (takeaway) takeaway.textContent = caseStudy.takeaway;
    if (source) source.textContent = "Nguồn: " + caseStudy.source;

    const knownBtn = $("kb-known-btn"), newBtn = $("kb-new-btn");
    if (knownBtn) knownBtn.disabled = false;
    if (newBtn) newBtn.disabled = false;
    const choiceRow = $("kb-choice-row"), shareRow = $("kb-share-row");
    if (choiceRow) choiceRow.hidden = false;
    if (shareRow) shareRow.hidden = true;
  }

  async function loadDailyCase() {
    const category = $("kb-category"), title = $("kb-title"), summary = $("kb-summary");
    const takeaway = $("kb-takeaway"), source = $("kb-source");
    if (category) category.textContent = "Đang tải...";
    if (title) title.textContent = "Đang tải case hôm nay...";
    if (summary) summary.textContent = "Vui lòng đợi trong giây lát...";
    if (takeaway) takeaway.textContent = "";
    if (source) source.textContent = "";

    try {
      const caseStudy = await Api.dailyCase(progress.seen_case_ids);
      renderCase(caseStudy);
    } catch (err) {
      if (category) category.textContent = "Lỗi";
      if (title) title.textContent = "Không tải được case hôm nay";
      if (summary) summary.textContent = `Không thể kết nối đến server: ${err.message}. Vui lòng kiểm tra lại kết nối mạng.`;
      if (takeaway) takeaway.textContent = "";
      if (source) source.textContent = "";
    }
  }

  function markSeen(points) {
    if (!currentCase) return;
    const knownBtn = $("kb-known-btn"), newBtn = $("kb-new-btn");
    if (knownBtn) knownBtn.disabled = true;
    if (newBtn) newBtn.disabled = true;

    grantPoints(currentCase, points);

    const shareBox = $("kb-share");
    if (shareBox) {
      shareBox.value = `🛡️ Vừa học được case chống lừa đảo: "${currentCase.title}" (${currentCase.scam_category}). Bài học: ${currentCase.takeaway}`;
    }
    const choiceRow = $("kb-choice-row"), shareRow = $("kb-share-row");
    if (choiceRow) choiceRow.hidden = true;
    if (shareRow) shareRow.hidden = false;
  }

  async function shareCase() {
    const shareBox = $("kb-share");
    const text = shareBox ? shareBox.value : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Quantum Lie Trainer — Kho kiến thức thức", text });
      } catch (_) {
        return;
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Đã sao chép nội dung — dán vào MXH bất kỳ!");
      } catch (_) {
        showToast("Hãy tự copy nội dung trong ô bên trên để chia sẻ.");
        return;
      }
    }
    progress.share_count = (progress.share_count || 0) + 1;
    saveProgress();
    checkAchievements();
  }

  async function loadNextCase() {
    const btn = $("kb-next-btn");
    if (btn) btn.disabled = true;

    const category = $("kb-category"), title = $("kb-title"), summary = $("kb-summary");
    const takeaway = $("kb-takeaway"), source = $("kb-source");
    if (category) category.textContent = "Đang tải...";
    if (title) title.textContent = "Đang tải case tiếp theo...";
    if (summary) summary.textContent = "Vui lòng đợi trong giây lát...";
    if (takeaway) takeaway.textContent = "";
    if (source) source.textContent = "";

    try {
      const caseStudy = await Api.nextCase(currentCase.case_id, progress.seen_case_ids);
      renderCase(caseStudy);
    } catch (err) {
      if (category) category.textContent = "Lỗi";
      if (title) title.textContent = "Không tải được case tiếp theo";
      if (summary) summary.textContent = `Lỗi: ${err.message}`;
      if (takeaway) takeaway.textContent = "";
      if (source) source.textContent = "";
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ============== PANEL: NGHE ==============

  /** Ước lượng thời lượng đọc (tiếng Việt ~2.5 từ/giây khi đọc TTS bình thường). */
  function estimateDuration(text) {
    const words = text.trim().split(/\s+/).length;
    const seconds = Math.round(words / 2.5);
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return m > 0 ? `~${m} phút ${s} giây` : `~${s} giây`;
  }

  function renderListenList() {
    const container = $("kb-listen-list-items");
    if (!container) return;
    const audioCases = allCases.filter((c) => c.audio_script);
    container.innerHTML = "";
    if (audioCases.length === 0) {
      container.innerHTML = "<p>Chưa có bài nghe nào — đang được đội ngũ chuẩn bị.</p>";
      return;
    }
    audioCases.forEach((c) => {
      const item = document.createElement("button");
      item.className = "kb-list-item";
      item.innerHTML = `
        <span class="kb-list-item-icon">🔊</span>
        <span class="kb-list-item-body">
          <span class="kb-category">${c.scam_category}</span>
          <strong>${c.title}</strong>
          <span class="kb-list-item-duration">${estimateDuration(c.audio_script)}</span>
        </span>`;
      item.addEventListener("click", () => openListenDetail(c));
      container.appendChild(item);
    });
  }

  async function openListenDetail(caseStudy) {
    currentListenCase = caseStudy;
    const listView = $("kb-listen-list"), detailView = $("kb-listen-detail");
    if (listView) listView.hidden = true;
    if (detailView) detailView.hidden = false;

    const category = $("kb-listen-category"), title = $("kb-listen-title"), textEl = $("kb-listen-text");
    if (category) category.textContent = "Loại lừa đảo: " + caseStudy.scam_category;
    if (title) title.textContent = caseStudy.title;
    if (textEl) textEl.textContent = caseStudy.audio_script;

    const knownBtn = $("kb-listen-known-btn"), newBtn = $("kb-listen-new-btn");
    if (knownBtn) knownBtn.disabled = false;
    if (newBtn) newBtn.disabled = false;
    const choiceRow = $("kb-listen-choice-row"), doneMsg = $("kb-listen-done-msg");
    if (choiceRow) choiceRow.hidden = false;
    if (doneMsg) doneMsg.hidden = true;

    const errEl = $("kb-listen-error");
    const audioEl = $("kb-listen-audio");
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = "🔊 Đang tạo giọng đọc tiếng Việt bằng AI...";
    }
    if (audioEl) { audioEl.hidden = true; audioEl.removeAttribute("src"); }

    try {
      const audioBlob = await Api.speakText(caseStudy.audio_script); // trả về Blob, không phải URL
      if (errEl) errEl.hidden = true;
      if (audioEl && audioBlob) {
        audioEl.hidden = false;
        audioEl.src = URL.createObjectURL(audioBlob);
        audioEl.play().catch(() => { /* trình duyệt chặn autoplay — người dùng tự bấm play, không phải lỗi */ });
      }
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = "⚠️ Không tạo được giọng đọc: " + err.message + " — bạn vẫn đọc được nội dung bên dưới.";
      }
      if (audioEl) audioEl.hidden = true;
    }
  }

  function backToListenList() {
    const listView = $("kb-listen-list"), detailView = $("kb-listen-detail");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
    const audioEl = $("kb-listen-audio");
    if (audioEl) { audioEl.pause(); }
  }

  function markSeenListen(points) {
    if (!currentListenCase) return;
    const knownBtn = $("kb-listen-known-btn"), newBtn = $("kb-listen-new-btn");
    if (knownBtn) knownBtn.disabled = true;
    if (newBtn) newBtn.disabled = true;

    grantPoints(currentListenCase, points);

    const choiceRow = $("kb-listen-choice-row"), doneMsg = $("kb-listen-done-msg");
    if (choiceRow) choiceRow.hidden = true;
    if (doneMsg) doneMsg.hidden = false;
  }

  // ============== CHUYỂN ĐỔI PANEL ĐỌC / NGHE / XEM ==============

  function setMode(mode) {
    document.querySelectorAll(".kb-mode-switch .mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    ["read", "listen", "watch"].forEach((m) => {
      const panel = $("kb-panel-" + m);
      if (panel) panel.hidden = m !== mode;
    });
    if (mode === "listen") {
      renderListenList();
      backToListenList(); // luôn quay về danh sách khi vừa chuyển sang tab Nghe
    }
  }

  // ============== INIT ==============

  async function init() {
    loadProgress();
    renderStats();
    renderAlertBanner();
    renderAchievements();

    const bind = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };

    bind("kb-known-btn", "click", () => markSeen(5));
    bind("kb-new-btn", "click", () => markSeen(10));
    bind("kb-next-btn", "click", loadNextCase);
    bind("kb-share-btn", "click", shareCase);
    bind("kb-listen-back-btn", "click", backToListenList);
    bind("kb-listen-known-btn", "click", () => markSeenListen(5));
    bind("kb-listen-new-btn", "click", () => markSeenListen(10));

    document.querySelectorAll(".kb-mode-switch .mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    try {
      allCases = await Api.listCases();
    } catch (_) { /* không chặn demo nếu lỗi — thành tích/panel Nghe sẽ chỉ thiếu dữ liệu */ }

    await loadDailyCase();
  }

  return { init };
})();