// Gera ícones e telas de abertura do Android a partir de SVG (renderizado no Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const glyph = (s) => `<g transform="translate(${s.tx} ${s.ty}) scale(${s.k})"><rect x="96" y="120" width="320" height="280" rx="36" fill="none" stroke="#60a5fa" stroke-width="28"/><path d="M96 196h320" stroke="#60a5fa" stroke-width="28"/><path d="M190 296l44 44 92-92" fill="none" stroke="#4ade80" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const svgs = {
  full: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f1b2d"/>${glyph({ tx: 0, ty: 0, k: 1 })}</svg>`,
  round: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#0f1b2d"/>${glyph({ tx: 38, ty: 38, k: 0.85 })}</svg>`,
  // adaptativo: conteúdo dentro da zona segura central (66%)
  fg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${glyph({ tx: 256 - 256 * 0.62, ty: 256 - 260 * 0.62, k: 0.62 })}</svg>`,
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [k, svg] of Object.entries(svgs)) {
    await p.setViewportSize({ width: 1024, height: 1024 });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
    await p.screenshot({ path: `tools/${k}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  }
  await b.close();
})();
