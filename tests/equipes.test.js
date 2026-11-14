// Equipes: gestor cria, convida por link, envia missões direto e acompanha o progresso ao vivo (nuvem simulada).
const { chromium } = require('playwright');
require('./completo');
const F = require('./fake-fire');
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const W = (p, ms = 300) => p.waitForTimeout(ms);
  const VICTOR = { uid: 'victor', email: 'victor@teste.com', name: 'Victor' }, PAULO = { uid: 'paulo', email: 'paulo@teste.com', name: 'Paulo' };

  console.log('\n[1] Sem conta: a tela Equipe pede para entrar');
  const G = await F.device(b, VICTOR);
  await G.evaluate(() => { location.hash = '#equipe'; }); await W(G);
  check(await G.locator('#nav a[href="#equipe"]').count() === 1 && (await G.textContent('#view')).includes('Entrar com Google'), 'Equipe no menu; sem conta, mostra "Entrar com Google"');
  await G.click('[data-act=fireEntrar]'); await W(G, 900);

  console.log('\n[2] Gestor cria a equipe e convida');
  check(await G.locator('form[data-submit=eqCriar]').count() === 1, 'conectado: opções "Criar uma equipe" e "Entrar com convite"');
  await G.fill('form[data-submit=eqCriar] [name=nome]', 'Equipe CFTV'); await G.click('form[data-submit=eqCriar] button'); await W(G, 900);
  const eqId = await G.evaluate(() => S.equipes[0] && S.equipes[0].id);
  check(eqId && F.docs[`canais/oficial/equipes/${eqId}`] && F.docs[`canais/oficial/equipes/${eqId}/membros/victor`].papel === 'gestor', 'equipe criada na nuvem, com o gestor como membro');
  check((await G.textContent('#view')).includes('Equipe CFTV') && (await G.textContent('#view')).includes('Você é o gestor'), 'painel da equipe aberto');
  await G.click('[data-act=eqConvidar]'); await W(G);
  const convite = (await G.inputValue('.ms-share')).match(/https:\S+/)[0];
  check(convite.includes('#equipe?e=' + eqId) && convite.includes('&c='), 'convite gera link com a equipe e o código');
  await G.keyboard.press('Escape'); await W(G);

  console.log('\n[3] Membro abre o link do convite e entra');
  const P = await F.device(b, PAULO);
  await P.goto('http://localhost:8765/' + convite.slice(convite.indexOf('#'))); await W(P, 800);
  if (await P.locator('[data-tour=skip]').count()) { await P.locator('[data-tour=skip]').click(); await W(P); }
  check((await P.textContent('.modal-wrap.open')).includes('Equipe CFTV') && (await P.textContent('.modal-wrap.open')).includes('continuam privados'), 'convite mostra a equipe e o que fica privado');
  await P.click('.modal-wrap.open [data-yes]'); await W(P, 1200);
  check(await P.evaluate(() => S.equipes.length === 1 && S.equipes[0].papel === 'membro') && F.docs[`canais/oficial/equipes/${eqId}/membros/paulo`], 'entrou com a conta (login pelo próprio convite) e virou membro');
  check((await P.textContent('#view')).includes('Você é membro'), 'membro vê a tela da equipe (sem o painel dos outros)');
  await W(G, 600);
  check((await G.textContent('.eq-grid')).includes('Paulo'), 'o novo membro aparece no painel do gestor, ao vivo');

  console.log('\n[4] Gestor envia missões direto para o membro');
  await G.click('[data-act=eqMissoes]'); await W(G);
  check(await G.locator('.modal-wrap.open [name=alvo] option[value="eq:' + eqId + ':paulo"]').count() === 1 && (await G.textContent('.modal-wrap.open [data-ok]')).includes('Enviar'), '"Para quem" lista os membros da equipe e o botão é "Enviar"');
  await G.selectOption('.ms-row .ms-tipo', 'tarefaItem'); await G.fill('.ms-row .ms-txt', 'Atualizar a planilha');
  await G.click('.ms-add'); await G.selectOption('.ms-row >> nth=1 >> .ms-tipo', 'tarefa'); await G.fill('.ms-row >> nth=1 >> .ms-n', '2');
  await G.click('.modal-wrap.open [data-ok]'); await W(G, 600);
  const pac = Object.keys(F.docs).find(k => k.startsWith(`canais/oficial/equipes/${eqId}/pacotes/`));
  check(pac && F.docs[pac].para === 'paulo' && F.docs[pac].missoes.length === 2, 'pacote gravado na nuvem para o membro');
  await W(P, 2600);
  const rp = await P.evaluate(() => ({ miss: S.missoes.filter(m => m.equipe).length, tarefa: S.tasks.some(t => t.title === 'Atualizar a planilha') }));
  check(rp.miss === 2 && rp.tarefa, 'as missões chegam sozinhas no app do membro e a tarefa é criada');
  check(F.docs[pac].aceitoEm, 'o pacote fica marcado como aceito');

  console.log('\n[5] Progresso ao vivo no painel do gestor');
  await P.evaluate(() => { const t = S.tasks.find(x => x.title === 'Atualizar a planilha'); Tasks.setStatus(t, 'concluida'); commit(); });
  await W(P, 3400); await W(G, 500);
  const m = F.docs[`canais/oficial/equipes/${eqId}/membros/paulo`];
  check(m.resumo.xp > 0 && m.missoes.filter(x => x.feitaEm).length === 1, 'o resumo do membro (XP e missões) é publicado');
  check(!('tasks' in m) && !JSON.stringify(m).includes('feedbacks'), 'só o resumo sai do aparelho (sem tarefas ou feedbacks)');
  check((await G.textContent('.eq-grid')).includes('1/2 missões'), 'gestor vê "1/2 missões" do membro sem recarregar');
  await G.locator('.eq-m', { hasText: 'Paulo' }).click(); await W(G);
  check((await G.textContent('.modal-wrap.open')).includes('Atualizar a planilha') && (await G.textContent('.modal-wrap.open')).includes('concluída em'), 'detalhe do membro mostra cada missão e quando foi concluída');
  await G.keyboard.press('Escape'); await W(G);

  console.log('\n[6] Sair da equipe');
  await P.evaluate(() => { location.hash = '#equipe'; }); await W(P);
  await P.click('[data-act=eqSair]'); await P.click('.modal-wrap.open [data-yes]'); await W(P, 900);
  check(await P.evaluate(() => S.equipes.length === 0) && !F.docs[`canais/oficial/equipes/${eqId}/membros/paulo`], 'membro sai: some da equipe');
  await W(G, 600);
  check(!(await G.textContent('.eq-grid')).includes('Paulo'), 'e some do painel do gestor');

  const errs = F.pages.flatMap(p => p.errs);
  check(!errs.length, 'nenhum erro de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE:', e.message); process.exit(1); });
