// Gera os ícones e as telas de abertura do Android a partir da marca do app (renderizado no Chromium).
// Uso (na pasta android-app): node tools/icons.js
const { chromium } = require('playwright');
const path = require('path');
const RES = path.join(__dirname, '../android/app/src/main/res');
const BG = '#100d17';
// Marca: anel do dia (roxo) com o ponto "agora" (lilás). k = escala, centro em (256,256).
const mark = (k = 1) => `<g transform="translate(256 256) scale(${k}) translate(-256 -256)"><circle cx="256" cy="256" r="150" fill="none" stroke="#9461f5" stroke-opacity=".2" stroke-width="52"/><path d="M256 106a150 150 0 1 1-142.5 196.1" fill="none" stroke="#9461f5" stroke-width="52" stroke-linecap="round"/><circle cx="113.5" cy="302.1" r="38" fill="#e6dcff"/></g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
const ICON = { full: `<rect width="512" height="512" rx="112" fill="${BG}"/>${mark(1)}`, round: `<circle cx="256" cy="256" r="256" fill="${BG}"/>${mark(.92)}`, fg: mark(.62) };
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const shot = async (w, h, html, file) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (const [d, f] of Object.entries(DENS)) {
    const s = 48 * f, fg = 108 * f;
    await shot(s, s, svg(s, s, ICON.full), `${RES}/mipmap-${d}/ic_launcher.png`);
    await shot(s, s, svg(s, s, ICON.round), `${RES}/mipmap-${d}/ic_launcher_round.png`);
    await shot(fg, fg, svg(fg, fg, ICON.fg), `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
  }
  // Telas de abertura: fundo escuro com a marca no centro
  const splash = (w, h) => `<div style="width:${w}px;height:${h}px;background:${BG};display:grid;place-items:center"><svg width="${Math.round(Math.min(w, h) * .28)}" height="${Math.round(Math.min(w, h) * .28)}" viewBox="0 0 512 512">${mark(1)}</svg></div>`;
  const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [d, [w, h]] of Object.entries(sizes)) {
    await shot(w, h, splash(w, h), `${RES}/drawable-port-${d}/splash.png`);
    await shot(h, w, splash(h, w), `${RES}/drawable-land-${d}/splash.png`);
  }
  await shot(480, 320, splash(480, 320), `${RES}/drawable/splash.png`);
  await b.close();
  console.log('ícones e splash gerados');
})();
