// Conta FlowFire (Firebase): sincronização entre dois "aparelhos" com uma nuvem simulada (sem internet).
const { chromium } = require('playwright');
const useRoutine12 = require('./rotina-exemplo');
const F = require('./fake-fire');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const VICTOR = { uid: 'u1', email: 'victor@teste.com', name: 'Victor' };
  const device = name => F.device(b, VICTOR), nuvem = F.nuvem, pages = F.pages;
  const W = (p, ms = 300) => p.waitForTimeout(ms);
  const titles = p => p.evaluate(() => S.tasks.map(t => t.title).sort().join('|'));

  console.log('\n[1] Primeiro aparelho: entra e envia os dados');
  const A = await device('A');
  await useRoutine12(A);
  await A.evaluate(() => { S.tasks.push({ id: 'a1', title: 'Tarefa do celular', status: 'pendente', priority: 'media', category: 'equipe', createdAt: new Date().toISOString() }); commit(); location.hash = '#config'; });
  await W(A);
  check(await A.locator('#cfg-conta [data-act=fireEntrar]').count() === 1, 'Configurações → Conta FlowFire com "Entrar com Google"');
  await A.click('[data-act=fireEntrar]'); await W(A, 800);
  check(nuvem.u1 && nuvem.u1.core && nuvem.u1.tasks && JSON.parse(nuvem.u1.tasks.v).items.some(t => t.title === 'Tarefa do celular'), 'nuvem vazia: os dados deste aparelho sobem (core, tarefas…)');
  check((await A.textContent('#fire-status')).includes('victor@teste.com') && (await A.textContent('#storage-status')).includes('Sincronizado com a sua conta'), 'mostra a conta conectada e o status no menu');
  const rt = await A.evaluate(() => { const j = Fire.join(Fire.parse(Fire.split(S))); return ['tasks', 'routine', 'settings', 'days', 'missoes', 'events', 'feedbacks'].every(k => JSON.stringify(j[k]) === JSON.stringify(S[k])); });
  check(rt, 'dividir e juntar os documentos preserva os dados');

  console.log('\n[2] Segundo aparelho (vazio): entra e recebe tudo');
  const B = await device('B');
  await B.evaluate(() => { location.hash = '#config'; }); await W(B);
  await B.click('[data-act=fireEntrar]'); await W(B, 800);
  check(await titles(B) === 'Tarefa do celular' && await B.evaluate(() => S.routine.length) === 12, 'aparelho novo recebe as tarefas e a rotina da nuvem');

  console.log('\n[3] Ao vivo: o que muda num aparelho aparece no outro');
  await A.evaluate(() => { S.tasks.push({ id: 'a2', title: 'Cobrar relatório', status: 'pendente', priority: 'alta', category: 'equipe', createdAt: new Date().toISOString() }); commit(); });
  await W(A, 1800);
  check((await titles(B)).includes('Cobrar relatório'), 'tarefa criada no aparelho A aparece no B sozinha');
  await B.evaluate(() => { const t = S.tasks.find(x => x.id === 'a2'); Tasks.setStatus(t, 'concluida'); commit(); });
  await W(B, 1800);
  check(await A.evaluate(() => S.tasks.find(x => x.id === 'a2').status) === 'concluida', 'concluir no B reflete no A');
  await B.evaluate(() => { location.hash = '#tarefas'; }); await W(B);
  check(await A.evaluate(() => Store.load ? JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks.length : 0) === 2, 'o que chega da nuvem também fica salvo no aparelho (funciona sem internet)');

  console.log('\n[4] Aparelho com dados diferentes: pergunta qual versão manter');
  const C = await device('C');
  await C.evaluate(() => { S.tasks.push({ id: 'c1', title: 'Tarefa só do computador', status: 'pendente', priority: 'media', category: 'equipe', createdAt: new Date().toISOString() }); commit(); location.hash = '#config'; });
  await W(C);
  await C.click('[data-act=fireEntrar]'); await W(C, 800);
  check((await C.textContent('.modal-wrap.open')).includes('Qual versão você quer manter'), 'mostra "Juntar os dados" com as duas opções');
  await C.click('.modal-wrap.open [data-nuvem]'); await W(C, 800);
  check(await titles(C) === 'Cobrar relatório|Tarefa do celular', '"Usar a da nuvem" troca os dados deste aparelho pelos da conta');

  console.log('\n[5] Sair e reabrir');
  await C.reload(); await W(C, 1200);
  check(await C.evaluate(() => Fire.connected()) && (await C.evaluate(() => S.tasks.length)) === 2, 'ao reabrir, continua conectado e sincronizado');
  await C.evaluate(() => { location.hash = '#config'; }); await W(C);
  await C.click('[data-act=fireSair]'); await C.click('.modal-wrap.open [data-yes]'); await W(C, 500);
  check(!(await C.evaluate(() => Fire.connected())) && (await C.evaluate(() => S.tasks.length)) === 2, 'sair mantém os dados no aparelho');
  check(await C.locator('#cfg-conta [data-act=fireEntrar]').count() === 1, 'volta a mostrar "Entrar com Google"');

  console.log('\n[6] Abrir o app depois de usar outro aparelho: junta sozinho, sem perguntar');
  const mk = (id, title) => ({ id, title, status: 'pendente', priority: 'media', category: 'equipe', createdAt: new Date().toISOString() });
  await B.evaluate(() => Fire.detach());   // B "fechado"
  await A.evaluate(t => { S.tasks.push(t); commit(); }, mk('a8', 'Feita no A com o B fechado')); await W(A, 1800);
  await B.reload(); await W(B, 1500);
  check(await B.locator('.modal-wrap.open').count() === 0 && (await titles(B)).includes('Feita no A com o B fechado'), 'só a nuvem mudou: o aparelho recebe sem perguntar "qual versão manter"');
  await B.evaluate(() => Fire.detach());
  await B.evaluate(t => { S.tasks.push(t); commit(); }, mk('b9', 'Feita no B sem internet'));
  await A.evaluate(t => { S.tasks.push(t); S.tasks.find(x => x.id === 'a8').status = 'concluida'; commit(); }, mk('a9', 'Feita no A enquanto isso')); await W(A, 1800);
  await B.reload(); await W(B, 2000);
  const tb = await titles(B);
  check(await B.locator('.modal-wrap.open').count() === 0 && tb.includes('Feita no B sem internet') && tb.includes('Feita no A enquanto isso'), 'mudou nos dois: junta as tarefas dos dois aparelhos, nada some');
  await W(A, 800);
  const ta = await titles(A);
  check(ta.includes('Feita no B sem internet') && ta === tb, 'o outro aparelho recebe a versão juntada');
  check(JSON.parse(nuvem.u1.tasks.v).items.length === (await B.evaluate(() => S.tasks.length)), 'a nuvem fica igual aos aparelhos');
  const md = await B.evaluate(() => [Fire.mergeDoc('tasks', JSON.stringify({ items: [{ id: '1', t: 'aqui' }, { id: '2' }] }), JSON.stringify({ items: [{ id: '1', t: 'nuvem' }, { id: '3' }] }), 'r'), Fire.mergeDoc('days-2026-11', JSON.stringify({ days: { '2026-11-01': [1] } }), JSON.stringify({ days: { '2026-11-02': [2] } }), 'l')]);
  check(JSON.parse(md[0]).items.map(x => x.id + (x.t || '')).join() === '1nuvem,3,2' && Object.keys(JSON.parse(md[1]).days).length === 2, 'junção item por item: no empate vale o lado mais novo; dias diferentes ficam os dois');

  console.log('\n[7] Apagado num aparelho não volta');
  await B.evaluate(() => Fire.detach());
  await B.evaluate(() => { S.tasks = S.tasks.filter(x => x.id !== 'a9'); commit(); });   // B apaga sem internet
  await A.evaluate(t => { S.tasks.push(t); commit(); }, mk('a10', 'Outra do A')); await W(A, 1800);   // A mexe na mesma lista
  await B.reload(); await W(B, 2000);
  const t7 = await titles(B);
  check(!t7.includes('Feita no A enquanto isso') && t7.includes('Outra do A'), 'tarefa apagada no B não volta, e a nova do A chega');
  await W(A, 800);
  check(!(await titles(A)).includes('Feita no A enquanto isso'), 'o outro aparelho também apaga');

  const errs = pages.flatMap(p => p.errs);
  check(!errs.length, 'nenhum erro de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE:', e.message); process.exit(1); });
