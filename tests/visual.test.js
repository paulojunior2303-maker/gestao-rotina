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

  console.log('\n[2] Cores e botões');
  const cor = v => p.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);
  check(await cor('--t-gravacao') !== await cor('--t-imprevisto'), `gravação (${await cor('--t-gravacao')}) tem cor diferente do imprevisto (${await cor('--t-imprevisto')})`);
  await p.evaluate(() => { S.gravacoes.push({ id: 'g1', at: new Date().toISOString(), date: U.today(), time: '09:00', dur: 1800, status: 'pronta', partes: [{ n: 0, ini: 0, st: 'ok' }], tipo: 'reuniao', titulo: 'Alinhamento', resumo: 'ATA', combinados: [], audio: false }); commit(); });
  await go('agenda');
  const gv = p.locator('.blk-it[data-act=gvOpen]').first();
  check(await gv.count() === 1 && !(await gv.getAttribute('class')).includes('st-concluida') && (await gv.textContent()).includes('pronta'), 'gravação pronta na Agenda não aparece riscada ("Gravação · pronta")');
  const tdec = await gv.locator('.blk-title').evaluate(e => getComputedStyle(e).textDecorationLine);
  check(tdec === 'none', 'título da gravação sem risco');
  // + discreto e que sai da frente ao rolar para baixo
  check(await p.locator('#fab').evaluate(e => !getComputedStyle(e).backgroundImage.includes('gradient')), 'o + não é mais o botão roxo brilhante (o Gravar é o principal)');
  await go('tarefas'); await p.evaluate(() => { for (let i = 0; i < 12; i++) S.tasks.push({ id: 'x' + i, title: 'Tarefa ' + i, status: 'pendente', priority: 'media', category: 'administrativo', createdAt: new Date().toISOString() }); commit(); });
  await p.evaluate(() => window.scrollTo(0, 0)); await W(100);
  await p.mouse.wheel(0, 300); await p.evaluate(() => window.scrollBy(0, 300)); await W(400);
  check(await p.evaluate(() => document.body.classList.contains('fab-off')), 'rolando para baixo, o + sai da frente');
  await p.evaluate(() => window.scrollBy(0, -200)); await W(400);
  check(!(await p.evaluate(() => document.body.classList.contains('fab-off'))), 'rolando para cima, o + volta');
  await p.evaluate(() => window.scrollTo(0, 0)); await W(200);
  // botões de pelo menos 44 px no celular
  const peq = await p.evaluate(() => [...document.querySelectorAll('.topbar .icon-btn, .task .icon-btn')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length);
  check(peq === 0, 'botões do topo e das tarefas têm pelo menos 44 px');
  check(await p.locator('.demo-badge').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize)) >= 11, 'selo EXEMPLO com pelo menos 11 px');
  await shot('2-tarefas');

  console.log('\n[3] Tarefas abre com a lista, filtros num botão');
  check(!(await p.locator('select[data-k=priority]').isVisible()) && await p.locator('[data-act=tkFiltros]').isVisible(), 'filtros escondidos; botão "Filtros" visível');
  const y1 = await p.locator('.task').first().evaluate(e => e.getBoundingClientRect().top);
  check(y1 < 420, `a primeira tarefa aparece logo (y=${Math.round(y1)})`);
  check(await p.evaluate(() => document.querySelector('.stat-chips').scrollHeight <= 60), 'situações numa linha só (rola para o lado)');
  await p.locator('[data-act=tkFiltros]').tap(); await W();
  check(await p.locator('select[data-k=priority]').isVisible(), '"Filtros" abre os filtros');
  await p.selectOption('select[data-k=priority]', 'alta'); await W();
  check((await p.textContent('[data-act=tkFiltros]')).includes('1'), 'o botão mostra quantos filtros estão ligados');
  await p.locator('[data-act=tkFiltros]').tap(); await W();
  check(await p.locator('select[data-k=priority]').isVisible(), 'com filtro ligado, os filtros continuam à vista');
  await p.tap('[data-act=tkClear]'); await W();
  await p.fill('[data-input=tkSearch]', 'Tarefa 3'); await W(500);
  check(await p.locator('.task').count() === 1, 'a busca continua à vista e funciona');
  await p.fill('[data-input=tkSearch]', ''); await W(500);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 393, `Tarefas cabe em 393 px (${w}px)`);

  console.log('\n[4] Tema "Sol forte"');
  await go('config');
  await p.locator('[data-act=themeSet][data-v=sol]').tap(); await W(300);
  const at = await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.contraste, getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]);
  check(at[0] === 'light' && at[1] === 'alto' && at[2] === 'rgb(255, 255, 255)' && at[3] === 'rgb(0, 0, 0)', 'Sol forte: fundo branco e texto preto');
  const lum = c => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const r of ['dashboard', 'agenda', 'tarefas', 'gravacoes', 'imprevistos']) {
    await go(r);
    const pares = await p.evaluate(() => {
      const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !c.startsWith('rgba(0, 0, 0, 0)') && c !== 'transparent') return c; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
      return [...document.querySelectorAll('#view p, #view small, #view .muted, #view h2, #view h3, #view .tk-title, #view .blk-title')].filter(e => e.offsetParent && e.textContent.trim()).slice(0, 80).map(e => [getComputedStyle(e).color, bgOf(e), e.tagName + '.' + e.className]);
    });
    const fracos = pares.map(([f, b, n]) => [ratio(f, b), n]).filter(([x]) => x < 7);
    check(!fracos.length, `${r}: todo texto com contraste alto (≥ 7)${fracos.length ? ' → ' + fracos.slice(0, 3).map(([x, n]) => n + ' ' + x.toFixed(1)).join('; ') : ''}`);
    if (r === 'dashboard') await shot('4-sol');
  }
  await p.reload(); await W(600);
  check(await p.evaluate(() => document.documentElement.dataset.contraste) === 'alto', 'Sol forte continua ao reabrir o app');
  await go('config'); await p.locator('[data-act=themeSet][data-v=escuro]').tap(); await W(300);
  check(await p.evaluate(() => !document.documentElement.dataset.contraste && document.documentElement.dataset.theme === 'dark'), 'voltar para Escuro tira o contraste alto');

  console.log('\n[5] Revisão ui-ux-pro-max');
  await go('tarefas');
  check(await p.getAttribute('.stat-chip.active', 'aria-pressed') === 'true' && await p.locator('.stat-chip[aria-pressed=false]').count() === 4, 'situação escolhida é anunciada (aria-pressed)');
  await go('dashboard');
  check(await p.locator('.calx-mode .tab[aria-selected=true]').count() === 1, 'aba Semana/Mês escolhida é anunciada (aria-selected)');
  check(await p.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom) === '120px', 'foco do teclado não fica escondido atrás da barra de baixo');
  await p.evaluate(() => { S.settings.theme = 'claro'; commit(); }); await W();
  const lum2 = c => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const cores = await p.evaluate(() => ['--red', '--green'].map(v => { const d = document.createElement('i'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
  for (const c of cores) { const r = (1.05) / (lum2(c) + 0.05); check(r >= 4.5, `tema claro: ${c} legível sobre branco (${r.toFixed(2)})`); }
  await p.evaluate(() => { S.settings.theme = 'escuro'; commit(); }); await W();

  // __MAIS__

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
