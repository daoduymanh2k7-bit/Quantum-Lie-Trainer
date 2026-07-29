/**
 * sidebar.js — cột bên trái luôn hiển thị, kiểu Gemini:
 *  - Thu nhỏ: chỉ còn dải icon (nút mở rộng + nút "+" kiểm tra mới).
 *  - Mở rộng: hiện thêm nhãn chữ + danh sách lịch sử câu hỏi.
 * Bấm lại nút thu/mở sẽ đảo trạng thái. Không lưu server, chỉ giữ
 * trong bộ nhớ JS của phiên trình duyệt hiện tại.
 */
const SidebarNav = (() => {
  let sidebar, toggleBtn, brandMark, newBtn, listEl, emptyNote;
  let themeBtn, sunIcon, moonIcon;
  let onNewChat = null;

  const THEME_KEY = "qlt-theme";

  function init(options = {}) {
    onNewChat = options.onNewChat || null;

    sidebar = document.getElementById("app-sidebar");
    toggleBtn = document.getElementById("sidebar-toggle-btn");
    brandMark = document.getElementById("sidebar-brand-mark");
    newBtn = document.getElementById("sidebar-new-btn");
    listEl = document.getElementById("sidebar-history-list");
    emptyNote = document.getElementById("sidebar-empty-note");

    themeBtn = document.getElementById("sidebar-theme-btn");
    sunIcon = document.getElementById("theme-icon-sun");
    moonIcon = document.getElementById("theme-icon-moon");

    toggleBtn.addEventListener("click", toggle);
    if (brandMark) brandMark.addEventListener("click", toggle);

    newBtn.addEventListener("click", () => {
      if (typeof onNewChat === "function") onNewChat();
    });

    initTheme();
    themeBtn.addEventListener("click", toggleTheme);
  }

  function toggle() {
    const expanded = sidebar.classList.toggle("is-expanded");
    document.body.classList.toggle("sidebar-is-expanded", expanded);
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* Safari private mode, v.v. */ }
    applyTheme(saved || "dark");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* bỏ qua nếu không lưu được */ }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    sunIcon.hidden = isDark;
    moonIcon.hidden = !isDark;
  }

  /**
   * Thêm 1 câu hỏi vào lịch sử hiển thị trong sidebar.
   * @param {string} label - nhãn ngắn hiển thị (vd: trích đoạn câu hỏi)
   * @param {Function} onClick - hàm gọi khi người dùng bấm vào mục này
   */
  function addHistoryItem(label, onClick) {
    if (emptyNote) { emptyNote.remove(); emptyNote = null; }

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "sidebar-history-item";
    btn.textContent = label;
    btn.title = label;
    if (typeof onClick === "function") {
      btn.addEventListener("click", onClick);
    }
    li.appendChild(btn);
    listEl.prepend(li);
  }

  function clearHistory() {
    listEl.innerHTML = "";
    const li = document.createElement("li");
    li.className = "sidebar-empty";
    li.id = "sidebar-empty-note";
    li.textContent = "Chưa có câu hỏi nào trong phiên này.";
    listEl.appendChild(li);
    emptyNote = li;
  }

  return { init, toggle, addHistoryItem, clearHistory };
})();