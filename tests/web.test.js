const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const useRoutine12 = require('./rotina-exemplo');
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
  // Botão flutuante "+": abre a lista e escolhe o item (no Início e na Agenda)
  const fab = async label => { await p.click('#fab'); await p.waitForTimeout(250); if (label) { await p.click(`.sheet-item:has-text("${label}")`); await p.waitForTimeout(250); } };
  const today = await p.evaluate(() => { const d = new Date(); return d.toISOString().slice(0,10); });
  await p.goto(B);
  await p.waitForTimeout(500); if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').click(); await p.waitForTimeout(300); }

  // ---- Agenda (intervalo em horário fixo)
  assert(!(await p.locator('#bottom-nav').isVisible()), 'no computador a barra de baixo fica escondida (menu lateral fixo)');
  await go('config');
  assert(await p.locator('#cfg-rotina tbody tr').count() === 1 && (await p.textContent('#cfg-rotina')).includes('(exemplo)'), 'instalação nova: rotina com uma atividade de exemplo só');
  await p.click('[data-act=rtClear]'); await p.waitForTimeout(200); await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(250);
  assert((await state()).routine.length === 0 && await p.locator('#cfg-rotina .rt-empty').count() === 1, '"Limpar rotina" deixa em branco');
  await p.click('.toast .link'); await p.waitForTimeout(250);
  assert((await state()).routine.length === 1, '"Desfazer" devolve a rotina apagada');
  await p.click('[data-act=rtClear]'); await p.waitForTimeout(200); await p.click('.modal-wrap.open [data-cancel], .modal-wrap.open [data-no]'); await p.waitForTimeout(250);
  assert((await state()).routine.length === 1, 'cancelar a confirmação não apaga nada');
  await useRoutine12(p);
  await p.evaluate(() => { S.settings.breakMode = 'fixo'; commit(); });
  await go('agenda');
  assert(await p.textContent('#page-title') === 'Agenda' && await p.locator('.agenda-modes, .calx-strip').count() === 0 && await p.locator('.ag-cal .calx-d').count() === 7, 'Agenda numa tela só: semana em cima, dia embaixo');
  assert(await p.locator('#fab').isVisible(), 'botão flutuante + visível na Agenda');
  await p.click('.ag-cal .calx-exp'); await p.waitForTimeout(150);
  assert(await p.locator('.ag-cal .calx-d').count() >= 28, '"Ver o mês inteiro" abre o mês');
  await p.click('.ag-cal .calx-exp'); await p.waitForTimeout(150);
  assert(await p.locator('.ag-cal .calx-d').count() === 7, 'e volta para a semana');
  assert(await p.locator('.blk').count() === 12, 'agenda inicial tem 12 blocos (intervalo fixo)');
  await p.locator('.blk:not(.blk-it)').first().locator('[data-s=concluida]').click(); await p.waitForTimeout(150);
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
  // mover último para próximo dia útil
  await p.locator('.blk', { hasText: 'Fechamento do expediente' }).locator('[data-act=agMore]').click(); await p.waitForTimeout(200);
  await p.click('.sheet-item:has-text("Mover para o próximo dia útil")'); await p.waitForTimeout(200);
  s = await state();
  assert(!s.days[tk].find(b => b.title === 'Fechamento do expediente'), 'bloco removido do dia atual');
  assert(Object.values(s.days).some(d => d.some(b => b.title === 'Fechamento do expediente' && b.notes.includes('Remanejada'))), 'bloco movido para o próximo dia útil com nota');
  // nova atividade (pelo +)
  await fab('Atividade na agenda');
  await fill('title', 'Visita técnica cliente X'); await fill('start', '07:00'); await fill('end', '07:30');
  await p.selectOption('.modal-wrap.open [name=category]', 'campo'); await submit();
  assert(await p.locator('.blk', { hasText: 'Visita técnica cliente X' }).count() === 1, 'nova atividade criada');
  // validação horário inválido
  await fab('Atividade na agenda');
  await fill('title', 'x'); await fill('start', '10:00'); await fill('end', '09:00'); await submit();
  assert(await p.locator('.modal-wrap.open .form-error:not([hidden])').count() === 1, 'validação de horário fim < início');
  await p.click('.modal-wrap.open [data-cancel]'); await p.waitForTimeout(200);

  // ---- Intervalo flexível (padrão): marcado na hora e empurra o resto do dia
  await p.evaluate(() => { S.settings.breakMode = 'flexivel'; commit(); });
  await go('agenda');
  const nextDay = await p.evaluate(() => { let k = U.addDays(U.today(), 7); while (!D.isWorkday(k)) k = U.addDays(k, 1); App.ui.agendaDate = k; App.render(); return k; });
  assert(await p.locator('.blk').count() === 11 && await p.locator('.blk-break').count() === 0, 'intervalo flexível: dia começa sem o bloco de intervalo');
  await fab('Intervalo');
  await fill('start', '11:30'); await p.selectOption('.modal-wrap.open [name=dur]', '60'); await submit();
  s = await state(); const dfx = s.days[nextDay]; const g = t => dfx.find(b => b.title === t);
  assert(g('Intervalo').start === '11:30' && g('Intervalo').end === '12:30' && g('Intervalo').category === 'intervalo', '"Intervalo agora" marca o almoço no horário escolhido');
  assert(g('Resolução de pendências').start === '12:30', 'atividade que caía no almoço vai para depois dele');
  await fab(); assert(await p.locator('.sheet-item:has-text("Intervalo")').count() === 0, '"Intervalo" some do + depois de marcar o intervalo do dia');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await go('config');
  assert(await p.inputValue('#cfg-break') === 'flexivel', 'Configurações → Jornada: intervalo flexível, fixo ou sem intervalo');

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
  await p.locator('.task', { hasText: 'Cobrar relatório' }).locator('[data-act=tkSet][data-s=concluida]').click(); await p.waitForTimeout(200);
  s = await state();
  assert(s.tasks.find(t => t.title === 'Cobrar relatório do técnico').status === 'concluida' && s.tasks.find(t => t.title === 'Cobrar relatório do técnico').completedAt, 'concluir tarefa registra data de conclusão');
  await p.click('[data-act=tkStatusF][data-v=concluida]'); await p.waitForTimeout(150);
  assert(await p.locator('.task').count() === 1, 'filtro por status concluída');
  await p.locator('.task').first().locator('[data-act=tkMore]').click(); await p.waitForTimeout(250); await p.click('.sheet-item.danger:has-text("Excluir")'); await p.waitForTimeout(200);
  await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(200);
  assert((await state()).tasks.length === 1, 'excluir tarefa');

  // ---- Projetos (oculto por padrão; ativado em Configurações → Aparência)
  assert(await p.locator('#nav a[href="#projetos"]').count() === 0, 'Projetos fica oculto no menu por padrão');
  await go('config'); await p.click('[data-change=cfgProjetos]'); await p.waitForTimeout(250);
  assert((await state()).settings.showProjetos === true && await p.locator('#nav a[href="#projetos"]').count() === 1, 'chave em Aparência mostra Projetos no menu');
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

  // ---- Indicadores (oculto por padrão; ativado em Configurações → Aparência)
  assert(await p.locator('#nav a[href="#indicadores"]').count() === 0, 'Indicadores fica oculto no menu por padrão');
  await go('indicadores');
  assert(await p.evaluate(() => App.route) === 'dashboard', 'endereço #indicadores oculto volta ao Início');
  await go('config');
  assert(await p.locator('#cfg-metas').count() === 0, 'Metas ocultas junto com Indicadores');
  await p.click('[data-change=cfgIndicadores]'); await p.waitForTimeout(250);
  assert((await state()).settings.showIndicadores === true && await p.locator('#nav a[href="#indicadores"]').count() === 1, 'chave em Aparência mostra Indicadores no menu');
  await go('indicadores');
  assert(await p.locator('.kpi.nodata').count() >= 3, 'sem lançamentos: indicadores aparecem como "sem dados"');
  await p.click('[data-act=indNew]'); await p.waitForTimeout(200);
  await submit();
  assert(await p.locator('.modal-wrap.open .form-error:not([hidden])').count() === 1, 'exige ao menos um indicador');
  assert(await p.locator('.modal-wrap.open [name^=os]').count() === 0, 'formulário de lançamento sem campos de O.S.');
  await fill('manutencoes', '8'); await fill('retrabalhos', '1'); await submit();
  const kv = await p.locator('.kpi', { hasText: 'Manutenções' }).locator('.kpi-v').textContent();
  assert(kv.trim() === '8', 'KPI de manutenções = 8');
  assert((await p.locator('.kpi', { hasText: 'Serviços concluídos' }).locator('.kpi-s').textContent()).includes('Sem dados'), 'campo não preenchido continua "sem dados" (não vira zero)');
  assert(!(await p.textContent('#view')).includes('O.S.'), 'tela de Indicadores sem nenhuma menção a O.S.');
  await p.selectOption('select[data-k=gran]', 'semanal'); await p.waitForTimeout(150);
  assert(await p.locator('svg.chart rect[style]').count() >= 1, 'gráfico semanal renderizado');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=indXlsx]')]);
  await dl.saveAs(OUT + '/relatorio.xlsx');
  console.log('ok - download Excel:', dl.suggestedFilename());

  // ---- Endereços antigos e calendário do Início
  await go('semanal');
  assert(await p.textContent('#page-title') === 'Agenda', 'endereço antigo #semanal abre a Agenda');
  await go('mensal');
  assert(await p.textContent('#page-title') === 'Agenda', 'endereço antigo #mensal abre a Agenda');
  await go('dashboard');
  await fab('Compromisso');
  await fill('title', 'Reunião com fornecedor'); await fill('date', '2026-11-20'); await fill('time', '10:00'); await submit();
  assert(await p.locator('.cal-home .calx-chip.t-evento', { hasText: 'Reunião com fornecedor' }).count() === 1, 'compromisso aparece no calendário (com título no computador)');
  await p.click('.cal-home .calx-d[data-k="2026-11-20"]'); await p.waitForTimeout(200);
  assert(await p.locator('.calx-day .calx-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'tocar no dia mostra a lista do dia ao lado');
  await go('agenda'); await p.evaluate(() => { App.ui.agendaDate = '2026-11-20'; App.render(); });
  assert(await p.locator('.timeline .blk-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'na Agenda, o compromisso entra na lista do dia, pela hora');
  await go('dashboard');
  assert(await p.locator('.cal-home .calx-grid .calx-d').count() >= 28, 'calendário do mês na tela inicial');
  await p.click('.cal-home [data-act=calMode][data-v=week]'); await p.waitForTimeout(200);
  assert(await p.locator('.cal-home .calx-grid .calx-d').count() === 7, 'calendário encolhe para a semana');
  await p.click('.cal-home [data-act=calNav][data-n="1"]'); await p.waitForTimeout(200);
  assert(await p.locator('.cal-home [data-act=calToday]').count() === 1, 'fora da semana atual aparece "Hoje"');
  await p.click('.cal-home [data-act=calToday]'); await p.waitForTimeout(200);
  assert(await p.locator('.cal-home .calx-d.today.sel').count() === 1, '"Hoje" volta e seleciona o dia atual');

  // ---- Migração do visual v2: modelo antigo sai, itens do usuário ficam
  const mig = await p.evaluate(() => {
    const old = JSON.parse(JSON.stringify(S)); delete old.meta.v2; old.settings.theme = 'claro';
    old.weekly.focus = [{ day: 1, title: 'Planejamento', items: [{ id: 'x1', text: 'Distribuir atividades' }, { id: 'x2', text: 'Meu item' }] }, { day: 2, title: 'Operação', items: [{ id: 'x3', text: 'Acompanhar instalações' }] }];
    old.monthly.cycles[0] = { n: 1, title: 'Diagnóstico', items: [{ id: 'y1', text: 'Análise de produtividade' }] };
    old.settings.categories.find(c => c.id === 'operacional').color = '#0284c7';
    const m = Store.migrate(old);
    return { focus: m.weekly.focus, c1: m.monthly.cycles[0], theme: m.settings.theme, op: m.settings.categories.find(c => c.id === 'operacional').color, v2: m.meta.v2 };
  });
  assert(mig.focus.length === 1 && mig.focus[0].items.length === 1 && mig.focus[0].items[0].text === 'Meu item' && mig.focus[0].title === '', 'migração: remove o modelo antigo e mantém o item criado pelo usuário');
  assert(mig.c1.title === '' && mig.c1.items.length === 0, 'migração: ciclo mensal padrão fica em branco');
  assert(mig.theme === 'escuro' && mig.op === '#7b3fe4' && mig.v2, 'migração: tema escuro e nova paleta de cores');

  // ---- App genérico (para qualquer equipe): nome da empresa opcional; quem já usava mantém o seu
  assert((await p.textContent('#brand-sub')).trim() === 'Calma Pae' && !(await p.content()).includes('Wi-bicam'), 'instalação nova sem marca de empresa');
  const v4 = await p.evaluate(() => { const old = JSON.parse(JSON.stringify(S)); delete old.meta.v4; delete old.meta.v5; old.settings.empresa = 'Wi-bicam, CFTV IP'; old.settings.metricNames = {}; const m = Store.migrate(old); return [m.settings.empresa, m.settings.metricNames.pontosCamera]; });
  assert(v4[0] === '' && v4[1] === 'Pontos de câmera instalados', 'migração: tira "Wi-bicam, CFTV IP" de quem já usava e mantém os nomes dos indicadores');
  await go('config');
  await p.fill('[data-change=cfgEmpresa]', 'Equipe Alfa'); await p.press('[data-change=cfgEmpresa]', 'Tab'); await p.waitForTimeout(200);
  assert((await p.textContent('#brand-sub')).trim() === 'Equipe Alfa', 'nome da empresa aparece no menu');
  await p.fill('[data-change=cfgMetricName][data-k=pontosCamera]', 'Visitas realizadas'); await p.press('[data-change=cfgMetricName][data-k=pontosCamera]', 'Tab'); await p.waitForTimeout(200);
  assert((await state()).settings.metricNames.pontosCamera === 'Visitas realizadas', 'nome do indicador personalizável');

  // ---- Modo jogo (Jornada): ligado por padrão, XP calculado do que foi feito, desliga em Aparência
  await go('dashboard');
  assert(await p.locator('.jg-card').count() === 1 && await p.locator('#nav a[href="#jornada"]').count() === 1, 'modo jogo ligado: cartão no Início e Jornada no menu');
  const xp0 = await p.evaluate(() => Jogo.calc().total);
  await p.evaluate(() => { S.tasks.push({ id: 'jg1', title: 'Teste XP', status: 'pendente', priority: 'media', category: 'equipe', dueDate: U.addDays(U.today(), 2), createdAt: new Date().toISOString() }); commit(); });
  await go('tarefas'); await p.click('[data-act=tkStatusF][data-v=abertas]'); await p.waitForTimeout(150); await p.locator('.task', { hasText: 'Teste XP' }).locator('[data-act=tkSet][data-s=concluida]').click(); await p.waitForTimeout(300);
  assert(await p.evaluate(() => Jogo.calc().total) === xp0 + 15 && (await p.textContent('#xp-pop')).includes('+15 XP'), 'concluir tarefa no prazo dá +15 XP e mostra o aviso');
  await go('jornada');
  assert(await p.textContent('#page-title') === 'Jornada' && await p.locator('.jg-cls').count() === 4 && await p.locator('.jg-badge').count() === 13, 'Jornada: áreas e conquistas');
  // Missões: criar para mim ("Outra", marcada à mão) dá o XP definido
  await p.click('[data-act=msNova]'); await p.waitForTimeout(250);
  await p.selectOption('.ms-row .ms-tipo', 'manual'); await p.fill('.ms-row .ms-txt', 'Revisar 1 POP');
  assert((await p.textContent('.ms-row .ms-sum')).includes('+30 XP') && await p.locator('.ms-row .ms-xp').count() === 0, 'XP da missão é automático (sem campo para digitar)');
  await p.click('.modal-wrap.open [data-ok]'); await p.waitForTimeout(300);
  const xp1 = await p.evaluate(() => Jogo.calc().total);
  await p.click('[data-act=msFeita][data-v="1"]'); await p.waitForTimeout(300);
  assert(await p.evaluate(() => Jogo.calc().total) === xp1 + 30 && (await p.textContent('#xp-pop')).includes('Missão cumprida'), 'missão marcada como feita dá o XP e avisa');
  // Enviar missões: gera link; quem abre o link aceita e a contagem é automática
  await p.click('[data-act=msEnviar]'); await p.waitForTimeout(250);
  await p.fill('.modal-wrap.open [name=para]', 'Carlos'); await p.fill('.modal-wrap.open [name=de]', 'Victor'); await p.selectOption('.ms-row .ms-tipo', 'tarefa'); await p.fill('.ms-row .ms-n', '2');
  assert((await p.textContent('.ms-row .ms-sum')).includes('Concluir 2 tarefas · +20 XP'), 'a missão mostra o título e o XP calculado');
  await p.click('.modal-wrap.open [data-ok]'); await p.waitForTimeout(300);
  const msTxt = await p.inputValue('.ms-share'); const msLink = msTxt.match(/https:\S+/)[0];
  assert(msTxt.includes('Victor te enviou 1 missão') && msLink.includes('#missoes?p='), 'enviar missões gera o texto com o link');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.goto(B + msLink.slice(msLink.indexOf('#'))); await p.waitForTimeout(700);
  assert((await p.textContent('.modal-wrap.open')).includes('Concluir 2 tarefas'), 'abrir o link mostra as missões para aceitar');
  await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(400);
  assert(await p.evaluate(() => location.hash) === '#jornada' && await p.evaluate(() => S.missoes.some(m => m.de_ === 'Victor' && m.tipo === 'tarefa' && m.alvo === 2)), 'missões aceitas entram na Jornada');
  const xp2 = await p.evaluate(() => Jogo.calc().total);
  await p.evaluate(() => { for (const i of [1, 2]) S.tasks.push({ id: 'ms' + i, title: 'M' + i, status: 'concluida', completedAt: new Date().toISOString(), priority: 'media', category: 'equipe', createdAt: new Date().toISOString() }); commit(); });
  assert(await p.evaluate(() => Jogo.calc().miss.find(m => m.de_ === 'Victor').feitaEm) && await p.evaluate(() => Jogo.calc().total) === xp2 + 20 + 20, 'missão automática conclui sozinha (2 tarefas = 20 XP + 20 da missão)');
  assert(await p.evaluate(() => Missoes.decodificar('lixo<script>') === null), 'link inválido é recusado');
  // Missões de atribuição criam o item no app de quem recebe (tarefa em Tarefas, reunião na agenda, pessoa em Feedbacks)
  const amanha = await p.evaluate(() => U.addDays(U.today(), 1));
  const pac = await p.evaluate(d => Missoes.link({ id: 'pk-int', de: 'Victor', para: 'Paulo', prazo: '', missoes: [
    { tipo: 'tarefaItem', alvo: 1, titulo: 'Atualizar planilha', data: d, hora: '10:00' },
    { tipo: 'reuniaoItem', alvo: 1, titulo: 'Alinhamento da escala', data: d, hora: '09:30' },
    { tipo: 'feedbackItem', alvo: 1, titulo: 'Natan', data: d, hora: '' },
    { tipo: 'imprevistoItem', alvo: 1, titulo: 'Câmera offline', data: d, hora: '' }] }), amanha);
  await p.goto(B + pac.slice(pac.indexOf('#'))); await p.waitForTimeout(700); await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(400);
  const integ = await p.evaluate(d => ({
    tarefa: S.tasks.find(t => t.title === 'Atualizar planilha'), reuniao: S.events.find(e => e.title === 'Alinhamento da escala'),
    imp: S.occurrences.find(o => o.title === 'Câmera offline'), natan: D.techNames().includes('Natan'), cal: Cal.itemsOn(d).map(i => i.type).sort().join(',') }), amanha);
  assert(integ.tarefa && integ.tarefa.dueDate === amanha && integ.tarefa.dueTime === '10:00' && integ.reuniao && integ.reuniao.reuniao && integ.reuniao.date === amanha && integ.imp && integ.natan, 'aceitar cria a tarefa, a reunião, o imprevisto e a pessoa na equipe');
  assert(integ.cal === 'imprevisto,missao,reuniao,tarefa', 'tudo aparece no calendário do dia (' + integ.cal + ')');
  await go('feedbacks'); assert((await p.textContent('#view')).includes('Feedback com Natan'), 'o feedback pedido aparece em Feedbacks → Para fazer');
  const xp3 = await p.evaluate(() => Jogo.calc().total);
  await p.evaluate(() => { const t = S.tasks.find(x => x.title === 'Atualizar planilha'); Tasks.setStatus(t, 'concluida'); commit(); });
  assert(await p.evaluate(() => Jogo.calc().miss.find(m => m.titulo === 'Atualizar planilha').feitaEm) && await p.evaluate(() => Jogo.calc().total) === xp3 + 15 + 20, 'concluir a tarefa conclui a missão (+15 da tarefa no prazo, +20 da missão)');
  await go('config'); await p.click('[data-change=cfgJogo]'); await p.waitForTimeout(250);
  assert((await state()).settings.jogo === false && await p.locator('#nav a[href="#jornada"]').count() === 0, 'desligar o modo jogo tira a Jornada do menu');
  await go('dashboard'); assert(await p.locator('.jg-card').count() === 0, 'e o cartão do Início');
  await go('config'); await p.click('[data-change=cfgJogo]'); await p.waitForTimeout(250);

  // ---- Configurações
  await go('config');
  await p.fill('form[data-submit=cfgJornada] [name=workEnd]', '17:30'); await p.click('form[data-submit=cfgJornada] button'); await p.waitForTimeout(150);
  assert((await state()).settings.workEnd === '17:30', 'jornada editável');
  await p.fill('form[data-submit=tecAdd] input', 'Carlos'); await p.click('form[data-submit=tecAdd] button'); await p.waitForTimeout(150);
  await p.fill('form[data-submit=catAdd] [name=name]', 'Treinamentos'); await p.click('form[data-submit=catAdd] button'); await p.waitForTimeout(150);
  s = await state(); assert(s.settings.technicians.some(t => t.name === 'Carlos') && s.settings.categories.some(c => c.name === 'Treinamentos'), 'técnico e categoria cadastrados');
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
  s = await state(); assert(s.tasks.length === nTasks - 4 && !s.tasks.some(t => t.demo) && s.settings.technicians.length === 2, 'remover demonstração preserva dados reais');

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
