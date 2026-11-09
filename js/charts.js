'use strict';
/* Gráficos em SVG puro (sem bibliotecas externas). Valores null = "sem dados" (não desenha barra). */
const Charts = (() => {
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* series: [{name, color, values:[number|null]}] */
  function bars({ labels, series, height = 220, unit = '', maxValue }) {
    const all = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
    if (!all.length) return `<div class="chart-empty">${U.icon('chart', 22)}<span>Sem dados no período</span></div>`;
    const W = 640, Hh = height;
    const padL = 36, padB = 26, padT = 12, padR = 8;
    const max = maxValue || niceMax(Math.max(...all));
    const cw = (W - padL - padR) / labels.length;
    const bw = Math.min(28, (cw - 6) / series.length);
    const y = v => padT + (Hh - padT - padB) * (1 - v / max);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      g += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL - 6}" y="${yy + 4}" class="axis" text-anchor="end">${U.fmtNum(v)}</text>`;
    }
    const step = Math.ceil(labels.length / 10);
    labels.forEach((l, i) => {
      const cx = padL + cw * i + cw / 2;
      if (i % step === 0) g += `<text x="${cx}" y="${Hh - 8}" class="axis" text-anchor="middle">${U.esc(l)}</text>`;
      series.forEach((s, j) => {
        const v = s.values[i];
        const x = cx - (bw * series.length) / 2 + j * bw;
        if (v === null || v === undefined) { g += `<rect x="${x + 1}" y="${y(0) - 2}" width="${bw - 2}" height="2" class="nodata"><title>${U.esc(l)} — ${U.esc(s.name)}: sem dados</title></rect>`; return; }
        const h = Math.max(1, y(0) - y(v));
        g += `<rect x="${x + 1}" y="${y(0) - h}" width="${bw - 2}" height="${h}" rx="3" fill="${s.color}"><title>${U.esc(l)} — ${U.esc(s.name)}: ${U.fmtNum(v)}${unit}</title></rect>`;
        if (labels.length <= 12) g += `<text x="${x + bw / 2}" y="${y(0) - h - 4}" class="val" text-anchor="middle">${U.fmtNum(v)}</text>`;
      });
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${U.esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart-scroll"><svg class="chart" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMinYMid meet">${g}</svg></div>${legend}`;
  }

  function ring(pct, { size = 92, stroke = 9, color = 'var(--blue)', label } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const val = pct === null || pct === undefined ? 0 : pct;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg" fill="none"/>
      ${val > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke="${color}" stroke-linecap="round"
        stroke-dasharray="${c * val / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="ring-txt">${label ?? (pct === null || pct === undefined ? '—' : pct + '%')}</text></svg>`;
  }

  /* Barras horizontais: rows [{label, value, color}] */
  function hbars(rows, unit = '') {
    const vals = rows.map(r => r.value).filter(v => v !== null);
    if (!vals.length) return `<div class="chart-empty">${U.icon('chart', 22)}<span>Sem dados no período</span></div>`;
    const max = Math.max(...vals, 1);
    return `<div class="hbars">${rows.map(r => `<div class="hb-row"><span class="hb-l" title="${U.esc(r.label)}">${U.esc(r.label)}</span><div class="hb-track"><span style="width:${r.value === null ? 0 : r.value / max * 100}%;background:${r.color || 'var(--blue)'}"></span></div><span class="hb-v">${r.value === null ? 'sem dados' : U.fmtNum(r.value) + unit}</span></div>`).join('')}</div>`;
  }

  return { bars, ring, hbars };
})();
