// Ajustes da revisão de design (skill impeccable): semana começando no domingo, cores, botões,
// Tarefas sem a parede de filtros e o tema "Sol forte".
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage();
  // Quarta-feira, 11/11/2026, 10:02 (horário de Brasília)
  await p.clock.install({ time: new Date('2026-11-11T10:02:00-03:00') });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 250) => p.waitForTimeout(ms);
  const go = async r => { await p.evaluate(r => { location.hash = '#' + r; }, r); await W(); };
  const shot = n => p.screenshot({ path: `${OUT}/visual-${n}.png` });
  await p.goto('http://localhost:8765/'); await W(500);
  await p.evaluate(() => { Store.loadDemo(); S.settings.usuario = 'Paulo'; commit(); });

  console.log('\n[1] Semana começa no domingo');
  await go('dashboard');
  const wd = await p.locator('.cal-home .calx-wd span').allTextContents();
  check(wd[0] === 'Dom' && wd[6] === 'Sáb', 'cabeçalho do calendário: Dom … Sáb');
  const firstDay = await p.evaluate(() => Cal.range({ mode: 'month', anchor: U.today() }).cells[0]);
  check(new Date(firstDay + 'T12:00').getDay() === 0, `a grade do mês começa num domingo (${firstDay})`);
  check(await p.evaluate(() => Cal.inicioSemana('2026-11-11')) === '2026-11-08', 'semana de quarta 11/11 começa no domingo 08/11');
  await go('agenda');
  check(await p.textContent('.ag-cal .calx-title, .ag-cal h3, .ag-cal .calx-head').then(t => /8 a 14/.test(t)).catch(() => false) || await p.evaluate(() => Cal.title({ mode: 'week', anchor: '2026-11-11' })) === '8 a 14 de novembro', 'semana da Agenda: 8 a 14 de novembro');

  // __MAIS__

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
