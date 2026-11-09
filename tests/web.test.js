const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const B = 'http://localhost:8765/';
  const go = async r => { await p.goto(B + '#/' + r); await p.waitForTimeout(150); };
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1') || 'null'));
  const submit = async () => { await p.click('.modal-wrap.open [data-submit]'); await p.waitForTimeout(250); };
  const fill = async (name, v) => p.fill(`.modal-wrap.open [name="${name}"]`, v);
  const today = await p.evaluate(() => { const d = new Date(); return d.toISOString().slice(0,10); });
  await p.goto(B);
  await p.waitForTimeout(500); if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').click(); await p.waitForTimeout(300); }

  // ---- Agenda
  await go('agenda');
  assert(await p.locator('.blk').count() === 12, 'agenda inicial tem 12 blocos');
  await p.locator('.blk').first().locator('[data-s=concluida]').click(); await p.waitForTimeout(150);
  let s = await state(); const tk = Object.keys(s.days)[0];
  assert(s.days[tk].find(b => b.title.startsWith('Abertura')).status === 'concluida', 'concluir bloco persiste no LocalStorage');
  // editar Acompanhamento operacional 09:00-10:30 -> 09:00-11:00 com deslocamento
  await p.locator('.blk-body', { hasText: 'Acompanhamento operacional' }).click(); await p.waitForTimeout(200);
  await fill('end', '11:00'); await submit();
  s = await state(); const day = s.days[tk]; const f = t => day.find(b => b.title === t);
  assert(f('Atividades administrativas').start === '11:00' && f('Atividades administrativas').end === '12:00', 'atividade seguinte deslocada para 11:00–12:00');
  assert(f('Intervalo').start === '12:00' && f('Intervalo').end === '13:00', 'intervalo permanece fixo');
  assert(f('Resolução de pendências').start === '13:00', 'bloco que cairia no intervalo pula para 13:00');
  assert(f('Gestão de projetos').start === '13:30', 'blocos da tarde deslocados em sequência');
  assert(f('Fechamento do expediente').end === '18:30', 'último bloco ultrapassa a saída (alerta esperado)');
  assert(await p.locator('.badge', { hasText: 'Fora do expediente' }).count() >= 1, 'selo "Fora do expediente" exibido');
  // mover último para próximo dia útil
  await p.locator('.blk', { hasText: 'Fechamento do expediente' }).locator('[data-act=agMore]').click(); await p.waitForTimeout(200);
  await p.click('.sheet-item:has-text("Mover para o próximo dia útil")'); await p.waitForTimeout(200);
  s = await state();
  assert(!s.days[tk].find(b => b.title === 'Fechamento do expediente'), 'bloco removido do dia atual');
  assert(Object.values(s.days).some(d => d.some(b => b.title === 'Fechamento do expediente' && b.notes.includes('Remanejada'))), 'bloco movido para o próximo dia útil com nota');
  // nova atividade
  await p.click('[data-act=agNew]'); await p.waitForTimeout(200);
  await fill('title', 'Visita técnica cliente X'); await fill('start', '07:00'); await fill('end', '07:30');
  await p.selectOption('.modal-wrap.open [name=category]', 'campo'); await submit();
  assert(await p.locator('.blk', { hasText: 'Visita técnica cliente X' }).count() === 1, 'nova atividade criada');
  // validação horário inválido
  await p.click('[data-act=agNew]'); await p.waitForTimeout(200);
  await fill('title', 'x'); await fill('start', '10:00'); await fill('end', '09:00'); await submit();
  assert(await p.locator('.modal-wrap.open .form-error:not([hidden])').count() === 1, 'validação de horário fim < início');
  await p.click('.modal-wrap.open [data-cancel]'); await p.waitForTimeout(200);

  // ---- Imprevisto com encaixe
  await go('imprevistos');
  await p.click('[data-act=occNew]'); await p.waitForTimeout(200);
  await fill('title', 'NVR sem gravação no cliente Y'); await fill('responsible', 'João');
  await p.check('.modal-wrap.open [name=schedule]'); await submit(); await p.waitForTimeout(300);
  assert(await p.locator('.modal-wrap.open h2', { hasText: 'Encaixar imprevisto' }).count() === 1, 'diálogo de encaixe aberto');
  await fill('start', '15:00'); await fill('duration', '30'); await submit();
  s = await state();
  const occ = s.occurrences[0];
  assert(occ.scheduled && occ.scheduled.date, 'imprevisto vinculado à agenda');
  const ob = s.days[occ.scheduled.date].find(x => x.id === occ.scheduled.blockId);
  assert(ob && ob.start === '15:00' && ob.end === '15:30', 'bloco do imprevisto criado 15:00–15:30');
  await p.click('[data-act=occStatus][data-s=concluida]'); await p.waitForTimeout(200);
  s = await state();
  assert(s.days[occ.scheduled.date].find(x => x.id === occ.scheduled.blockId).status === 'concluida', 'resolver imprevisto conclui o bloco da agenda');

  // ---- Tarefas
  await go('tarefas');
  await p.click('[data-act=tkNew]'); await p.waitForTimeout(200);
  await fill('title', 'Cobrar relatório do técnico'); await fill('startDate', '2026-11-01'); await fill('dueDate', '2026-11-05');
  await p.selectOption('.modal-wrap.open [name=priority]', 'alta'); await submit();
  assert(await p.locator('.task .dl-late').count() === 1, 'tarefa vencida exibe alerta Atrasada');
  await p.click('[data-act=tkNew]'); await p.waitForTimeout(200);
  await fill('title', 'Atualizar planilha de materiais'); await fill('dueDate', '2026-12-20'); await submit();
  await p.selectOption('select[data-k=priority]', 'alta'); await p.waitForTimeout(150);
  assert(await p.locator('.task').count() === 1, 'filtro por prioridade');
  await p.click('[data-act=tkClear]'); await p.waitForTimeout(150);
  await p.fill('[data-input=tkSearch]', 'planilha'); await p.waitForTimeout(500);
  assert(await p.locator('.task').count() === 1 && await p.evaluate(() => document.activeElement.dataset.input) === 'tkSearch', 'busca filtra e mantém o foco');
  await p.fill('[data-input=tkSearch]', ''); await p.waitForTimeout(500);
  await p.locator('.task', { hasText: 'Cobrar relatório' }).locator('.tk-check span').click(); await p.waitForTimeout(200);
  s = await state();
  assert(s.tasks.find(t => t.title === 'Cobrar relatório do técnico').status === 'concluida' && s.tasks.find(t => t.title === 'Cobrar relatório do técnico').completedAt, 'concluir tarefa registra data de conclusão');
  await p.click('[data-act=tkStatusF][data-v=concluida]'); await p.waitForTimeout(150);
  assert(await p.locator('.task').count() === 1, 'filtro por status concluída');
  await p.locator('.task').first().locator('[data-act=tkDelete]').click(); await p.waitForTimeout(200);
  await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(200);
  assert((await state()).tasks.length === 1, 'excluir tarefa');

  // ---- Projetos
  await go('projetos');
  await p.click('[data-act=pjNew]'); await p.waitForTimeout(200);
  await fill('name', 'CFTV Condomínio Z'); await fill('client', 'Condomínio Z'); await fill('startDate', '2026-11-01'); await fill('dueDate', '2026-12-15');
  await fill('stagesText', 'Vistoria\nInstalação\nConfiguração\nEntrega');
  await p.selectOption('.modal-wrap.open [name=status]', 'andamento'); await submit();
  await p.click('.pj-card'); await p.waitForTimeout(200);
  await p.locator('.modal-wrap.open input[data-change=pjStage]').first().check(); await p.waitForTimeout(200);
  assert((await p.locator('.modal-wrap.open .pm-b strong').textContent()) === '25%', 'percentual calculado pelas etapas (1/4 = 25%)');
  await p.fill('.modal-wrap.open [data-submit=pjPendAdd] input', 'Falta liberar rack'); await p.press('.modal-wrap.open [data-submit=pjPendAdd] input', 'Enter'); await p.waitForTimeout(200);
  assert((await state()).projects[0].pendencias.length === 1, 'pendência adicionada ao projeto');
  await p.selectOption('.modal-wrap.open select[data-change=pjStatus]', 'concluido'); await p.waitForTimeout(200);
  assert((await state()).projects[0].completedAt, 'concluir projeto registra data');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert(await p.locator('.kb-col[data-drop=concluido] .pj-card').count() === 1, 'Kanban mostra projeto na coluna Concluído');
  // drag and drop de volta para andamento
  await p.dragAndDrop('.pj-card', '.kb-col[data-drop=andamento]'); await p.waitForTimeout(250);
  assert((await state()).projects[0].status === 'andamento', 'arrastar no Kanban altera status');
  await p.click('[data-act=pjMode][data-v=timeline]'); await p.waitForTimeout(150);
  assert(await p.locator('.g-bar').count() === 1, 'linha do tempo exibe o projeto');

  // ---- Indicadores
  await go('indicadores');
  assert(await p.locator('.kpi.nodata').count() >= 7, 'sem lançamentos: indicadores aparecem como "sem dados"');
  await p.click('[data-act=indNew]'); await p.waitForTimeout(200);
  await submit();
  assert(await p.locator('.modal-wrap.open .form-error:not([hidden])').count() === 1, 'exige ao menos um indicador');
  await fill('osRecebidas', '10'); await fill('osConcluidas', '8'); await fill('retrabalhos', '1'); await submit();
  const kv = await p.locator('.kpi').first().locator('xpath=following-sibling::div[1]').locator('.kpi-v').textContent();
  assert(kv.trim() === '8', 'KPI de O.S. concluídas = 8');
  assert((await p.locator('.kpi', { hasText: 'Pontos de câmera' }).locator('.kpi-s').textContent()).includes('Sem dados'), 'campo não preenchido continua "sem dados" (não vira zero)');
  assert((await p.locator('.kpi', { hasText: 'Taxa de conclusão' }).locator('.kpi-v').textContent()).trim() === '80%', 'taxa de conclusão 80%');
  await p.selectOption('select[data-k=gran]', 'semanal'); await p.waitForTimeout(150);
  assert(await p.locator('svg.chart rect[fill]').count() >= 1, 'gráfico semanal renderizado');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=indXlsx]')]);
  await dl.saveAs(OUT + '/relatorio.xlsx');
  console.log('ok - download Excel:', dl.suggestedFilename());

  // ---- Semanal / Mensal
  await go('semanal');
  await p.locator('input[data-change=wkCheck]').first().check(); await p.waitForTimeout(150);
  s = await state(); assert(Object.keys(Object.values(s.weekly.checks)[0]).length === 1, 'checklist semanal persiste');
  await go('mensal');
  await p.click('[data-act=evNew]'); await p.waitForTimeout(200);
  await fill('title', 'Reunião com fornecedor'); await fill('date', '2026-11-20'); await fill('time', '10:00'); await submit();
  assert(await p.locator('.cal-it.t-evento', { hasText: 'Reunião com fornecedor' }).count() === 1, 'compromisso aparece no calendário');

  // ---- Configurações
  await go('config');
  await p.fill('form[data-submit=cfgJornada] [name=workEnd]', '17:30'); await p.click('form[data-submit=cfgJornada] button'); await p.waitForTimeout(150);
  assert((await state()).settings.workEnd === '17:30', 'jornada editável');
  await p.fill('form[data-submit=tecAdd] input', 'Carlos'); await p.click('form[data-submit=tecAdd] button'); await p.waitForTimeout(150);
  await p.fill('form[data-submit=catAdd] [name=name]', 'Treinamentos'); await p.click('form[data-submit=catAdd] button'); await p.waitForTimeout(150);
  s = await state(); assert(s.settings.technicians[0].name === 'Carlos' && s.settings.categories.some(c => c.name === 'Treinamentos'), 'técnico e categoria cadastrados');
  await p.click('[data-act=goalNew]'); await p.waitForTimeout(200); await fill('target', '5'); await submit();
  assert((await state()).settings.goals.length === 1, 'meta cadastrada');
  await p.click('[data-act=rtNew]'); await p.waitForTimeout(200);
  await fill('title', 'Reunião mensal de resultados'); await fill('start', '16:00'); await fill('end', '17:00');
  await p.selectOption('.modal-wrap.open [name=freq]', 'mensal'); await p.waitForTimeout(100);
  assert(await p.locator('.modal-wrap.open [data-showif="freq=semanal"]').evaluate(e => e.style.display) === 'none', 'campo de dias oculto para frequência mensal');
  await fill('monthDay', '10'); await submit();
  s = await state(); assert(s.routine.some(r => r.freq === 'mensal' && r.monthDay === 10), 'atividade recorrente mensal cadastrada');

  // ---- Demo carregar/remover
  await p.click('[data-act=demoLoad]'); await p.waitForTimeout(150);
  s = await state(); const nTasks = s.tasks.length;
  await p.click('.view [data-act=demoRemove] >> nth=0'); await p.waitForTimeout(150); await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(150);
  s = await state(); assert(s.tasks.length === nTasks - 4 && !s.tasks.some(t => t.demo) && s.settings.technicians.length === 1, 'remover demonstração preserva dados reais');

  // ---- Persistência após recarregar
  await p.reload(); await go('tarefas');
  assert(await p.locator('.task', { hasText: 'Atualizar planilha' }).count() === 1, 'dados preservados após recarregar');

  // ---- Backup JSON
  await go('config');
  const [bk] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=dataExport]')]);
  await bk.saveAs(OUT + '/backup.json'); console.log('ok - backup:', bk.suggestedFilename());

  console.log(errs.length ? 'ERROS NO CONSOLE:\n' + errs.join('\n') : 'Sem erros de console.');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
