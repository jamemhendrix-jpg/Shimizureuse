/* 100億コンパス — Service Worker
   オフラインキャッシュ + 毎日リマインド通知(Periodic Background Sync) */
"use strict";
const CACHE = "hyakuoku-compass-v3";
const ASSETS = ["./", "./index.html", "./guide.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
// guide.html(機能A)が renderAll のたびに書き込む通知ペイロードのキャッシュ名。
const NOTIFY_CACHE = "michibiki-notify";
const NOTIFY_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48時間

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
function fallbackReminderBody(now) {
  return REMIND_BODIES[Math.floor(now / 86400000) % REMIND_BODIES.length];
}
// 通知本文を決める(機能A: 指令つき通知)。payload は guide.html が Cache API に
// 書き込んだ { headline, goal, updatedAt } (無ければ null)。updatedAt が48時間以内なら
// 「指令見出し」+2行目に目標を載せる。無い/古い/壊れている場合は既存の日替わり文言にフォールバックする。
function pickReminderBody(payload, now) {
  now = typeof now === "number" ? now : Date.now();
  if (payload && typeof payload.headline === "string" && payload.headline
      && typeof payload.updatedAt === "string") {
    const updated = Date.parse(payload.updatedAt);
    if (!isNaN(updated) && (now - updated) <= NOTIFY_MAX_AGE_MS) {
      const goal = typeof payload.goal === "string" ? payload.goal : "";
      return goal ? `${payload.headline}\n${goal}` : payload.headline;
    }
  }
  return fallbackReminderBody(now);
}

self.addEventListener("periodicsync", e => {
  if (e.tag !== "daily-reminder") return;
  e.waitUntil(
    caches.open(NOTIFY_CACHE)
      .then(c => c.match("payload"))
      .then(res => (res ? res.json() : null))
      .catch(() => null)
      .then(payload => self.registration.showNotification("🧭 100億コンパス", {
        body: pickReminderBody(payload, Date.now()),
        icon: "icon-192.png",
        badge: "icon-192.png",
        tag: "daily-reminder",
      }))
  );
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
