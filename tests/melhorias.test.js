// Pontos a melhorar (auditoria): lembretes ligados, marcar reunião em Gravações, tarefa com horário x rotina
const { chromium } = require('playwright');
const useRoutine12 = require('./rotina-exemplo');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  // O Chromium de teste começa com notificações "negadas": simula o navegador comum, que ainda não perguntou
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) {} });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-11T08:05:00-03:00') });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = (ms = 300) => p.waitForTimeout(ms), M = '.modal-wrap.open';
  await p.goto('http://localhost:8765/'); await W(600);
  // 1. Lembretes ligados por padrão
  check(await p.evaluate(() => S.settings.lembretes.on), 'instalação nova: lembretes ligados');
  check(await p.evaluate(() => Store.migrate({ settings: { lembretes: { on: false } }, meta: { v2: true, v3: true, v4: true, v5: true } }).settings.lembretes.on), 'quem já usava com lembretes desligados passa a receber (uma vez)');
  await p.evaluate(() => { S.settings.lembretes.on = false; commit(); }); await p.reload(); await W(600);
  check(!(await p.evaluate(() => S.settings.lembretes.on)), 'desligou numa instalação nova: continua desligado ao reabrir');
  await p.evaluate(() => { S.settings.lembretes.on = true; commit(); App.render(); }); await W(300);
  check(await p.locator('.lem-card [data-act=lemWebOn]').count() === 1, 'navegador: cartão "Quer ser avisado no horário?" com "Permitir avisos"');
  await p.tap('.lem-card [data-act=lemWebNao]'); await W();
  check(await p.locator('.lem-card').count() === 0, '"Agora não" esconde o cartão');
  // 2. Marcar reunião / compromisso / feedback em Gravações
  await p.evaluate(() => { location.hash = '#gravacoes'; }); await W(400);
  await p.tap('[data-act=gvMarcar]'); await W();
  const op = await p.locator('.sheet-item').allTextContents();
  check(op.some(t => t.includes('Reunião')) && op.some(t => t.includes('Compromisso')) && op.some(t => t.includes('Feedback sem gravar')), 'Gravações → "Marcar reunião ou compromisso": reunião, compromisso e feedback');
  await p.tap('.sheet-item:has-text("Reunião")'); await W(400);
  await p.fill(`${M} [name=title]`, 'Reunião de metas'); await p.fill(`${M} [name=date]`, '2026-11-13'); await p.fill(`${M} [name=time]`, '10:00');
  await p.tap(`${M} [data-submit]`); await W(400);
  check(await p.evaluate(() => S.events.some(e => e.title === 'Reunião de metas' && e.date === '2026-11-13' && e.reuniao)), 'reunião futura marcada (aparece no calendário)');
  // 4. Tarefa com horário x rotina
  await useRoutine12(p);
  await p.evaluate(() => { S.days = {}; S.settings.breakMode = 'fixo'; commit(); location.hash = '#agenda'; App.ui.agendaDate = U.today(); });
  await W(400);
  await p.evaluate(() => Actions.quickAdd({}));  await W(300);
  await p.locator(`${M} #cap-t`).fill('Visita no cliente às 14h'); await W(200);
  await p.selectOption(`${M} #cap-dur`, '60'); await p.tap(`${M} [data-save]`); await W(400);
  check((await p.locator('.toast').last().textContent()).includes('Bate com') && await p.locator('.toast .link:has-text("Reorganizar")').count() === 1, 'tarefa com horário que bate com a rotina avisa e oferece "Reorganizar"');
  check(await p.locator('.ag-bate').count() === 1 && await p.locator('.blk-it:has-text("Visita no cliente") .badge:has-text("Conflito")').count() === 1, 'Agenda mostra o aviso e marca a tarefa como Conflito');
  const plano = await p.evaluate(() => Replan.plan(U.today()).map(x => [x.b.title, x.start, x.end]));
  const bateu = plano.filter(([, s, e]) => s < '15:00' && e > '14:00');
  check(!bateu.length, 'Reorganizar: nenhuma atividade da rotina fica entre 14:00 e 15:00 (desvia da tarefa)');
  await p.evaluate(() => { const r = Replan.apply(U.today(), Replan.plan(U.today())); commit(); App.render(); });
  await W(300);
  check(await p.locator('.ag-bate').count() === 0, 'depois de reorganizar, o aviso some');
  // Imprevistos em destaque (vêm antes de tudo)
  await p.evaluate(() => { S.occurrences = []; S.tasks.forEach(t => { if (t.status === 'andamento') t.status = 'pendente'; });
    S.tasks.push({ id: 'trun', title: 'Tarefa rodando', status: 'andamento', priority: 'media', category: 'administrativo', dueDate: U.today(), dueTime: '08:00', createdAt: '' }); commit(); location.hash = '#agenda'; });
  await W(400);
  await p.evaluate(() => { location.hash = '#tarefas'; }); await W(300);
  check(await p.locator('.oc-card').count() === 0 && await p.locator('.tk-oc').count() === 1, 'sem imprevisto: só o botão ⚠ em Tarefas');
  await p.tap('.tk-oc'); await W(300);
  check(await p.locator(`${M} [data-type=imprevisto].active`).count() === 1 && await p.locator(`${M} #cap-odue`).count() === 0, '⚠ abre o registro de imprevisto, sem prazo');
  await p.locator(`${M} #cap-t`).fill('Câmera do portão caiu'); await p.tap(`${M} [data-save]`); await W(400);
  check(await p.locator('.oc-card', { hasText: 'Câmera do portão caiu' }).count() === 1, 'imprevisto registrado aparece em destaque no topo de Tarefas');
  await p.evaluate(() => { location.hash = '#agenda'; }); await W(300);
  check(await p.locator('.oc-card', { hasText: 'Câmera do portão caiu' }).count() === 1, '…e no topo da agenda do dia');
  await p.evaluate(() => { location.hash = '#dashboard'; }); await W(300);
  check(await p.locator('.oc-card', { hasText: 'Câmera do portão caiu' }).count() === 1 && await p.locator('.calx-d.today.has-occ').count() === 1, '…e no Início, com o dia de hoje marcado no calendário');
  await p.tap('.oc-card [data-act=occComecar]'); await W(400);
  let s9 = await p.evaluate(() => ({ o: S.occurrences.find(o => o.title === 'Câmera do portão caiu'), t: S.tasks.find(t => t.id === 'trun'), d: D.dayBlocks(U.today()) }));
  check(s9.o.status === 'andamento' && s9.o.scheduled && s9.d.some(b => b.occurrenceId === s9.o.id) && s9.t.status === 'pendente', '"Começar": entra na agenda agora e pausa a tarefa que estava em execução');
  await p.evaluate(() => Actions.tkSet({ id: 'trun', s: 'andamento' })); await W(200);
  check((await p.evaluate(() => S.tasks.find(t => t.id === 'trun').status)) === 'pendente', 'enquanto o imprevisto está em andamento, nenhuma tarefa começa');
  await p.tap('.oc-card.run [data-s=concluida]'); await W(400);
  check(await p.locator('.oc-card').count() === 0 && (await p.evaluate(() => S.occurrences[0].status)) === 'concluida', '"Resolvido" tira o imprevisto do destaque');
  check(!errs.length, 'sem erros' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
