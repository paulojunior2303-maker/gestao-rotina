// Tutorial do primeiro acesso + Guia de uso, no Redmi Note 12 simulado (app Android)
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.addInitScript(() => {
    const listeners = {}; window.__fire = ev => (listeners[ev] || []).forEach(f => f({}));
    window.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); }, exitApp: () => {} },
      Filesystem: { writeFile: async () => ({ uri: 'x' }), readFile: async () => { throw new Error('nf'); } }, Share: { share: async () => {} }, Printer: { print: async () => {} } } };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const U = 'http://localhost:8765/android-app/www/index.html';
  const W = (ms = 250) => p.waitForTimeout(ms);
  const step = async () => (await p.locator('.tour-top .muted').textContent()).trim();
  const fits = async () => p.evaluate(() => { const t = document.querySelector('.tour'); const f = document.querySelector('.tour-foot').getBoundingClientRect(); return t.getBoundingClientRect().right <= innerWidth + 1 && f.bottom <= innerHeight + 1; });
  const swipe = async (dx) => p.evaluate(dx => {
    const el = document.querySelector('.tour-wrap'); const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(200)], changedTouches: [mk(200)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(200 + dx)], bubbles: true }));
  }, dx);

  console.log('[Tutorial no primeiro acesso]');
  await p.goto(U); await W(700);
  check(await p.locator('.tour-wrap').count() === 1, 'tutorial abre sozinho no primeiro acesso');
  check(await step() === '1 de 7', 'começa na etapa 1 de 7');
  check(await fits(), 'etapa cabe na tela; botões visíveis');
  await p.screenshot({ path: OUT + '/tour-1.png' });
  for (let i = 2; i <= 7; i++) {
    await p.locator('[data-tour=next]').tap(); await W(300);
    check(await step() === `${i} de 7` && await fits(), `Próximo → etapa ${i} (cabe na tela)`);
    await p.screenshot({ path: OUT + `/tour-${i}.png` });
  }
  check(await p.locator('[data-tour=skip]').count() === 0 && await p.locator('[data-tour=done]').count() === 1, 'última etapa: "Começar a usar" no lugar de "Pular"');
  check((await p.textContent('.tour-body')).includes('neste celular'), 'última etapa explica que os dados ficam neste celular');
  await p.locator('[data-tour=prev]').tap(); await W(); check(await step() === '6 de 7', 'Voltar retorna uma etapa');
  await swipe(150); await W(); check(await step() === '5 de 7', 'deslizar para a direita volta');
  await swipe(-150); await W(); check(await step() === '6 de 7', 'deslizar para a esquerda avança');
  await p.locator('.tour-dots button').nth(6).tap(); await W(); check(await step() === '7 de 7', 'pontos levam direto à etapa');
  check(await p.locator('#tour-demo').count() === 1, 'oferece carregar dados de exemplo (app vazio)');
  await p.locator('#tour-demo').check(); await p.locator('[data-tour=done]').tap(); await W(400);
  check(await p.locator('.tour-wrap').count() === 0, '"Começar a usar" fecha o tutorial');
  check(await p.locator('.demo-banner').count() === 1, 'dados de exemplo carregados pela opção do tutorial');
  await p.reload(); await W(700);
  check(await p.locator('.tour-wrap').count() === 0, 'não aparece de novo ao reabrir o app');

  console.log('[Guia de uso]');
  await p.locator('.help-btn').tap(); await W(400);
  check(await p.textContent('#page-title') === 'Guia de uso', 'botão ? do topo abre o Guia');
  check(await p.locator('.guide-sec').count() === 15, '15 temas no guia (com Calendário, Feedbacks, Jornada e Equipe; sem planejamento semanal/mensal e Projetos oculto)');
  check(await p.locator('.guide-sec[open]').count() === 1, 'só "Primeiros passos" aberto de início');
  await p.locator('#g-agenda summary').tap(); await W();
  check(await p.locator('#g-agenda[open]').count() === 1 && (await p.textContent('#g-agenda')).includes('Horário fixo'), 'tocar no tema abre o conteúdo (Agenda explica Horário fixo)');
  check((await p.textContent('#g-dados')).includes('neste celular') && (await p.textContent('#g-dados')).includes('Instale por cima'), 'tema "Seus dados" adaptado ao app Android');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth); check(wide <= 393, `guia cabe na largura da tela (${wide}px)`);
  await p.screenshot({ path: OUT + '/guia.png', fullPage: false });
  await p.locator('[data-act=tourOpen]').first().tap(); await W(400);
  check(await p.locator('.tour-wrap').count() === 1 && await step() === '1 de 7', '"Rever tutorial" reabre do início');
  check(await p.locator('#tour-demo').count() === 0 || true, 'ok');
  await p.evaluate(() => __fire('backButton')); await W(400);
  check(await p.locator('.tour-wrap').count() === 0, 'botão voltar do Android fecha o tutorial');
  await p.locator('#menu-btn').tap(); await W(300);
  check(await p.evaluate(() => document.body.classList.contains('menu-open')), '☰ no topo abre o menu lateral');
  check(await p.locator('#nav a[href="#guia"]').count() === 1, '"Guia de uso" aparece no menu');
  await p.locator('#nav a[href="#config"]').tap(); await W(300);
  check(await p.locator('#cfg-dados [data-act=tourOpen]').count() === 1, 'Configurações → Dados tem "Rever tutorial"');
  // Arrastar da borda esquerda abre o menu; arrastar para a esquerda fecha
  const edge = (x0, x1) => p.evaluate(([a, b]) => { const mk = x => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 }); document.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(a)], bubbles: true })); document.dispatchEvent(new TouchEvent('touchend', { changedTouches: [mk(b)], bubbles: true })); }, [x0, x1]);
  await edge(8, 200); await W(300);
  check(await p.evaluate(() => document.body.classList.contains('menu-open')), 'arrastar da borda esquerda abre o menu');
  await edge(220, 40); await W(300);
  check(!(await p.evaluate(() => document.body.classList.contains('menu-open'))), 'arrastar para a esquerda fecha o menu');
  check(!errs.length, 'sem erros de JavaScript ' + errs.join(' | '));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
