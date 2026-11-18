// Cópia enxuta (dist/gestao-rotina-enxuto.html): calendário do mês + gravar com um toque.
// Microfone falso do Chromium, IA simulada, partes de 3 s (no app são 10 min), queda de internet e app fechado no meio.
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['microphone'] });
  let tr = 0; const ia = { ata: 0, fb: 0 }; let amanha = '';
  await ctx.route('https://generativelanguage.googleapis.com/**', r => {
    const txt = JSON.stringify(r.request().postDataJSON());
    const ok = text => r.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
    if (txt.includes('Transcreva fielmente')) { tr++; return ok(`— Trecho ${tr}: falamos da escala do sábado e da compra de luvas.`); }
    if (txt.includes('Tarefa: /recado') && txt.includes('MENSAGEM ESCRITA RECEBIDA')) { ia.msg = txt; return ok(JSON.stringify({ resumo: '• Instalar 2 câmeras na portaria até sexta.\n• Visita técnica quinta às 10h.', itens: [
      { tipo: 'tarefa', titulo: 'Instalar 2 câmeras na portaria', data: amanha, situacao: 'futuro' },
      { tipo: 'compromisso', titulo: 'Visita técnica ao condomínio Jardins', data: amanha, hora: '10:00', situacao: 'futuro' },
    ] })); }
    if (txt.includes('Tarefa: /recado')) { ia.recado = txt; return ok(JSON.stringify({ resumo: '• Enviar o orçamento da câmera 360 até amanhã.\n• Reunião com a diretoria amanhã às 15h.', itens: [
      { tipo: 'tarefa', titulo: 'Enviar o orçamento da câmera 360', data: amanha, responsavel: '', situacao: 'futuro' },
      { tipo: 'compromisso', titulo: 'Reunião com a diretoria', data: amanha, hora: '15:00', situacao: 'futuro' },
      { tipo: 'tarefa', titulo: 'Conferir as câmeras do bloco C', responsavel: 'Carlos Souza', situacao: 'futuro' },
    ] })); }
    if (txt.includes('Tarefa: /relatorio') && txt.includes('Paulo J')) { ia.relEu = txt; return ok(JSON.stringify({ relatorio: 'RELATÓRIO DIÁRIO\nResponsável: Paulo Júnior\n\nPlanejamento para o próximo dia:\n• Ligar para o fornecedor de cabos.', itens: [
      { tipo: 'tarefa', titulo: 'Ligar para o fornecedor de cabos', data: amanha, responsavel: 'Paulo Júnior', situacao: 'futuro' },
      { tipo: 'tarefa', titulo: 'Revisar as câmeras do bloco A', data: amanha, responsavel: 'Carlos Souza', situacao: 'futuro' },
    ] })); }
    if (txt.includes('Tarefa: /relatorio')) { ia.rel = (ia.rel || 0) + 1; ia.relCtx = txt.includes('Contexto do app'); return ok(JSON.stringify({ relatorio: `RELATÓRIO DIÁRIO\nData: hoje\n\nAtividades realizadas:\n• Ajustei o NVR do cliente X.\n\nPlanejamento para o próximo dia:\n• Visita ao cliente Jardins às 9h.`, itens: [
      { tipo: 'imprevisto', titulo: 'Câmera 4 do bloco B parou', situacao: 'feito' },
      { tipo: 'tarefa', titulo: 'Ajustar o NVR do cliente X', situacao: 'feito' },
      { tipo: 'tarefa', titulo: 'Trocar a fonte da câmera 12', data: amanha, responsavel: 'Carlos Souza', situacao: 'futuro' },
      { tipo: 'compromisso', titulo: 'Visita ao cliente Jardins', data: amanha, hora: '09:00', situacao: 'futuro' },
      { tipo: 'agenda', titulo: 'Revisar o orçamento', data: amanha, hora: '14:00', duracao: 60, situacao: 'futuro' },
      { tipo: 'agenda', titulo: 'Organizar o almoxarifado', situacao: 'pendente' },
    ] })); }
    if (txt.includes('Tarefa: /feedback')) { ia.fb++; return ok(JSON.stringify({ resumo: 'Carlos teve boa evolução nas entregas.\n\nAcordos:\n• Carlos revisa os conectores.', acordos: ['Carlos revisa os conectores do bloco B'] })); }
    if (txt.includes('Tarefa: /ata')) { ia.ata++; return ok(JSON.stringify({ tratados: [], combinados: ['Carlos monta a escala do sábado', 'Comprar luvas até quarta'], ata: 'ATA DE REUNIÃO\nData: 11/11/2026\n\n1. Escala do sábado\n• Carlos fica no dia 14.' })); }
    return ok('ok');
  });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const W = (ms = 250) => p.waitForTimeout(ms);
  const M = '.modal-wrap.open';
  const tap = async sel => { await p.locator(sel).first().tap(); await W(); };
  const go = async r => { await p.evaluate(r => { location.hash = '#' + r; }, r); await W(); };
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1:enxuto')));
  const rapido = () => p.evaluate(() => { Gravador.SEG_MS = 3000; Gravador.SLICE_MS = 500; });
  const espera = async (fn, ms = 20000, msg = '', arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await W(300); } throw new Error('FALHOU (tempo esgotado): ' + msg); };
  const fits = async n => { const w = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.modal-wrap.open .modal')].map(m => m.scrollWidth))); check(w <= 393, `${n}: cabe em 393 px (${w}px)`); };
  const URL = 'http://localhost:8765/dist/gestao-rotina-enxuto.html';
  await p.goto(URL); await W(600);
  await rapido();
  await p.evaluate(() => { S.settings.ia.key = 'chave-de-teste'; S.settings.technicians = [{ id: 't1', name: 'Carlos Souza' }]; commit(); });

  console.log('\n[1] Telas enxutas');
  check(await p.locator('.teste-tag', { hasText: 'ENXUTO' }).count() === 1, 'marca ENXUTO no topo (dados separados)');
  check(await p.locator('.cal-home .calx-month').count() === 1 || await p.locator('.cal-home .calx-grid .calx-d').count() >= 28, 'Início é o calendário do mês inteiro');
  check(!(await p.locator('.gv-rec-big').isVisible()), 'no celular não há o botão grande repetido (o Gravar fica na barra de baixo)');
  const lado = await p.$$eval('#nav a', as => as.filter(a => getComputedStyle(a).display !== 'none').map(a => a.getAttribute('href')));
  check(lado.join(' ') === '#config #guia', `menu lateral sem repetir a barra de baixo: ${lado.join(' ')}`);
  check(await p.locator('#bottom-nav > *').count() === 5 && await p.locator('#bottom-nav .bn-rec').count() === 1, 'barra de baixo: Calendário, Gravações, Gravar, Tarefas, Agenda');
  const menu = await p.$$eval('#nav a', as => as.map(a => a.getAttribute('href')));
  check(!menu.some(h => /jornada|indicadores|projetos|equipe|checklists|pessoas|semana|reunioes/.test(h)) && menu.length === 6, `menu enxuto (${menu.length} telas): ${menu.join(' ')}`);
  await go('jornada'); check(await p.locator('.cal-home').count() === 1, 'telas retiradas voltam para o calendário');
  check(await p.locator('.jg-card').count() === 0, 'sem cartão do jogo');
  await p.screenshot({ path: OUT + '/enxuto-1-calendario.png' }); await fits('Calendário');

  console.log('\n[2] Gravar com um toque');
  await tap('#bottom-nav .bn-rec');
  const opts = await p.$$eval(`${M} .sheet-item`, a => a.map(x => x.textContent.trim()));
  check(opts.length === 4 && /Reunião/.test(opts[0]) && /Feedback/.test(opts[1]) && /Relatório do dia/.test(opts[2]) && /Áudio ou texto/.test(opts[3]) && !(await p.evaluate(() => Gravador.recording())), 'Gravar abre as opções (Reunião, Feedback, Relatório do dia, Áudio ou texto) e ainda não grava');
  await p.screenshot({ path: OUT + '/enxuto-0-opcoes.png' });
  await tap(`${M} .sheet-item:has-text("Reunião")`);
  check(await p.locator(`${M} .gv-clock`).count() === 1 && await p.locator(`${M} h2`, { hasText: 'Gravando a reunião' }).count() === 1, 'escolheu Reunião: começa a gravar na hora (sem criar a reunião antes)');
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 3, 15000, 'três partes');
  await espera(() => Gravador.cur.g.partes.filter(p => p.st === 'ok').length >= 2, 15000, 'partes transcritas durante a gravação');
  check(true, 'partes fechadas e transcritas enquanto grava');
  await p.screenshot({ path: OUT + '/enxuto-2-gravando.png' }); await fits('Gravando');
  await tap(`${M} [data-min]`);
  check(await p.locator('.gv-bar').count() === 1 && await p.locator('#bottom-nav .bn-rec.on').count() === 1, 'dá para usar o app gravando (barra vermelha e botão com o tempo)');
  await tap('.gv-bar');
  await tap(`${M} [data-stop]`); await W(800);
  check(await p.locator(`${M} h2`, { hasText: 'Qual foi o assunto' }).count() === 1 && await p.locator(`${M} input[name=tipo][value=reuniao]:checked`).count() === 1, 'ao encerrar, pede os detalhes da reunião (dá para deixar para depois)');
  await p.screenshot({ path: OUT + '/enxuto-3-descrever.png' });
  await p.locator(`${M} .btn`, { hasText: 'Descrever depois' }).tap(); await W();
  await espera(() => S.gravacoes[0].status === 'pronta', 20000, 'resumo pronto');
  let s = await st(); let g = s.gravacoes[0];
  check(g.partes.every(x => x.st === 'ok') && g.resumo.startsWith('ATA DE REUNIÃO') && g.combinados.length === 2, `transcrição completa (${g.partes.length} partes) e resumo no fim`);
  const ev = s.events.find(e => e.gravacaoId === g.id);
  check(ev && ev.reuniao && ev.registro.ata.includes('Escala') && ev.registro.transcricao.includes('Trecho 1'), 'reunião criada com resumo e transcrição');
  const nAudio = await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g.id);
  check(nAudio === g.partes.length, `áudio guardado no aparelho (${nAudio} partes)`);
  await go('dashboard');
  check(await p.locator('.calx-day .calx-it.t-gravacao').count() === 1 && await p.locator('.calx-day .calx-it.t-reuniao').count() === 0, 'a gravação aparece no dia do calendário (sem repetir a reunião)');
  await tap('.calx-day .calx-it.t-gravacao');
  check(await p.locator('.ata.pre', { hasText: 'Escala do sábado' }).count() === 1, 'detalhe com o resumo');
  await p.locator('.gv-tx summary').tap(); await W(400);
  check((await p.textContent('.gv-tx-body')).includes('[0:00]'), 'transcrição completa com o tempo de cada parte');
  check(await p.locator('.gv-part audio').count() === g.partes.length, 'dá para ouvir cada parte do áudio');
  await p.screenshot({ path: OUT + '/enxuto-4-detalhe.png', fullPage: true }); await fits('Detalhe');
  await tap('[data-act=gvTasks]');
  s = await st();
  check(s.tasks.filter(x => x.description && x.description.includes('Combinado da reunião')).length === 2, 'combinados viram tarefas');

  console.log('\n[3] Descrever depois como feedback');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));   // aviso por cima da barra
  await tap('#bottom-nav a[href="#gravacoes"]');
  check(await p.locator('.gv-card').count() === 1, 'tocar em Gravações de novo volta para a lista');
  await tap('.gv-card');
  await tap('[data-act=gvDesc]');
  await p.locator(`${M} input[name=tipo][value=feedback]`).check(); await W(150);
  await p.locator(`${M} [name=pessoa]`).fill('Carlos Souza');
  await tap(`${M} [data-submit]`);
  await espera(() => S.gravacoes[0].status === 'pronta' && S.gravacoes[0].ref && S.gravacoes[0].ref.kind === 'fb', 15000, 'resumo refeito como feedback');
  s = await st(); g = s.gravacoes[0];
  check(ia.fb === 1 && s.feedbacks.some(f => f.gravacaoId === g.id && f.pessoa === 'Carlos Souza' && f.resumo.includes('boa evolução')), 'vira feedback do Carlos (resumo refeito no padrão de feedback)');
  check(!s.events.some(e => e.gravacaoId === g.id), 'a reunião provisória sai');

  console.log('\n[4] Sem internet: o áudio espera e transcreve quando volta');
  const tr0 = tr;
  await ctx.setOffline(true);
  await go('dashboard'); await tap('#bottom-nav .bn-rec'); await tap(`${M} .sheet-item:has-text("Reunião")`);
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 2, 10000, 'gravando sem internet');
  await tap(`${M} [data-stop]`); await W(800);
  await p.locator(`${M} .btn`, { hasText: 'Descrever depois' }).tap(); await W(600);
  s = await st(); g = s.gravacoes.find(x => x.id !== s.gravacoes[0].id) || s.gravacoes[1];
  g = s.gravacoes.sort((a, c) => c.at.localeCompare(a.at))[0];
  check(g.status === 'pendente' && /internet/i.test(g.motivo) && tr === tr0, 'sem internet: fica esperando, com o motivo');
  check(await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g.id) >= 2, 'o áudio está guardado no aparelho');
  await go('gravacoes');
  check(await p.locator('.alert', { hasText: 'esperando' }).count() === 1, 'a tela avisa o que está esperando');
  await ctx.setOffline(false);
  await espera(id => S.gravacoes.find(x => x.id === id).status === 'pronta', 20000, 'transcreveu sozinho quando a internet voltou', g.id);
  check(true, 'internet voltou: transcreveu e resumiu sozinho');

  console.log('\n[5] App fechou no meio da gravação');
  await go('dashboard'); await tap('#bottom-nav .bn-rec'); await tap(`${M} .sheet-item:has-text("Reunião")`);
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 2, 10000, 'segunda parte começando');
  await W(1600);   // pedaços da parte em andamento já salvos
  const gid = await p.evaluate(() => Gravador.cur.g.id);
  await p.reload(); await W(800); await rapido();
  await espera(id => { const g = S.gravacoes.find(x => x.id === id); return g && g.recuperada && g.status === 'pronta'; }, 20000, 'gravação recuperada e processada', gid);
  s = await st(); g = s.gravacoes.find(x => x.id === gid);
  const partesAudio = await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), gid);
  check(g.partes.length >= 2 && partesAudio === g.partes.filter(x => x.st !== 'perdida').length && g.partes.filter(x => x.st === 'ok').length >= 2, `nada se perdeu: ${partesAudio} partes recuperadas, incluindo a que estava gravando`);
  check(await p.evaluate(id => AudioDB.all('pedacos', [id]).then(l => l.length), gid) === 0, 'pedaços soltos foram juntados');

  console.log('\n[6] Apagar o áudio só quando quiser');
  await go('gravacoes'); await p.evaluate(() => { App.ui.gvId = null; App.render(); }); await p.locator('.gv-card').first().tap(); await W(400);
  await tap('[data-act=gvDelAudio]'); await tap(`${M} [data-yes]`); await W(400);
  const g6 = await p.evaluate(() => S.gravacoes.find(x => x.id === App.ui.gvId));
  check(!g6.audio && await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g6.id) === 0 && (await p.textContent('.view')).includes('O áudio foi apagado'), '"Apagar o áudio" tira só o áudio; transcrição e resumo ficam');

  console.log('\n[7] Relatório do dia por voz');
  amanha = await p.evaluate(() => D.nextWorkday(U.today()));
  await p.evaluate(() => { App.ui.gvId = null; location.hash = '#gravacoes'; App.render(); }); await W(300);
  await tap('.gv-rel-btn');
  check(await p.locator(`${M} h2`, { hasText: 'relatório do dia' }).count() === 1 && await p.locator(`${M} .gv-guia`).count() === 1, 'botão "Gravar o relatório do dia" já grava, com a dica do que falar');
  await p.screenshot({ path: OUT + '/enxuto-5-relatorio-gravando.png' });
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 2, 10000, 'gravando o relatório');
  await tap(`${M} [data-stop]`); await W(800);
  check(await p.locator(`${M} h2`, { hasText: 'O que foi' }).count() === 0, 'relatório não pergunta o tipo no fim');
  await espera(() => { const g = S.gravacoes.find(x => x.tipo === 'relatorio'); return g && g.status === 'pronta'; }, 20000, 'relatório pronto');
  check(ia.rel === 1 && ia.relCtx, 'a IA recebe o relato e o que o app já sabe do dia');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await tap('#bottom-nav a[href="#gravacoes"]');
  await p.locator('.gv-card', { hasText: 'Relatório do dia' }).tap(); await W(400);
  check((await p.textContent('.ata.pre')).includes('RELATÓRIO DIÁRIO') && await p.locator('a[href^="https://wa.me/?text=REL"]').count() === 1, 'relatório pronto para enviar pelo WhatsApp ou copiar');
  check(await p.locator('.rl-it').count() === 6 && await p.locator('.rl-it input:checked').count() === 5, '6 itens identificados; o que já foi feito (menos imprevisto) fica desmarcado');
  const alm = await p.locator('.rl-it', { hasText: 'Organizar o almoxarifado' }).textContent();
  check((alm.includes(amanha.slice(8, 10) + '/' + amanha.slice(5, 7)) || alm.includes('amanhã')), 'item sem horário mostra o dia para onde vai');
  await p.screenshot({ path: OUT + '/enxuto-6-relatorio.png', fullPage: true }); await fits('Relatório');
  await p.locator('.rl-it', { hasText: 'Visita ao cliente Jardins' }).locator('select').selectOption('compromisso'); await W(200);
  await tap('[data-act=gvItApply]');
  s = await st();
  const tf = s.tasks.find(x => x.title === 'Trocar a fonte da câmera 12');
  check(tf && tf.dueDate === amanha && tf.responsible === 'Carlos Souza' && tf.status === 'pendente', 'tarefa criada para amanhã, com o responsável');
  check(s.events.some(e => e.title === 'Visita ao cliente Jardins' && e.date === amanha && e.time === '09:00'), 'compromisso no calendário de amanhã às 09:00');
  check(s.tasks.some(x => x.title === 'Revisar o orçamento' && x.dueDate === amanha && x.dueTime === '14:00' && x.dur === 60) && !(s.days[amanha] || []).some(b => b.title === 'Revisar o orçamento'), '"agenda" com horário vira tarefa de amanhã 14:00 (1 h), sem bloco duplicado');
  check(s.occurrences.some(o => o.title === 'Câmera 4 do bloco B parou' && o.status === 'concluida'), 'imprevisto do dia registrado como resolvido');
  check(s.tasks.some(x => x.title === 'Organizar o almoxarifado' && x.dueDate === amanha), 'pendência sem horário vira tarefa para o próximo dia útil');
  check(!s.tasks.some(x => x.title === 'Ajustar o NVR do cliente X'), 'o que já foi feito (desmarcado) fica só no relatório');
  check(await p.locator('.rl-it.done').count() === 5 && await p.locator('[data-act=gvItApply]').count() === 0, 'itens marcados como anotados (não duplica)');
  await go('dashboard');
  await p.evaluate(() => { const s = Cal.st('home'); s.sel = U.today(); App.render(); });
  check(await p.locator('.calx-day .calx-it', { hasText: 'Relatório do dia' }).count() === 1, 'o relatório aparece no calendário do dia');

  console.log('\n[8] Gravar feedback');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await tap('#bottom-nav .bn-rec'); await tap(`${M} .sheet-item:has-text("Feedback")`);
  check(await p.locator(`${M} h2`, { hasText: 'Gravando o feedback' }).count() === 1, 'escolheu Feedback: grava na hora');
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 1, 8000, 'gravando feedback'); await W(1200);
  await tap(`${M} [data-stop]`); await W(800);
  check(await p.locator(`${M} h2`, { hasText: 'Com quem foi' }).count() === 1 && await p.locator(`${M} input[name=tipo][value=feedback]:checked`).count() === 1 && await p.locator(`${M} [name=pessoa]`).isVisible(), 'ao encerrar, pergunta com quem foi o feedback');
  await p.locator(`${M} [name=pessoa]`).fill('Carlos Souza'); await tap(`${M} [data-submit]`);
  check(await p.evaluate(() => S.gravacoes.some(g => g.tipo === 'feedback' && g.pessoa === 'Carlos Souza' && g.status !== 'gravando')), 'feedback salvo com a pessoa');

  console.log('\n[9] Seu nome');
  await go('gravacoes'); await go('dashboard');
  check(await p.locator('.eu-card').count() === 1, 'sem nome: o Calendário pergunta "Como você se chama?"');
  await p.screenshot({ path: OUT + '/enxuto-7-nome.png' });
  await p.locator('.eu-card input[name=nome]').fill('Paulo  Júnior'); await tap('.eu-card button');
  check(await p.evaluate(() => S.settings.usuario) === 'Paulo Júnior' && await p.locator('.eu-card').count() === 0, 'nome salvo e o cartão some');
  check((await p.textContent('.th-greet')).includes(', Paulo'), 'saudação com o seu nome');
  await go('config');
  check(await p.inputValue('[data-change=cfgUsuario]') === 'Paulo Júnior', 'Configurações → Você mostra o nome (dá para mudar)');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await go('dashboard'); await tap('#bottom-nav .bn-rec'); await tap(`${M} .sheet-item:has-text("Relatório do dia")`);
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 1, 8000, 'gravando relatório com nome'); await W(1200);
  await tap(`${M} [data-stop]`); await W(600);
  await espera(() => S.gravacoes.filter(g => g.tipo === 'relatorio' && g.status === 'pronta').length === 2, 20000, 'segundo relatório pronto');
  check(ia.relEu.includes('Quem usa o aplicativo e grava') && ia.relEu.includes('Responsável pelo relatório (quem está falando): Paulo Júnior'), 'a IA sabe que quem fala é você (nome no cabeçalho e na primeira pessoa)');
  const gEu = await p.evaluate(() => { const l = S.gravacoes.filter(g => g.tipo === 'relatorio').sort((a, b) => b.at.localeCompare(a.at)); return l[0]; });
  check(gEu.itens[0].responsavel === '' && gEu.itens[1].responsavel === 'Carlos Souza', 'o que você vai fazer fica sem responsável (é seu); o do Carlos fica com ele');
  await p.evaluate(id => { App.ui.gvId = id; location.hash = '#gravacoes'; App.render(); }, gEu.id); await W(400);
  check((await p.locator('.rl-it', { hasText: 'fornecedor de cabos' }).textContent()).includes('com você'), 'na lista aparece "com você"');
  await tap('[data-act=gvItApply]');
  s = await st();
  const tEu = s.tasks.find(x => x.title === 'Ligar para o fornecedor de cabos');
  check(tEu && tEu.responsible === '' && tEu.dueDate === amanha, 'entra na sua agenda de amanhã (tarefa sua, sem delegar)');
  check(s.tasks.find(x => x.title === 'Revisar as câmeras do bloco A').responsible === 'Carlos Souza', 'a do Carlos vai com ele de responsável');

  console.log('\n[10] Áudio ou texto: vários áudios e texto juntos');
  await p.evaluate(() => { App.ui.gvId = null; location.hash = '#dashboard'; App.render(); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await W(300);
  await tap('#bottom-nav .bn-rec');
  check(await p.locator(`${M} .sheet-item`, { hasText: 'Áudio ou texto' }).count() === 1 && await p.locator(`${M} .sheet-item`, { hasText: 'Colar' }).count() === 0, 'Gravar: uma opção só para áudio e texto');
  await tap(`${M} .sheet-item:has-text("Áudio ou texto")`);
  check(await p.locator(`${M} h2`, { hasText: 'Áudio ou texto' }).count() === 1 && await p.locator(`${M} [name=pdTexto]`).count() === 1, 'abre a tela única "Áudio ou texto"');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator(`${M} [data-add]`).tap()]);
  check(fc.isMultiple() && !(await fc.element().getAttribute('accept')), 'escolher áudios: vários de uma vez, pelo gerenciador de arquivos (sem limitar a câmera/gravador)');
  await fc.setFiles([{ name: 'PTT-20261115-WA0007.opus', mimeType: '', buffer: Buffer.alloc(9000, 7) }, { name: 'AUD-20261115-WA0008.m4a', mimeType: 'audio/mp4', buffer: Buffer.alloc(9000, 8) }, { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(9000, 9) }]); await W(400);
  check(await p.locator(`${M} .pd-list li`).count() === 2 && await p.locator('.toast', { hasText: 'foto.jpg' }).count() === 1, '2 áudios na lista; a foto é recusada com aviso');
  await p.locator(`${M} [name=pdTexto]`).fill('Bom dia! Preciso que instale 2 câmeras na portaria até sexta. E marca a visita técnica no Jardins quinta às 10h.');
  await p.locator(`${M} [name=pdDe]`).fill('meu chefe');
  await p.screenshot({ path: OUT + '/enxuto-8-pedido.png' }); await fits('Áudio ou texto');
  await tap(`${M} [data-go]`);
  await espera(() => { const g = S.gravacoes.find(x => x.tipo === 'audio'); return g && g.status === 'pronta'; }, 20000, 'pedido analisado');
  const ga = await p.evaluate(() => S.gravacoes.find(x => x.tipo === 'audio'));
  const mimes = await p.evaluate(id => Promise.all([AudioDB.get('partes', [id, 0]), AudioDB.get('partes', [id, 1])]).then(l => l.map(a => a && a.mime)), ga.id);
  check(mimes[0] === 'audio/ogg' && mimes[1] === 'audio/mp4', 'os 2 áudios guardados no aparelho (.opus como ogg, .m4a como mp4)');
  check(ia.msg.includes('2 ÁUDIOS RECEBIDOS') && ia.msg.includes('MENSAGEM ESCRITA') && ia.msg.includes('de meu chefe') && ia.msg.includes('Áudio 1 (PTT-20261115-WA0007.opus)') && ia.msg.includes('Mensagem escrita:') && ia.msg.includes('Paulo Júnior'), 'a IA analisa tudo de uma vez: os 2 áudios transcritos + a mensagem');
  check(ga.itens.length === 2 && ga.resumo.includes('portaria'), 'resumo único do pedido com os itens');
  await p.evaluate(id => { App.ui.gvId = id; location.hash = '#gravacoes'; App.render(); }, ga.id); await W(400);
  check(await p.locator('.ps-head h2', { hasText: '2 áudios e mensagem de meu chefe' }).count() === 1 && await p.locator('.gv-part audio').count() === 2, 'tela do pedido: nome claro e os 2 áudios para ouvir');
  await p.screenshot({ path: OUT + '/enxuto-9-pedido-pronto.png', fullPage: true });
  await tap('[data-act=gvItApply]');
  s = await st();
  check(s.tasks.some(x => x.title === 'Instalar 2 câmeras na portaria' && x.dueDate === amanha) && s.events.some(e => e.title === 'Visita técnica ao condomínio Jardins' && e.time === '10:00'), 'pedidos anotados na agenda');

  console.log('\n[11] Compartilhar do WhatsApp (app instalado, simulado)');
  await p.evaluate(() => { App.ui.gvId = null; location.hash = '#dashboard'; App.render(); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await W(300);
  await p.evaluate(() => Gravador.compartilhado({ id: 77, texto: '', arquivos: [
    { nome: 'PTT-20261115-WA0010.opus', tipo: 'application/octet-stream', tamanho: 6000, dados: btoa('a'.repeat(6000)) },
    { nome: 'PTT-20261115-WA0011.opus', tipo: '', tamanho: 6000, dados: btoa('b'.repeat(6000)) },
    { nome: 'video.mp4x', tipo: 'video/mp4', tamanho: 6000, dados: btoa('c'.repeat(6000)) },
  ] })); await W(700);
  check(await p.textContent('#page-title') === 'Gravações' && await p.locator(`${M} .pd-list li`).count() === 2, 'compartilhou 2 áudios do WhatsApp: abre o pedido já com os dois');
  await p.evaluate(() => Gravador.compartilhado({ id: 77, arquivos: [{ nome: 'x.opus', dados: btoa('z'.repeat(900)) }] })); await W(300);
  check(await p.locator('.modal-wrap.open').count() === 1, 'o mesmo compartilhamento não abre duas vezes');
  await p.locator(`${M} [name=pdDe]`).fill('Carlos Souza'); await tap(`${M} [data-go]`);
  await espera(() => S.gravacoes.filter(x => x.tipo === 'audio' && x.status === 'pronta').length === 2, 20000, 'áudios compartilhados analisados');
  const gc = await p.evaluate(() => S.gravacoes.filter(x => x.tipo === 'audio').sort((a, b) => b.at.localeCompare(a.at))[0]);
  check(gc.partes.length === 2 && gc.itens.length === 3 && ia.recado.includes('2 ÁUDIOS RECEBIDOS'), 'os dois áudios viram um pedido só, analisado de uma vez');
  await p.evaluate(() => Gravador.compartilhado({ id: 78, texto: 'Me liga amanhã às 9h para falar do orçamento', arquivos: [] })); await W(700);
  check((await p.inputValue(`${M} [name=pdTexto]`)).includes('Me liga amanhã'), 'texto compartilhado do WhatsApp entra no campo da mensagem');
  await p.keyboard.press('Escape'); await W();

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
