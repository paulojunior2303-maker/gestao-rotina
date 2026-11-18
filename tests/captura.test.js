// Anotação rápida (botão +): leitura do texto, imprevisto que empurra o dia, tarefa e atividade
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
  await p.goto('http://localhost:8765/'); await W(500);
  if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').click(); await W(); }
  await useRoutine12(p);
  await p.evaluate(() => { S.settings.technicians = [{ name: 'Carlos Souza' }, { name: 'João' }]; S.settings.breakMode = 'fixo'; S.days = {}; commit(); });
  const today = '2026-11-11';

  // ---- Leitura do texto (sem internet)
  const P = await p.evaluate(() => [
    Capture.parse('trocar câmera amanhã às 15h com o Carlos'),
    Capture.parse('relatório até sexta'),
    Capture.parse('visita dia 20 às 9h30'),
    Capture.parse('NVR travou, vai levar 2h'),
    Capture.parse('cliente ligou, uns 30 min'),
    Capture.parse('entregar 05/01'),
    Capture.parse('ligar pro joão 14:30'),
    Capture.parse('câmera offline no bloco B'),
  ]);
  check(P[0].date === '2026-11-12' && P[0].time === '15:00' && P[0].who === 'Carlos Souza', '"amanhã às 15h com o Carlos" → data, horário e pessoa');
  check(P[1].date === '2026-11-13', '"até sexta" → sexta desta semana');
  check(P[2].date === '2026-11-20' && P[2].time === '09:30', '"dia 20 às 9h30"');
  check(P[3].dur === 120 && !P[3].time, '"vai levar 2h" é duração, não horário');
  check(P[4].dur === 30, '"uns 30 min" → 30 minutos');
  check(P[5].date === '2027-01-05', '"05/01" já passou este ano → próximo ano');
  check(P[6].who === 'João' && P[6].time === '14:30', 'nome sem acento e "14:30"');
  check(!P[7].date && !P[7].time && !P[7].dur && !P[7].who, 'texto comum não inventa nada');

  // ---- Início: + abre a anotação só com Tarefa e Imprevisto (sem "Na agenda" e sem "Ou escolha")
  await go('dashboard');
  await p.tap('#fab'); await W();
  check(await p.locator(`${M} #cap-t`).isVisible(), '+ abre a anotação rápida com campo de texto');
  check(await p.locator(`${M} [data-type=tarefa].active`).count() === 1 && await p.locator(`${M} [data-due="${today}"].on`).count() === 1, 'o tipo padrão é Tarefa, no dia escolhido (hoje)');
  check(await p.locator(`${M} [data-type]`).count() === 2 && await p.locator(`${M} [data-type=agenda]`).count() === 0, 'só dois tipos: Tarefa e Imprevisto (Na agenda virou Tarefa)');
  check(await p.locator(`${M} .cap-others`).count() === 0 && await p.locator(`${M} .sheet-item`).count() === 0, 'sem a lista "Ou escolha" (reunião e feedback ficam em Gravações)');
  await p.tap(`${M} [data-type=imprevisto]`); await W(100);
  await p.tap(`${M} [data-save]`); await W(150);
  check(await p.locator(`${M} .form-error:not([hidden])`).count() === 1, 'sem texto não grava');
  await p.locator(`${M} #cap-t`).fill('Câmeras offline no cliente X, uns 30 min, Carlos vai junto');
  await W(150);
  check(await p.locator(`${M} [data-dur="30"].on`).count() === 1, 'o "30 min" do texto já marca a duração');
  check(await p.inputValue(`${M} #cap-who`) === 'Carlos Souza', 'o nome citado vira o responsável');
  check((await p.textContent(`${M} .cap-prev`)).includes('Acompanhamento operacional') && (await p.textContent(`${M} [data-save]`)) === 'Registrar e encaixar', 'avisa que a atividade atual continua depois');
  await p.screenshot({ path: OUT + '/captura-imprevisto.png' });
  await p.tap(`${M} [data-save]`); await W();
  let s = await st();
  const o = s.occurrences.find(x => x.title.startsWith('Câmeras offline'));
  check(o && o.status === 'andamento' && o.responsible === 'Carlos Souza' && o.priority === 'urgente', 'imprevisto registrado em andamento');
  const day = s.days[today]; const g = t => day.find(x => x.title === t);
  const ib = day.find(x => x.id === o.scheduled.blockId);
  check(ib && ib.start === '10:00' && ib.end === '10:30' && ib.status === 'andamento', 'encaixado agora (10:00–10:30)');
  check(g('Acompanhamento operacional').start === '10:30' && g('Acompanhamento operacional').end === '11:00' && g('Acompanhamento operacional').notes.includes('Pausada'), 'atividade interrompida continua depois com o tempo que faltava');
  check(g('Atividades administrativas').start === '11:00' && g('Intervalo').start === '12:00', 'o resto do dia é empurrado e o intervalo fica no lugar');
  // Desfazer
  await p.tap('.toast .link'); await W();
  s = await st();
  check(!s.occurrences.some(x => x.title.startsWith('Câmeras offline')) && s.days[today].find(x => x.title === 'Acompanhamento operacional').start === '09:00', '"Desfazer" volta a agenda e apaga o imprevisto');

  // ---- Imprevistos: + já abre como imprevisto; "Só registrar" não mexe na agenda
  await go('imprevistos');
  check(await p.getAttribute('#fab', 'data-act') === 'capture', 'na tela de Imprevistos o + abre a anotação rápida');
  await p.tap('#fab'); await W();
  check(await p.locator(`${M} .cap-others`).count() === 0, 'sem a lista de outras opções na tela de Imprevistos');
  await p.locator(`${M} #cap-t`).fill('Cliente Y sem acesso remoto');
  await p.keyboard.press('Enter'); await W();
  s = await st();
  const o2 = s.occurrences.find(x => x.title === 'Cliente Y sem acesso remoto');
  check(o2 && o2.status === 'pendente' && !o2.scheduled, 'Enter registra sem encaixar ("Só registrar")');
  await p.tap('#fab'); await W();
  check(await p.locator(`${M} [data-type=imprevisto].active`).count() === 1, 'na tela de Imprevistos o tipo é Imprevisto');
  await p.locator(`${M} #cap-t`).fill('Mandar relatório amanhã'); await W(150);
  check(await p.locator(`${M} [data-type=tarefa].active`).count() === 1, 'data futura no texto troca para Tarefa');
  await p.keyboard.press('Escape'); await W();
  await p.tap('#fab'); await W();
  await p.locator(`${M} #cap-t`).fill('DVR travado na portaria');
  await p.tap(`${M} [data-dur="60"]`); await p.tap(`${M} [data-save]`); await W();
  await go('dashboard'); await go('imprevistos');
  check((await p.textContent('.occ-today')).includes('2 imprevistos') && (await p.textContent('.occ-today')).includes('1h tomados da agenda'), 'resumo de hoje: quantos imprevistos e quanto tempo tomaram');
  // Tudo numa tela só, sem "Mais detalhes"
  await p.tap('#fab'); await W();
  check(await p.locator(`${M} [data-more]`).count() === 0 && await p.locator(`${M} #cap-oprio`).isVisible() && await p.locator(`${M} #cap-odue`).isVisible() && await p.locator(`${M} #cap-obs`).isVisible(), 'imprevisto: prioridade, prazo e observação já à vista, sem "Mais detalhes"');
  await p.locator(`${M} #cap-t`).fill('Falta de energia no cliente Z');
  await p.selectOption(`${M} #cap-oprio`, 'alta'); await p.fill(`${M} #cap-odue`, '2026-11-13'); await p.locator(`${M} #cap-obs`).fill('Aguardando a concessionária');
  await p.tap(`${M} [data-save]`); await W();
  const oz = (await st()).occurrences.find(x => x.title === 'Falta de energia no cliente Z');
  check(oz && oz.priority === 'alta' && oz.dueDate === '2026-11-13' && oz.description === 'Aguardando a concessionária', 'imprevisto gravado com prioridade, prazo e observação');
  await p.locator('.occ', { hasText: 'Falta de energia' }).locator('[data-act=occEdit]').tap(); await W(400);
  check(await p.locator(`${M} [data-more-tg]`).count() === 0 && await p.locator(`${M} [name=status]`).count() === 0 && await p.locator(`${M} [name=dueDate]`).isVisible() && await p.inputValue(`${M} [name=description]`) === 'Aguardando a concessionária', 'Editar imprevisto: tudo à vista, sem "Mais opções"');
  await p.tap(`${M} [data-cancel]`); await W();

  // ---- Tarefa com data do texto
  await go('dashboard');
  await p.tap('#fab'); await W();
  await p.locator(`${M} #cap-t`).fill('Enviar orçamento pro João amanhã às 15h');
  await W(150);
  check(await p.locator(`${M} [data-type=tarefa].active`).count() === 1, 'continua Tarefa');
  check(await p.locator(`${M} [data-due="2026-11-12"].on`).count() === 1 && await p.inputValue(`${M} #cap-time`) === '15:00', 'prazo amanhã às 15:00 já marcado');
  await p.screenshot({ path: OUT + '/captura-tarefa.png' });
  await p.tap(`${M} [data-save]`); await W();
  s = await st();
  const tk = s.tasks.find(x => x.title.startsWith('Enviar orçamento'));
  check(tk && tk.dueDate === '2026-11-12' && tk.dueTime === '15:00' && tk.responsible === 'João' && tk.status === 'pendente', 'tarefa criada com prazo, horário e responsável');

  // ---- Tarefa com horário e duração: é o antigo "Na agenda"
  await p.tap('#fab'); await W();
  await p.locator(`${M} #cap-t`).fill('Ligar para fornecedor às 16:15');
  await W(150);
  check(await p.inputValue(`${M} #cap-time`) === '16:15' && !(await p.locator(`${M} #cap-dur`).isDisabled()), 'horário do texto preenchido e a duração fica liberada');
  check(await p.locator(`${M} #cap-prio`).isVisible() && await p.locator(`${M} #cap-rep`).isVisible() && await p.locator(`${M} #cap-obs`).isVisible() && await p.locator(`${M} [data-more]`).count() === 0, 'tarefa: prioridade, repetir e observação já à vista, sem "Mais detalhes"');
  await p.selectOption(`${M} #cap-dur`, '15'); await p.selectOption(`${M} #cap-prio`, 'alta'); await p.locator(`${M} #cap-obs`).fill('Pedir prazo de entrega');
  await p.tap(`${M} [data-save]`); await W();
  s = await st();
  const ab = s.tasks.find(x => x.title === 'Ligar para fornecedor às 16:15');
  check(ab && ab.dueDate === today && ab.dueTime === '16:15' && ab.dur === 15 && ab.priority === 'alta' && ab.description === 'Pedir prazo de entrega' && !(s.days[today] || []).some(x => x.title.startsWith('Ligar')), 'vira tarefa de hoje 16:15 com 15 min (sem bloco duplicado na agenda)');
  // Sem data
  await p.tap('#fab'); await W();
  await p.locator(`${M} #cap-t`).fill('Organizar o almoxarifado');
  await p.tap(`${M} [data-due=""]`); await W(100);
  check(await p.locator(`${M} #cap-time`).count() === 0 && (await p.textContent(`${M} .cap-nodate`)).includes('hoje'), 'sem data: explica que fica no dia de hoje');
  await p.tap(`${M} [data-save]`); await W();
  // Tarefa atrasada (de ontem)
  await p.evaluate(() => { S.tasks.push({ id: 'atr1', title: 'Relatório atrasado', status: 'pendente', dueDate: '2026-11-10', dueTime: '', priority: 'media', category: 'administrativo', createdAt: new Date().toISOString() }); commit(); });

  // ---- Tudo aparece na Agenda e no Calendário de hoje
  await go('agenda');
  const agTxt = await p.textContent('.timeline');
  check(agTxt.includes('Ligar para fornecedor') && agTxt.includes('16:30') && agTxt.includes('Enviar orçamento') === false, 'Agenda de hoje mostra a tarefa com horário (16:15–16:30)');
  check(agTxt.includes('Organizar o almoxarifado') && agTxt.includes('Sem') && agTxt.includes('Relatório atrasado') && agTxt.includes('Era10/11'), 'Agenda de hoje mostra a tarefa sem data e a atrasada');
  check((await p.textContent('.ag-head')).includes('tarefas a fazer'), 'resumo do dia conta as tarefas a fazer');
  await p.screenshot({ path: OUT + '/captura-agenda-tarefas.png', fullPage: true });
  await p.tap('.blk-it:has-text("Relatório atrasado") [data-act=tkSet]'); await W();
  check((await st()).tasks.find(x => x.id === 'atr1').status === 'andamento' && await p.locator('.blk-it.run:has-text("Relatório atrasado")').count() === 1, '▶ na Agenda começa a tarefa e ela fica destacada');
  await p.tap('.blk-it:has-text("Relatório atrasado") [data-act=tkSet][data-s=concluida]'); await W();
  s = await st();
  check(s.tasks.find(x => x.id === 'atr1').status === 'concluida', '✓ na Agenda conclui a tarefa em execução');
  check(!(await p.textContent('.timeline')).includes('Relatório atrasado'), 'tarefa atrasada concluída sai de hoje');
  await go('dashboard');
  const calTxt = await p.textContent('.calx-day');
  check(calTxt.includes('Ligar para fornecedor') && calTxt.includes('Organizar o almoxarifado') && calTxt.includes('sem data'), 'Calendário de hoje mostra as mesmas tarefas');
  check(await p.locator('.calx-it:has-text("Organizar o almoxarifado") [data-act=tkSet][data-s=andamento]').count() === 1, 'Calendário tem o ▶ para começar');
  await p.tap('.calx-it:has-text("Organizar o almoxarifado") [data-act=tkSet]'); await W();
  await p.tap('.calx-it:has-text("Organizar o almoxarifado") [data-act=tkSet][data-s=concluida]'); await W();
  check((await st()).tasks.find(x => x.title === 'Organizar o almoxarifado').status === 'concluida' && await p.locator(`${M}`).count() === 0, '✓ no Calendário conclui sem abrir o formulário');
  await go('agenda');
  check(await p.locator('[data-act=agBreak]').count() === 0, 'intervalo fixo: sem botão de intervalo');
  await p.evaluate(() => { S.settings.breakMode = 'flexivel'; S.days = {}; commit(); App.render(); });
  check(await p.locator('.ag-head [data-act=agBreak]').count() === 1, 'intervalo flexível: "Intervalo agora" no topo da Agenda');
  await p.evaluate(() => { S.settings.breakMode = 'fixo'; S.days = {}; commit(); App.render(); });

  // ---- Agenda num dia futuro: tipo padrão Tarefa com prazo naquele dia
  await go('agenda');
  await p.evaluate(() => { App.ui.agendaDate = '2026-11-16'; App.render(); });
  await p.tap('#fab'); await W();
  check(await p.locator(`${M} [data-type=tarefa].active`).count() === 1 && await p.locator(`${M} [data-due="2026-11-16"]`).count() === 0 && (await p.textContent(`${M} .cap-date`)).includes('16/11'), 'dia futuro: tarefa com prazo naquele dia');
  await p.keyboard.press('Escape'); await W();

  // ---- Cabe em 393 px
  await go('dashboard'); await p.tap('#fab'); await W();
  const wide = await p.evaluate(() => document.querySelector('.modal-wrap.open .modal').scrollWidth);
  check(wide <= 393, `anotação cabe na largura do celular (${wide}px)`);
  check(await p.locator(`${M} [data-save]`).isVisible(), 'botão de salvar visível');

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
