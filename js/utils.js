'use strict';
/* Utilitários gerais: datas, horários, texto, ícones e download */
const U = (() => {
  const pad = n => String(n).padStart(2, '0');
  const WD = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const key = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
  const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const today = () => key();
  const weekday = k => parse(k).getDay();
  const weekStart = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return key(d); };
  const monthKey = k => k.slice(0, 7);
  const monthStart = mk => `${mk}-01`;
  const monthEnd = mk => { const [y, m] = mk.split('-').map(Number); return key(new Date(y, m, 0)); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => { m = Math.max(0, Math.min(1439, Math.round(m))); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const nowTime = () => fromMin(nowMin());
  const fmtDate = k => { if (!k) return '—'; const [y, m, d] = k.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const fmtShort = k => { if (!k) return '—'; const [, m, d] = k.slice(0, 10).split('-'); return `${d}/${m}`; };
  const fmtLong = k => { const d = parse(k); return `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`; };
  const fmtMonth = mk => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} de ${y}`; };
  const fmtDateTime = iso => { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDur = min => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h${pad(m)}` : `${h}h`) : `${m} min`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
  const fmtNum = n => (n === null || n === undefined || Number.isNaN(n)) ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const daysInRange = (a, b) => { const out = []; let k = a; let guard = 0; while (k <= b && guard++ < 4000) { out.push(k); k = addDays(k, 1); } return out; };

  function download(filename, blob) {
    if (typeof Native !== 'undefined' && Native.available()) { Native.save(filename, blob); return; }
    if (typeof Cloud !== 'undefined' && Cloud.downloads) { Cloud.save(filename, blob); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    week: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13v5M12 13v5M16 13v5"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
    tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    kanban: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v10"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M11 10v8M15 12v6M19 6v12"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M18 15l-6-6-6 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    printer: '<path d="M6 9V2h12v7"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    timeline: '<path d="M3 6h10M7 12h12M5 18h8"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    pause: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
  };
  const icon = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  return { pad, WD, WD_SHORT, MONTHS, key, parse, addDays, addMonths, today, weekday, weekStart, monthKey, monthStart, monthEnd, diffDays, toMin, fromMin, nowMin, nowTime, fmtDate, fmtShort, fmtLong, fmtMonth, fmtDateTime, fmtDur, esc, uid, clamp, plural, fmtNum, daysInRange, download, icon };
})();
