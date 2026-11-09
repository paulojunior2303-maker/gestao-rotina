// Modo escuro: opção nas Configurações, persistência, modo automático e legibilidade em todas as telas
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: 'light' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = (ms = 250) => p.waitForTimeout(ms);
  const theme = () => p.evaluate(() => document.documentElement.dataset.theme);
  const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.goto('http://localhost:8765/index.html'); await W(600);
  await p.locator('[data-tour=skip]').tap(); await W(300);
  check(await theme() === 'light', 'padrão: modo claro');
  await p.evaluate(() => location.hash = '#config'); await W(300);
  check(await p.locator('#cfg-aparencia .theme-opt').count() === 3, 'Configurações → Aparência com 3 opções (Claro, Escuro, Automático)');
  await p.locator('[data-act=themeSet][data-v=escuro]').tap(); await W(300);
  check(await theme() === 'dark' && await bg() === 'rgb(11, 18, 32)', 'tocar em "Escuro" aplica o tema na hora');
  check(await p.locator('.theme-opt.on[data-v=escuro]').count() === 1, 'opção escolhida fica marcada');
  await p.reload(); await W(600);
  check(await theme() === 'dark', 'tema escuro mantido ao reabrir o app');
  // Contraste: texto principal sobre fundo dos cartões (WCAG AA ≥ 4.5)
  const lum = c => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const screens = ['dashboard', 'agenda', 'imprevistos', 'semanal', 'mensal', 'tarefas', 'projetos', 'indicadores', 'config', 'guia'];
  await p.evaluate(() => { Store.loadDemo(); commit(); });
  for (const r of screens) {
    await p.evaluate(r => location.hash = '#' + r, r); await W(300);
    const res = await p.evaluate(() => {
      const bad = [];
      const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !c.startsWith('rgba(0, 0, 0, 0)') && c !== 'transparent') return c; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
      const light = [];
      document.querySelectorAll('#view .card, #view .kpi, #view .blk, #view .task, #view .pj-card, #view .cal-cell, #view .occ').forEach(el => { const c = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number); if (c[0] > 200 && c[1] > 200 && c[2] > 200) light.push(el.className.split(' ')[0]); });
      const samples = [...document.querySelectorAll('#view h2, #view h3, #view .blk-title, #view .tk-title, #view .kpi-v, #view p, #view label, #view td, #view .li-main, #view .guide-body li')].slice(0, 60);
      return { light: [...new Set(light)], pairs: samples.filter(e => e.offsetParent).map(e => [getComputedStyle(e).color, bgOf(e), e.tagName + '.' + (e.className || '')]) };
    });
    const low = res.pairs.map(([fg, bgc, n]) => [ratio(fg, bgc), n]).filter(([r]) => r < 4.5);
    check(!res.light.length, `${r}: nenhum cartão branco sobrando no modo escuro${res.light.length ? ' → ' + res.light.join(', ') : ''}`);
    check(!low.length, `${r}: texto legível (contraste ≥ 4,5)${low.length ? ' → ' + low.slice(0, 3).map(([x, n]) => n + ' ' + x.toFixed(1)).join('; ') : ''}`);
    await p.screenshot({ path: `${OUT}/escuro-${r}.png` });
  }
  await p.evaluate(() => location.hash = '#tarefas'); await W(300);
  await p.locator('[data-act=tkNew]').tap(); await W(300);
  const inBg = await p.evaluate(() => getComputedStyle(document.querySelector('.modal-wrap.open [name=title]')).backgroundColor);
  check(inBg !== 'rgb(255, 255, 255)', 'campos dos formulários escuros também');
  await p.screenshot({ path: `${OUT}/escuro-formulario.png` });
  await p.keyboard.press('Escape'); await W(200);
  // Automático segue o aparelho
  await p.evaluate(() => location.hash = '#config'); await W(300);
  await p.locator('[data-act=themeSet][data-v=auto]').tap(); await W(300);
  check(await theme() === 'light', 'Automático com celular no tema claro → claro');
  await p.emulateMedia({ colorScheme: 'dark' }); await W(300);
  check(await theme() === 'dark', 'Automático: celular muda para escuro → app muda sozinho');
  await p.locator('[data-act=themeSet][data-v=claro]').tap(); await W(300);
  check(await theme() === 'light', 'voltar para "Claro" funciona mesmo com o celular no escuro');
  check(!errs.length, 'sem erros de JavaScript ' + errs.join(' | '));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
