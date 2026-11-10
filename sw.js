/* Service worker: permite uso offline quando o app é servido via http(s) */
const CACHE = 'gestao-rotina-v5';
const FILES = ['./', './index.html', './css/styles.css', './fonts/geist.woff2', './fonts/bricolage-grotesque.woff2', './icon.svg', './manifest.webmanifest',
  './js/utils.js', './js/store.js', './js/ui.js', './js/cloud.js', './js/native.js', './js/transfer.js', './js/lembretes.js', './js/ia.js', './js/drive.js', './js/charts.js', './js/xlsx.js', './js/reports.js', './js/app.js',
  './js/views/dashboard.js', './js/views/agenda.js', './js/views/imprevistos.js', './js/views/semanal.js', './js/views/mensal.js', './js/views/reunioes.js',
  './js/views/tarefas.js', './js/views/projetos.js', './js/views/indicadores.js', './js/views/config.js', './js/views/guia.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
/* Rede primeiro (sempre a versão mais nova), cache como reserva offline */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
/* Toque no aviso (lembretes no navegador): volta para o app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
