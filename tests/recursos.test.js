// Recursos do dia a dia: Reorganizar meu dia (Agenda), imprevisto resolvido antes da hora,
// tarefas que se repetem e formulários curtos.
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
  await p.evaluate(() => { S.settings.technicians = [{ name: 'Carlos Souza', phone: '' }, { name: 'João' }]; S.settings.breakMode = 'fixo'; S.days = {}; D.ensureDay(U.today()); commit(); });
  let s;
  const today = '2026-11-11';
  const blk = (s, t) => s.days[today].find(x => x.title === t);

  console.log('\n[2] Reorganizar meu dia');
  await go('agenda'); await tap('[data-act=agMenu]'); await tap('.sheet-item:has-text("Reorganizar meu dia")');
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

  console.log('\n[4] Tarefas que se repetem');
  const R = await p.evaluate(() => [Capture.parse('conferir backup dos gravadores toda segunda'), Capture.parse('relatório todo dia 5'), Capture.parse('checar e-mails todo dia'), Capture.parse('reunião a cada 2 semanas')]);
  check(R[0].repeat === 'semanal' && R[0].date === '2026-11-16', '"toda segunda" → toda semana, começando segunda');
  check(R[1].repeat === 'mensal' && R[1].date === '2026-12-05', '"todo dia 5" → todo mês, dia 5');
  check(R[2].repeat === 'diaria', '"todo dia" → todo dia útil');
  check(R[3].repeat === 'quinzenal', '"a cada 2 semanas"');
  await go('dashboard'); await tap('#fab');
  await p.locator(`${M} #cap-t`).fill('Conferir backup dos gravadores toda segunda'); await W(150);
  check(await p.locator(`${M} [data-type=tarefa].active`).count() === 1 && (await p.inputValue(`${M} #cap-rep`)) === 'semanal', 'anotação rápida entende a repetição');
  await tap(`${M} [data-save]`);
  s = await st(); const rt = s.tasks.find(x => x.title.startsWith('Conferir backup'));
  check(rt && rt.repeat === 'semanal' && rt.dueDate === '2026-11-16', 'tarefa salva com repetição semanal');
  await go('tarefas');
  check((await p.locator('.task', { hasText: 'Conferir backup' }).textContent()).includes('Toda semana'), 'a lista mostra que ela se repete');
  await p.locator('.task', { hasText: 'Conferir backup' }).locator('[data-act=tkSet][data-s=andamento]').tap(); await W();   // começa
  await p.locator('.task', { hasText: 'Conferir backup' }).locator('[data-act=tkSet][data-s=concluida]').tap(); await W();   // conclui
  s = await st();
  let reps = s.tasks.filter(x => x.title.startsWith('Conferir backup'));
  check(reps.length === 2 && reps.some(x => x.status === 'pendente' && x.dueDate === '2026-11-23'), 'ao concluir, nasce a próxima (23/11)');
  check((await p.locator('.toast', { hasText: 'próxima' }).last().textContent()).includes('23/11'), 'o aviso diz quando é a próxima');
  await p.locator('.toast', { hasText: 'próxima' }).last().locator('.link').tap(); await W();
  s = await st(); reps = s.tasks.filter(x => x.title.startsWith('Conferir backup'));
  check(reps.length === 1 && reps[0].status === 'andamento', '"Desfazer" volta (em execução, como estava) e apaga a próxima');
  const nd = await p.evaluate(() => [Tasks.nextDue({ repeat: 'mensal', dueDate: '2026-01-31' }), Tasks.nextDue({ repeat: 'semanal', dueDate: '2026-10-01' }), Tasks.nextDue({ repeat: 'diaria', dueDate: '2026-11-11' })]);
  check(nd[0] === '2026-11-30' && nd[1] === '2026-11-12' && nd[2] === '2026-11-12', `próximos prazos certos (fim de mês, atrasada, dia útil): ${nd.join(', ')}`);
  await tap('#fab');
  check(await p.locator(`${M} [name=repeat]`).count() === 1, 'campo "Repetir" no formulário da tarefa');
  await p.keyboard.press('Escape'); await W();

  console.log('\n[8] Formulários mais curtos');
  await go('tarefas'); await tap('#fab');
  const vis = async n => p.locator(`${M} [name=${n}]`).isVisible();
  check(await vis('title') && await vis('dueDate') && await vis('dueTime') && await vis('dur') && await vis('responsible') && await vis('priority') && await vis('repeat') && await vis('description'), 'tarefa nova: tudo numa tela só (sem "Mais opções")');
  check(await p.locator(`${M} [data-more-tg]`).count() === 0 && await p.locator(`${M} [name=category]`).count() === 0 && await p.locator(`${M} [name=status]`).count() === 0 && await p.locator(`${M} [name=startDate]`).count() === 0, 'sem categoria, status e data de início no formulário');
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.modal-wrap.open .form-grid')).gridTemplateColumns.split(' ').length);
  check(cols === 2, 'dois campos por linha também no celular');
  await shot('8-form-curto'); await fits('Formulário de tarefa');
  await p.locator(`${M} [name=title]`).fill('Tarefa com descrição'); await p.locator(`${M} [name=description]`).fill('Detalhe importante');
  await tap(`${M} [data-submit]`);
  await p.evaluate(() => { const x = S.tasks.find(t => t.title === 'Tarefa com descrição'); x.notes = 'Nota antiga'; x.category = 'campo'; commit(); });
  await p.locator('.task', { hasText: 'Tarefa com descrição' }).locator('.tk-body').tap(); await W();
  check((await p.inputValue(`${M} [name=description]`)) === 'Detalhe importante\nNota antiga', 'ao editar, descrição e observações antigas aparecem juntas em "Observação"');
  await tap(`${M} [data-submit]`);
  const ed = (await st()).tasks.find(t => t.title === 'Tarefa com descrição');
  check(ed.description === 'Detalhe importante\nNota antiga' && !ed.notes && ed.category === 'campo' && ed.status === 'pendente', 'salvar não perde nada (categoria e status ficam como estavam)');
  await tap('#fab');
  await p.keyboard.press('Escape'); await W();

  // __MAIS__

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
