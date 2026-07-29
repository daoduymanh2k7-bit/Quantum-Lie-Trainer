/**
 * theme.js — chuyển đổi giao diện sáng/tối bằng cách gắn/gỡ thuộc tính
 * data-theme trên <html>. Lựa chọn được nhớ trong localStorage của trình
 * duyệt, không gửi lên server (không cần backend hỗ trợ tính năng này).
 */
const ThemeToggle = (() => {
  const STORAGE_KEY = "qlt-theme";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Mặc định LUÔN là tối khi mở lần đầu (không đoán theo theme hệ điều hành nữa),
    // vì đây là màu nền chính của sản phẩm — người dùng có thể tự đổi qua nút toggle.
    apply(saved || "dark");

    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      apply(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  }

  return { init };
})();