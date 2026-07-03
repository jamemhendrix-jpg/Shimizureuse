/* 100億コンパス — Service Worker
   オフラインキャッシュ + 毎日リマインド通知(Periodic Background Sync) */
"use strict";
const CACHE = "hyakuoku-compass-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});

const REMIND_BODIES = [
  "今日も開くだけで前進。連続記録を守ろう。",
  "100億への道は、今日の1タップから。",
  "最悪の日は、開くだけで合格。",
  "目標を忘れない。それが一番の才能。",
  "好きな車は逃げない。今日も1ミリ前へ。",
];

self.addEventListener("periodicsync", e => {
  if (e.tag !== "daily-reminder") return;
  const body = REMIND_BODIES[Math.floor(Date.now() / 86400000) % REMIND_BODIES.length];
  e.waitUntil(self.registration.showNotification("🧭 100億コンパス", {
    body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "daily-reminder",
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
      for (const w of ws) if ("focus" in w) return w.focus();
      return clients.openWindow("./");
    })
  );
});
