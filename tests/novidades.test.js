// Novidades da versão "turbinada" (site de teste): Agora, Reorganizar meu dia, Abrir/Fechar o dia,
// tarefas que se repetem, pessoas, checklists, revisão da semana e formulários curtos.
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const useRoutine12 = require('./rotina-exemplo');
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
  const M = '.modal-wrap.open';
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1')));
  const go = async r => { await p.evaluate(r => { location.hash = '#' + r; }, r); await W(); };
  const tap = async sel => { await p.locator(sel).first().tap(); await W(); };
  const shot = n => p.screenshot({ path: `${OUT}/novidades-${n}.png`, fullPage: false });
  const fits = async n => { const w = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.modal-wrap.open .modal')].map(m => m.scrollWidth))); check(w <= 393, `${n}: cabe em 393 px (${w}px)`); };
  await p.goto('http://localhost:8765/'); await W(500);
  if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').click(); await W(); }
  await useRoutine12(p);
  await p.evaluate(() => { S.settings.technicians = [{ name: 'Carlos Souza', phone: '' }, { name: 'João' }]; S.settings.breakMode = 'fixo'; S.days = {}; commit(); });
  const today = '2026-11-11';
  const blk = (s, t) => s.days[today].find(x => x.title === t);

  console.log('\n[1] Início: Agora');
  await go('dashboard');
  check(await p.locator('.agora').count() === 1, 'cartão "Agora" no Início');
  check((await p.textContent('.agora .agr-now h3')).includes('Acompanhamento operacional'), 'mostra a atividade de agora');
  check((await p.textContent('.agora .agr-now .agr-l')).includes('faltam 28 min'), 'mostra quanto falta');
  check((await p.textContent('.agora .agr-next')).includes('Atividades administrativas'), 'mostra o que vem a seguir');
  check((await p.textContent('.agora .agr-late')).includes('2 atividades ficaram para trás'), 'avisa o que ficou para trás');
  await shot('1-agora'); await fits('Início');
  await tap('.agora [data-act=agoraMais]');
  let s = await st();
  check(blk(s, 'Acompanhamento operacional').end === '10:45' && blk(s, 'Atividades administrativas').start === '10:45', '"+15 min" estica a atual e empurra o resto');
  await tap('.agora [data-act=agoraDone]');
  s = await st();
  check(blk(s, 'Acompanhamento operacional').status === 'concluida' && blk(s, 'Acompanhamento operacional').end === '10:05', '"Concluir" encerra a atividade agora');
  check(await p.locator('.toast .link', { hasText: 'Adiantar o resto' }).count() === 1, 'oferece adiantar o resto da agenda');
  await tap('.toast .link');
  s = await st();
  check(blk(s, 'Atividades administrativas').start === '10:05', '"Adiantar o resto" puxa a próxima para agora');
  check(blk(s, 'Intervalo').start === '12:00', 'o intervalo (horário fixo) não muda');

  console.log('\n[1b] Para resolver hoje');
  await p.evaluate(() => { S.tasks.push({ id: 'tk-hoje', title: 'Enviar relatório ao cliente', status: 'pendente', priority: 'media', category: 'administrativo', dueDate: '2026-11-11', createdAt: new Date().toISOString() }); commit(); });
  await go('tarefas'); await go('dashboard');
  check(await p.locator('.hj-li', { hasText: 'Enviar relatório ao cliente' }).count() === 1, 'tarefa com prazo hoje aparece em "Para resolver hoje"');
  await p.locator('.hj-li', { hasText: 'Enviar relatório ao cliente' }).locator('[data-act=tkSet]').tap(); await W();
  s = await st();
  check(s.tasks.find(x => x.id === 'tk-hoje').status === 'concluida', '✓ na linha conclui a tarefa');

  console.log('\n[2] Reorganizar meu dia');
  await tap('.agora [data-act=agoraReplan]');
  check(await p.locator(`${M} h2`, { hasText: 'Reorganizar meu dia' }).count() === 1, 'abre a prévia "Reorganizar meu dia"');
  check(await p.locator(`${M} #rp-late:checked`).count() === 1, 'inclui as que ficaram para trás');
  check(await p.locator(`${M} .rp-over`).count() >= 1 && await p.locator(`${M} input[name=rp-over][value=amanha]:checked`).count() === 1, 'mostra o que passa do expediente e oferece mandar para o próximo dia útil');
  await shot('2-reorganizar'); await fits('Reorganizar');
  await tap(`${M} [data-yes]`);
  const undoTxt = await p.locator('.toast', { hasText: 'Desfazer' }).last().textContent();
  s = await st();
  const ab = blk(s, 'Abertura e análise de demandas');
  check(ab && ab.start >= '10:05' && ab.status === 'pendente', 'atrasada volta para depois de agora');
  const seq = s.days[today].filter(x => x.status !== 'concluida' && x.category !== 'intervalo').sort((a, c) => a.start.localeCompare(c.start));
  check(seq.every((x, i) => !i || seq[i - 1].end <= x.start), 'sem sobreposição');
  check(seq.every(x => !(x.start < '13:00' && x.end > '12:00')), 'nada cai em cima do intervalo');
  check(Object.keys(s.days).some(k => k === '2026-11-12' && s.days[k].some(x => (x.notes || '').includes('Remanejada'))), 'o que não coube foi para quinta (próximo dia útil)');
  check(undoTxt.includes('reorganizada'), 'aviso com "Desfazer": ' + undoTxt.replace('Desfazer', '').trim());
  await p.locator('.toast .link', { hasText: 'Desfazer' }).last().tap(); await W();
  s = await st();
  check(blk(s, 'Abertura e análise de demandas').start === '08:00' && !(s.days['2026-11-12'] || []).some(x => (x.notes || '').includes('Remanejada')), '"Desfazer" volta como estava');
  await go('agenda');
  await tap('[data-act=agMenu]');
  check(await p.locator('.sheet-item', { hasText: 'Reorganizar meu dia' }).count() === 1, 'também no menu "Reorganizar" da Agenda');
  await p.keyboard.press('Escape'); await W();

  console.log('\n[2b] Imprevisto resolvido antes do previsto');
  await go('imprevistos');
  await tap('#fab'); await p.locator(`${M} #cap-t`).fill('Gravador sem disco'); await tap(`${M} [data-dur="60"]`); await tap(`${M} [data-save]`);
  s = await st(); const occ = s.occurrences.find(o => o.title === 'Gravador sem disco');
  const ob0 = s.days[today].find(x => x.id === occ.scheduled.blockId);
  await p.clock.fastForward('20:00'); await go('dashboard'); await go('imprevistos');
  await p.locator('.occ', { hasText: 'Gravador sem disco' }).locator('[data-act=occStatus][data-s=concluida]').tap(); await W();
  s = await st(); const ob = s.days[today].find(x => x.id === occ.scheduled.blockId);
  check(ob.end < ob0.end && ob.status === 'concluida', `horário reservado encolhe até agora (${ob0.end} → ${ob.end})`);
  check(await p.locator('.toast .link', { hasText: 'Adiantar a agenda' }).count() === 1, 'oferece adiantar a agenda');

  console.log('\n[3] Abrir e fechar o dia');
  await p.evaluate(() => {
    D.ensureDay('2026-11-10').forEach(b => { b.status = b.title === 'Alinhamento da equipe' ? 'pendente' : 'concluida'; });
    S.tasks.push({ id: 'tk-atras', title: 'Orçamento atrasado', status: 'pendente', priority: 'alta', category: 'administrativo', dueDate: '2026-11-09', createdAt: new Date().toISOString() });
    S.tasks.push({ id: 'tk-sug', title: 'Revisar escala de plantão', status: 'pendente', priority: 'media', category: 'equipe', dueDate: '', createdAt: new Date().toISOString() });
    commit();
  });
  await go('tarefas'); await go('dashboard');
  check(await p.locator('.rt-banner[data-act=ritualAbrir]').count() === 1, 'de manhã aparece "Abrir o dia" no Início');
  await tap('.rt-banner');
  check(await p.locator(`${M} .rt-li`).count() === 2, 'mostra o que ficou do último dia útil (agenda e tarefa atrasada)');
  await shot('3-abrir'); await fits('Abrir o dia');
  await p.locator(`${M} .rt-li`, { hasText: 'Alinhamento da equipe' }).locator('[data-a=hoje]').tap(); await W();
  await p.locator(`${M} .rt-li`, { hasText: 'Orçamento atrasado' }).locator('input[type=date]').fill('2026-11-13'); await W();
  s = await st();
  check(s.days[today].some(x => x.title === 'Alinhamento da equipe' && (x.notes || '').includes('Remanejada')) && !s.days['2026-11-10'].some(x => x.title === 'Alinhamento da equipe'), '"Hoje" traz a atividade de ontem para hoje');
  check(s.tasks.find(x => x.id === 'tk-atras').dueDate === '2026-11-13', '"Outro dia" muda o prazo da tarefa');
  await p.locator(`${M} #rt-new`).fill('Ligar para o cliente do bloco C'); await p.keyboard.press('Enter'); await W();
  await p.locator(`${M} [data-top]`, { hasText: 'Revisar escala de plantão' }).tap(); await W();
  s = await st();
  check(s.tasks.filter(x => x.top === today).length === 2, 'duas prioridades marcadas (uma nova e uma escolhida)');
  await tap(`${M} [data-go]`);
  s = await st();
  check(s.diario && s.diario[today] && s.diario[today].abertoEm, 'dia aberto fica registrado');
  check(await p.locator('.rt-banner').count() === 0, 'o convite some depois de abrir o dia');
  check((await p.locator('.hj-li').first().textContent()).includes('Prioridade do dia'), 'prioridades no topo de "Para resolver hoje"');
  // fim do expediente
  await p.clock.fastForward('07:00:00'); await go('tarefas'); await go('dashboard');
  check(await p.locator('.rt-banner[data-act=ritualFechar]').count() === 1, 'no fim do expediente aparece "Fechar o dia"');
  await tap('.rt-banner');
  check(await p.locator(`${M} .rt-stats`).count() === 1 && await p.locator(`${M} .rt-li`).count() >= 2, 'resumo do dia e o que não deu tempo');
  await p.locator(`${M} .rt-li`, { hasText: 'Revisar escala de plantão' }).locator('[data-a=feito]').tap(); await W();
  await p.locator(`${M} #rt-nota`).fill('Dia puxado no cliente X');
  await shot('3-fechar'); await fits('Fechar o dia');
  await tap(`${M} [data-all]`);
  await tap(`${M} [data-go]`);
  s = await st();
  check(s.tasks.find(x => x.id === 'tk-sug').status === 'concluida', '"✓ Feito" conclui');
  check(s.tasks.find(x => x.title === 'Ligar para o cliente do bloco C').dueDate === '2026-11-12', '"Tudo para 12/11" leva as tarefas para o próximo dia útil');
  check(!s.days[today].some(x => !['concluida', 'cancelada'].includes(x.status) && x.category !== 'intervalo'), 'nada da agenda de hoje fica pendurado');
  check(s.diario[today].fechadoEm && s.diario[today].nota === 'Dia puxado no cliente X', 'dia fechado com a nota');

  // __MAIS__

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
