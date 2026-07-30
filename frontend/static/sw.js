/**
 * sw.js — Service Worker tối giản để trang được trình duyệt công nhận là
 * PWA hợp lệ (điều kiện bắt buộc để hiện nút "Cài đặt ứng dụng"), đồng thời
 * cho phép mở lại "khung" app (giao diện tĩnh) khi mất mạng tạm thời.
 *
 * Nguyên tắc: CHỈ cache phần khung giao diện tĩnh (html/css/js/icon).
 * KHÔNG cache /api/*, /data/*, hay video YouTube — dữ liệu đó luôn cần
 * mạng thật, cache sẽ khiến kết quả bị cũ hoặc sai lệch.
 */
const CACHE_NAME = "qlt-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/api.js",
  "/js/sidebar.js",
  "/js/recorder.js",
  "/js/vision.js",
  "/js/arena.js",
  "/js/knowledge.js",
  "/js/videos.js",
  "/js/theme.js",
  "/js/main.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Không chặn cài đặt nếu 1 vài file lỗi (vd: đường dẫn khác nhau giữa các máy)
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Không đụng vào API và dữ liệu động — luôn phải là mạng thật, không cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/data/")) {
    return;
  }
  // Chỉ xử lý GET cùng gốc (bỏ qua YouTube, Google Fonts, v.v.)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Cache-first cho khung giao diện: phản hồi nhanh, vẫn âm thầm cập nhật lại từ mạng.
      return cached || network;
    })
  );
});
