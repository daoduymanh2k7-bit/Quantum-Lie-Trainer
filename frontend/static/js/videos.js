/**
 * videos.js — mục "Xem" (🎬) trong Kho kiến thức: danh sách video cảnh báo
 * lừa đảo (YouTube) + màn xem chi tiết. Theo cùng khuôn mẫu list/detail của
 * mục "Nghe" trong knowledge.js (dùng lại class .kb-list-item có sẵn), nhưng
 * hoàn toàn độc lập — không sửa/gọi vào bên trong knowledge.js.
 *
 * Dữ liệu chỉ lưu `youtube_id` (data/fixtures/videos.json) — mọi URL cần
 * dùng (ảnh thumbnail, link nhúng, link xem trên YouTube) đều tự tính ra
 * từ id này, tránh sai lệch/URL nhúng sai định dạng như trước.
 *
 * Lưu ý: nếu chủ kênh (thường gặp ở kênh tin tức như VTV24, VTC...) tắt
 * tính năng nhúng video ngoài YouTube, khung nhúng sẽ báo "Video không có
 * sẵn" dù video vẫn tồn tại — đây là giới hạn phía YouTube, không sửa được
 * từ code. Vì vậy luôn hiển thị thêm nút "Mở trên YouTube" để chắc chắn
 * người dùng xem được video trong mọi trường hợp.
 */
const VideosTab = (() => {
  const $ = (id) => document.getElementById(id);
  let videos = [];
  let loaded = false;

  // File thật nằm ở data/fixtures/videos.json (gốc dự án, cùng chỗ với
  // case_studies.json — xem README mục 3), được backend/api/main.py mount
  // tĩnh riêng tại "/data". Dùng đường dẫn TUYỆT ĐỐI để không phụ thuộc
  // URL hiện tại của trang.
  const VIDEOS_URL = "/data/fixtures/videos.json";

  const thumbUrl = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  const embedUrl = (id) => `https://www.youtube.com/embed/${id}`;
  const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

  async function loadVideos() {
    if (loaded) return videos;
    const response = await fetch(VIDEOS_URL);
    if (!response.ok) {
      throw new Error(`Không tải được danh sách video (HTTP ${response.status})`);
    }
    videos = await response.json();
    loaded = true;
    return videos;
  }

  function renderList() {
    const container = $("kb-watch-list-items");
    if (!container) return;
    container.innerHTML = "";

    if (!videos || videos.length === 0) {
      container.innerHTML = "<p>Chưa có video nào — đang được đội ngũ chuẩn bị.</p>";
      return;
    }

    videos.forEach((v) => {
      const item = document.createElement("button");
      item.className = "kb-list-item";
      item.innerHTML = `
        <span class="kb-list-item-icon kb-list-item-thumb">
          <img src="${thumbUrl(v.youtube_id)}" alt="" loading="lazy">
        </span>
        <span class="kb-list-item-body">
          <span class="kb-category">${v.category || "Video cảnh báo"}</span>
          <strong>${v.title}</strong>
        </span>`;
      // Ảnh thumbnail lỗi (hiếm khi id sai) → rớt về icon 🎬 như trước, không vỡ layout.
      const img = item.querySelector("img");
      img.addEventListener("error", () => {
        img.replaceWith(Object.assign(document.createElement("span"), { textContent: "🎬" }));
      });
      item.addEventListener("click", () => openDetail(v));
      container.appendChild(item);
    });
  }

  function openDetail(video) {
    const listView = $("kb-watch-list"), detailView = $("kb-watch-detail");
    if (listView) listView.hidden = true;
    if (detailView) detailView.hidden = false;

    const categoryEl = $("kb-watch-category");
    const titleEl = $("kb-watch-title");
    const descEl = $("kb-watch-description");
    if (categoryEl) categoryEl.textContent = video.category || "Video cảnh báo";
    if (titleEl) titleEl.textContent = video.title;
    if (descEl) descEl.textContent = video.description || "";

    const frame = $("kb-watch-video-frame");
    if (frame) {
      // Khung 16:9 responsive + nút "Mở trên YouTube" LUÔN hiển thị ngay dưới,
      // không chỉ ẩn bên trong khung nhúng — phòng trường hợp video bị chặn nhúng.
      frame.innerHTML = `
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;">
          <iframe
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
            src="${embedUrl(video.youtube_id)}"
            title="${video.title}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen></iframe>
        </div>
        <a class="btn-secondary" href="${watchUrl(video.youtube_id)}" target="_blank" rel="noopener"
           style="display:inline-block;margin-top:12px;text-decoration:none;">
          ▶ Mở trên YouTube
        </a>`;
    }
  }

  function backToList() {
    const listView = $("kb-watch-list"), detailView = $("kb-watch-detail");
    if (listView) listView.hidden = false;
    if (detailView) detailView.hidden = true;
    // Gỡ iframe khỏi DOM khi quay lại danh sách để video dừng phát hẳn.
    const frame = $("kb-watch-video-frame");
    if (frame) frame.innerHTML = "";
  }

  /** Gọi mỗi khi người dùng chuyển sang tab con "Xem". */
  async function render() {
    const container = $("kb-watch-list-items");
    if (container && !loaded) container.innerHTML = "<p>Đang tải danh sách video...</p>";
    try {
      await loadVideos();
      renderList();
    } catch (err) {
      console.error("[videos.js] Lỗi tải danh sách video:", err);
      if (container) {
        container.innerHTML = `<p>⚠️ Không thể tải dữ liệu video lúc này: ${err.message}</p>`;
      }
    }
  }

  function init() {
    const backBtn = $("kb-watch-back-btn");
    if (backBtn) backBtn.addEventListener("click", backToList);

    // Nút chọn mode "Xem" thuộc .kb-mode-switch (do knowledge.js quản lý việc
    // ẩn/hiện panel). Ở đây chỉ lắng nghe THÊM sự kiện click trên cùng nút đó
    // để tự nạp danh sách video — không đụng vào logic setMode() của knowledge.js.
    const watchTabBtn = document.querySelector('.kb-mode-switch .mode-btn[data-mode="watch"]');
    if (watchTabBtn) watchTabBtn.addEventListener("click", render);
  }

  return { init, render };
})();
