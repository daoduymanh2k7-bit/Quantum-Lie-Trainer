/**
 * vision.js — tính năng Camera Kính Lúp, hiển thị dạng khung chat:
 * mỗi lần kiểm tra tạo 1 bong bóng "người dùng" (nội dung đã dán/đọc)
 * và 1 bong bóng "hệ thống" chứa thẻ kết quả (gauge, cờ đỏ, giải thích...).
 * Không lưu lịch sử trên server; toàn bộ thread chỉ giữ trong bộ nhớ JS
 * của phiên trình duyệt hiện tại, đúng tinh thần stateless của
 * backend/api/vision_endpoint.py.
 */
const VisionTab = (() => {
  const RISK_ICON = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" };
  // Vòng cung gauge dài 251 (chu vi cung 180°, r=80) — đi từ HIGH (đầy) về LOW (rỗng)
  const GAUGE_ARC_LENGTH = 251;

  const SAMPLE_CASES = {
    "🏦 Ví dụ: giả ngân hàng":
      "Ngan hang thong bao tai khoan cua ban co giao dich bat thuong. " +
      "Vui long doc ma OTP de xac minh tai khoan, neu khong tai khoan se bi khoa.",
    "🎉 Ví dụ: trúng thưởng":
      "Chuc mung ban da trung thuong chuong trinh tri an khach hang! " +
      "De nhan thuong vui long dong phi nhan thuong truoc qua chuyen khoan.",
    "✅ Ví dụ: tin nhắn bình thường":
      "Chào anh/chị, em là nhân viên tư vấn của cửa hàng, " +
      "đơn hàng của anh/chị đã được giao thành công, cảm ơn anh/chị đã ủng hộ.",
  };

  // Mirror thô của backend/vision/analyzer.py::RISK_KEYWORDS — dùng để "đoán" rủi ro
  // của tên file/ảnh đính kèm khi chưa có OCR thật. Nếu khớp từ khoá trong tên file
  // hoặc trong đoạn text đi kèm, ưu tiên dùng kết quả này (rule); nếu không khớp gì,
  // rơi về random xoay vòng (xem pickRandomLevel()).
  const FILE_RISK_KEYWORDS = {
    "trúng thưởng giả": ["trúng thưởng", "nhận giải", "phí nhận thưởng", "chương trình tri ân", "trung thuong", "qua tang"],
    "giả mạo ngân hàng": ["mã otp", "otp", "khóa tài khoản", "xác minh tài khoản", "đóng băng", "ngan hang", "chuyen khoan"],
    "đầu tư giả": ["lãi suất", "sinh lời", "đầu tư", "cam kết hoàn vốn", "lợi nhuận", "dau tu", "loi nhuan"],
    "giả công an/cơ quan chức năng": ["công an", "cơ quan điều tra", "rửa tiền", "tài khoản tạm giữ", "cong an", "trieu tap"],
  };
  const POINTS_PER_MATCH = 30;
  // Xoay vòng đều 3 mức khi không khớp rule nào, để bản demo không luôn ra cùng 1 kết quả.
  const RANDOM_LEVEL_CYCLE = ["LOW", "MEDIUM", "HIGH"];
  let randomLevelIndex = 0;

  let threadEl, emptyStateEl, textEl, checkBtn;
  let attachBtn, fileInputEl, previewRowEl;
  let pendingAttachment = null; // { file, dataUrl, isImage }

  function init() {
    threadEl = document.getElementById("vision-thread");
    emptyStateEl = document.getElementById("vision-empty-state");
    textEl = document.getElementById("vision-text");
    checkBtn = document.getElementById("vision-check-btn");
    attachBtn = document.getElementById("vision-attach-btn");
    fileInputEl = document.getElementById("vision-file-input");
    previewRowEl = document.getElementById("vision-attachment-preview");

    attachBtn.addEventListener("click", () => fileInputEl.click());
    fileInputEl.addEventListener("change", () => {
      const file = fileInputEl.files[0];
      if (file) handleFileSelected(file);
      fileInputEl.value = ""; // cho phép chọn lại đúng file đó lần sau
    });

    const sampleRow = document.getElementById("vision-samples");
    Object.entries(SAMPLE_CASES).forEach(([label, text]) => {
      const chip = document.createElement("button");
      chip.className = "sample-chip";
      chip.textContent = label;
      chip.addEventListener("click", () => {
        textEl.value = text;
        textEl.focus();
      });
      sampleRow.appendChild(chip);
    });

    attachMicButton(
      document.getElementById("vision-mic-btn"),
      document.getElementById("vision-mic-status"),
      (text) => { textEl.value = text; }
    );

    checkBtn.addEventListener("click", runCheck);

    // Enter để gửi, Shift+Enter để xuống dòng — giống ô chat quen thuộc.
    textEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runCheck();
      }
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fileIconFor(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "📕";
    if (name.endsWith(".doc") || name.endsWith(".docx")) return "📘";
    if (name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".csv")) return "📊";
    if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "🗜️";
    if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".m4a")) return "🎧";
    if (name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".webm")) return "🎬";
    return "📄";
  }

  function handleFileSelected(file) {
    // Demo: không upload/lưu server — chỉ đọc tại trình duyệt để hiển thị.
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB, tránh đơ trình duyệt khi encode base64
    if (file.size > MAX_SIZE) {
      alert("File quá lớn cho bản demo (tối đa 5MB). Vui lòng chọn file nhỏ hơn.");
      return;
    }
    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.onload = () => {
      pendingAttachment = { file, dataUrl: reader.result, isImage };
      renderPreview();
    };
    reader.readAsDataURL(file);
  }

  function renderPreview() {
    previewRowEl.innerHTML = "";
    if (!pendingAttachment) {
      previewRowEl.hidden = true;
      return;
    }
    previewRowEl.hidden = false;

    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    if (pendingAttachment.isImage) {
      const img = document.createElement("img");
      img.src = pendingAttachment.dataUrl;
      img.alt = pendingAttachment.file.name;
      chip.appendChild(img);
    } else {
      const icon = document.createElement("div");
      icon.className = "attachment-file-icon";
      icon.textContent = fileIconFor(pendingAttachment.file);
      chip.appendChild(icon);
    }

    const meta = document.createElement("div");
    meta.className = "attachment-meta";
    meta.innerHTML =
      `<div class="attachment-name">${pendingAttachment.file.name}</div>` +
      `<div class="attachment-size">${formatFileSize(pendingAttachment.file.size)}</div>`;
    chip.appendChild(meta);

    const removeBtn = document.createElement("button");
    removeBtn.className = "attachment-remove-btn";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Bỏ file đính kèm");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      pendingAttachment = null;
      renderPreview();
    });
    chip.appendChild(removeBtn);

    previewRowEl.appendChild(chip);
  }

  /**
   * Gắn phần hiển thị đính kèm (ảnh thật hoặc chip file) vào đầu 1 bong bóng đã có sẵn.
   */
  function attachmentNodeFor(attachment) {
    if (attachment.isImage) {
      const img = document.createElement("img");
      img.className = "chat-attachment-img";
      img.src = attachment.dataUrl;
      img.alt = attachment.file.name;
      return img;
    }
    const chip = document.createElement("div");
    chip.className = "chat-attachment-file";
    chip.innerHTML =
      `<div class="attachment-file-icon">${fileIconFor(attachment.file)}</div>` +
      `<div class="attachment-meta">` +
      `<div class="attachment-name">${attachment.file.name}</div>` +
      `<div class="attachment-size">${formatFileSize(attachment.file.size)}</div>` +
      `</div>`;
    return chip;
  }

  /**
   * "Phân tích" giả lập cho ảnh/file đính kèm (chưa có OCR thật trong bản demo).
   * Ưu tiên so khớp từ khoá trong tên file + text đi kèm (rule, giống analyzer.py);
   * nếu không khớp từ khoá nào, rơi về xoay vòng LOW → MEDIUM → HIGH.
   */
  function analyzeAttachment(attachment, accompanyingText) {
    const haystack =
      (accompanyingText || "").toLowerCase() + " " +
      attachment.file.name.toLowerCase().replace(/[-_.]/g, " ");

    let bestCategory = null;
    let bestFlags = [];
    for (const [category, keywords] of Object.entries(FILE_RISK_KEYWORDS)) {
      const hits = keywords.filter((kw) => haystack.includes(kw));
      if (hits.length > bestFlags.length) {
        bestCategory = category;
        bestFlags = hits;
      }
    }

    if (bestFlags.length > 0) {
      const score = Math.min(100, bestFlags.length * POINTS_PER_MATCH);
      const level = score < 34 ? "LOW" : score < 67 ? "MEDIUM" : "HIGH";
      return {
        risk_score: score,
        risk_level: level,
        scam_category: bestCategory,
        explanation:
          `Tên file/nội dung đi kèm khớp ${bestFlags.length} từ khoá nghi vấn liên quan đến "${bestCategory}": ` +
          bestFlags.join(", ") +
          ". Đây là kết quả so khớp từ khoá trên ảnh/file (demo), chưa quét OCR thật.",
        red_flags: bestFlags,
      };
    }

    // Không khớp rule nào → xoay vòng đều 3 mức để demo minh hoạ đủ giao diện.
    const level = RANDOM_LEVEL_CYCLE[randomLevelIndex % RANDOM_LEVEL_CYCLE.length];
    randomLevelIndex += 1;
    const scoreByLevel = { LOW: 15, MEDIUM: 50, HIGH: 82 };
    return {
      risk_score: scoreByLevel[level],
      risk_level: level,
      scam_category: "Ảnh/tài liệu đính kèm (demo)",
      explanation:
        "Bản demo chưa tích hợp OCR/nhận diện ảnh thật nên không đọc được nội dung bên trong file. " +
        "Kết quả bên dưới là minh hoạ ngẫu nhiên cho giao diện — trong bản đầy đủ, hệ thống sẽ quét " +
        "văn bản/ảnh chụp màn hình để tìm dấu hiệu lừa đảo tương tự như với tin nhắn văn bản.",
      red_flags: [],
    };
  }

  function scrollToBottom() {
    threadEl.scrollTop = threadEl.scrollHeight;
    threadEl.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function hideEmptyState() {
    if (emptyStateEl) { emptyStateEl.hidden = true; }
  }

  function addUserBubble(text, attachment) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--user";
    if (attachment) {
      bubble.appendChild(attachmentNodeFor(attachment));
    }
    if (text) {
      const p = document.createElement("div");
      p.textContent = text;
      bubble.appendChild(p);
    }
    threadEl.appendChild(bubble);
    return bubble;
  }

  function addTypingBubble() {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--system chat-bubble--typing";
    bubble.innerHTML =
      "<p>🔎 Đã nhận nội dung cần kiểm tra.</p>" +
      "<p>📊 Đang so khớp với bộ từ khoá / mẫu câu nghi vấn phổ biến...</p>" +
      "<p>🧮 Đang tính điểm rủi ro theo luật tính điểm cố định...</p>";
    threadEl.appendChild(bubble);
    return bubble;
  }

  async function runCheck() {
    const text = textEl.value.trim();
    const attachment = pendingAttachment;

    if (!text && !attachment) {
      alert("Vui lòng nhập nội dung, hoặc đính kèm ảnh/file cần kiểm tra.");
      return;
    }

    hideEmptyState();
    addUserBubble(text, attachment);
    textEl.value = "";
    pendingAttachment = null;
    renderPreview();
    checkBtn.disabled = true;
    const typingBubble = addTypingBubble();
    scrollToBottom();

    try {
      // Có file đính kèm → chưa có OCR thật, dùng phân tích giả lập (rule + random xoay vòng).
      // Chỉ có text → dùng API rule-based thật ở backend như trước.
      const result = attachment ? analyzeAttachment(attachment, text) : await Api.analyzeText(text);
      typingBubble.remove();
      const resultBubble = buildResultBubble(result, text, attachment);
      threadEl.appendChild(resultBubble);
      scrollToBottom();

      const icon = RISK_ICON[result.risk_level] || "⚪";
      const snippetSource = text || (attachment ? attachment.file.name : "");
      const snippet = snippetSource.length > 42 ? snippetSource.slice(0, 42) + "…" : snippetSource;
      SidebarNav.addHistoryItem(`${icon} ${attachment ? "📎 " : ""}${snippet}`, () => {
        resultBubble.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (err) {
      typingBubble.classList.remove("chat-bubble--typing");
      typingBubble.innerHTML = `<p>❌ Có lỗi xảy ra: ${err.message}</p>`;
    } finally {
      checkBtn.disabled = false;
    }
  }

  function setGauge(gaugeRoot, score, level) {
    const clamped = Math.max(0, Math.min(100, score));
    const offset = GAUGE_ARC_LENGTH * (1 - clamped / 100);
    const fill = gaugeRoot.querySelector(".gauge-fill");
    fill.style.strokeDashoffset = offset;
    fill.style.stroke = level === "HIGH" ? "var(--color-danger)" : level === "MEDIUM" ? "var(--color-warning)" : "var(--color-safe)";

    // Kim quay từ -90deg (0 điểm, bên trái) đến +90deg (100 điểm, bên phải)
    const angle = -90 + (clamped / 100) * 180;
    gaugeRoot.querySelector(".gauge-needle").style.transform = `rotate(${angle}deg)`;

    gaugeRoot.querySelector(".gauge-score").textContent = Math.round(clamped);
    const levelEl = gaugeRoot.querySelector(".gauge-level");
    levelEl.textContent = level;
    levelEl.className = "gauge-level " + level;
  }

  /**
   * Dựng 1 bong bóng "hệ thống" chứa toàn bộ thẻ kết quả cho 1 lần kiểm tra.
   * Mỗi bong bóng có DOM riêng (không dùng id toàn cục) để nhiều kết quả
   * có thể cùng tồn tại trong thread mà không đè lên nhau.
   */
  function buildResultBubble(result, originalText) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--system";

    bubble.innerHTML = `
      <div class="result-card result-card--inline">
        <div class="gauge-wrap">
          <svg viewBox="0 0 200 120" class="risk-gauge">
            <path d="M20,110 A80,80 0 0,1 180,110" class="gauge-track"/>
            <path class="gauge-fill" d="M20,110 A80,80 0 0,1 180,110"/>
            <line class="gauge-needle" x1="100" y1="110" x2="100" y2="40"/>
            <circle cx="100" cy="110" r="6" class="gauge-hub"/>
          </svg>
          <div class="gauge-readout">
            <span class="gauge-score">0</span>
            <span class="gauge-max">/100</span>
          </div>
          <div class="gauge-level">—</div>
        </div>

        <h3 class="vision-category">—</h3>
        <p class="result-explanation"></p>

        <div class="vision-flags-wrap" hidden>
          <p class="field-label">Dấu hiệu cụ thể:</p>
          <ul class="flag-list"></ul>
        </div>

        <details class="why-box">
          <summary>Tại sao rủi ro này lại nguy hiểm?</summary>
          <p class="vision-why-text">Đang tải...</p>
        </details>

        <label class="field-label">Tạo văn bản cảnh báo để gửi cho người thân</label>
        <textarea class="share-box vision-share" rows="3" readonly></textarea>
      </div>
    `;

    const card = bubble.querySelector(".result-card");
    setGauge(card, result.risk_score, result.risk_level);
    card.querySelector(".vision-category").textContent = "Loại nghi vấn: " + result.scam_category;
    card.querySelector(".result-explanation").textContent = result.explanation;

    const flagsWrap = card.querySelector(".vision-flags-wrap");
    const flagsList = card.querySelector(".flag-list");
    if (result.red_flags && result.red_flags.length) {
      flagsWrap.hidden = false;
      result.red_flags.forEach((flag) => {
        const li = document.createElement("li");
        li.textContent = flag;
        flagsList.appendChild(li);
      });
    }

    const whyEl = card.querySelector(".vision-why-text");
    Api.categoryExplanation(result.scam_category)
      .then((res) => { whyEl.textContent = res.explanation; })
      .catch(() => { whyEl.textContent = "Không tải được giải thích chi tiết."; });

    const icon = RISK_ICON[result.risk_level] || "⚪";
    card.querySelector(".vision-share").value =
      `${icon} Cảnh báo lừa đảo (${result.risk_level}): ${result.scam_category}. ${result.explanation}`;

    return bubble;
  }

  function resetInput() {
    textEl.value = "";
    pendingAttachment = null;
    renderPreview();
    threadEl.querySelectorAll(".chat-bubble").forEach((el) => el.remove());
    if (emptyStateEl) emptyStateEl.hidden = false;
  }

  return { init, resetInput };
})();