/**
 * main.js — chỉ điều hướng tab + gọi init() của từng module tính năng.
 * Không chứa logic nghiệp vụ (giữ đúng nguyên tắc mỗi file 1 việc,
 * tương ứng 1-1 với backend/api/*_endpoint.py).
 */
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  // Tiêu đề + mô tả hiển thị trên topbar, đổi theo tab đang chọn.
  const TAB_TITLES = {
    vision: ["Camera kính lúp", "Dán nội dung tin nhắn / lời mời đáng ngờ vào đây để kiểm tra"],
    arena: ["Cuộc gọi giả lập — Thực Chiến", "Luyện phản xạ chống lừa đảo qua các kịch bản mô phỏng cuộc gọi"],
    knowledge: ["Kho kiến thức & Daily Scam Alert", "Học 1 case mỗi ngày, tích điểm và giữ streak"],
  };
  const pageTitleEl = document.getElementById("page-title");
  const pageSubtitleEl = document.getElementById("page-subtitle");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      panels.forEach((p) => p.classList.toggle("is-active", p.id === "tab-" + target));

      const titleInfo = TAB_TITLES[target];
      if (titleInfo) {
        if (pageTitleEl) pageTitleEl.textContent = titleInfo[0];
        if (pageSubtitleEl) pageSubtitleEl.textContent = titleInfo[1];
      }
    });
  });

  // Bọc try/catch riêng từng module: nếu 1 tab lỗi khi khởi tạo, các tab
  // còn lại vẫn phải chạy được — tránh lặp lại lỗi dây chuyền đã từng xảy
  // ra (1 lỗi ReferenceError ở module này từng làm cả 3 tab đứng im).
  [
    ["VisionTab", typeof VisionTab !== "undefined" ? VisionTab : null],
    ["ArenaTab", typeof ArenaTab !== "undefined" ? ArenaTab : null],
    ["KnowledgeTab", typeof KnowledgeTab !== "undefined" ? KnowledgeTab : null],
  ].forEach(([name, tab]) => {
    try {
      if (!tab) throw new Error(`${name} không tồn tại — kiểm tra file JS tương ứng có export đúng biến này không.`);
      const res = tab.init();
      if (res && typeof res.catch === "function") {
        res.catch((err) => {
          console.error(`[main.js] Lỗi khởi tạo module ${name} (async):`, err);
        });
      }
    } catch (err) {
      console.error(`[main.js] Lỗi khởi tạo module ${name}:`, err);
    }
  });

  // Tự động cập nhật progress bar khi achievements grid có thay đổi
  const achievementsGrid = document.getElementById("kb-achievements-grid");
  if (achievementsGrid) {
    const updateProgress = () => {
      const badges = achievementsGrid.querySelectorAll(".kb-badge");
      const unlockedBadges = achievementsGrid.querySelectorAll(".kb-badge.unlocked");
      const progressText = document.getElementById("kb-progress-text");
      const progressBarFill = document.getElementById("kb-progress-bar-fill");
      if (progressText && progressBarFill) {
        const total = badges.length;
        const unlocked = unlockedBadges.length;
        progressText.textContent = `${unlocked}/${total}`;
        const percent = total > 0 ? (unlocked / total) * 100 : 0;
        progressBarFill.style.width = `${percent}%`;
      }
    };
    const observer = new MutationObserver(updateProgress);
    observer.observe(achievementsGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // Fallback tự giãn chiều cao cho .share-box (trình duyệt chưa hỗ trợ field-sizing: content)
  function autoResizeShareBox(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  // Patch setter để tự động resize mỗi khi .value được gán từ JS
  ["kb-share", "arena-share"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    Object.defineProperty(el, "value", {
      set(v) {
        proto.set.call(this, v);
        autoResizeShareBox(this);
      },
      get() { return proto.get.call(this); },
      configurable: true,
    });
  });

  SidebarNav.init({
    onNewChat: () => {
      // Nút "Kiểm tra mới": quay về tab Camera kính lúp với ô nhập trống.
      const visionTabBtn = document.querySelector('.tab-btn[data-tab="vision"]');
      if (visionTabBtn) visionTabBtn.click();
      VisionTab.resetInput();
    },
  });
});