// Uso: veja tests/regras/LEIA.md
// Mesmas chamadas que js/equipes.js faz (via api.d do js/fire.js), contra o simulador com as regras reais.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as F from 'firebase/firestore';
import { readFileSync } from 'fs';
const env = await initializeTestEnvironment({ projectId: 'demo-flowfire', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8181 } });
const api = db => ({
  get: async p => { const x = await F.getDoc(F.doc(db, ...p)); return x.exists() ? x.data() : null; },
  set: (p, data, merge) => F.setDoc(F.doc(db, ...p), data, merge ? { merge: true } : {}),
  update: (p, data) => F.updateDoc(F.doc(db, ...p), data),
  del: p => F.deleteDoc(F.doc(db, ...p)),
  onQuery: (p, w, cb, err) => F.onSnapshot(w ? F.query(F.collection(db, ...p), F.where(w[0], '==', w[1])) : F.collection(db, ...p), snap => { const out = []; snap.forEach(x => out.push({ id: x.id, ...x.data() })); cb(out); }, err),
});
const G = api(env.authenticatedContext('victor').firestore()), P = api(env.authenticatedContext('paulo').firestore());
const E = id => ['canais', 'oficial', 'equipes', id];
let ok = 0, falhas = 0; const t = (c, m) => { c ? ok++ : falhas++; console.log((c ? '  ok - ' : '  XX - ') + m); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const resumo = { nome: 'X', resumo: { xp: 0, nivel: 1, streak: 0, hoje: 0, meta: 40 }, missoes: [], atualizadoEm: Date.now() };
try {
  await G.set(E('eq1'), { nome: 'Equipe CFTV', dono: 'victor', donoNome: 'Victor', convite: 'abcdefghijkmnpqrstuvw', criadaEm: Date.now() });
  await G.set([...E('eq1'), 'membros', 'victor'], { papel: 'gestor', entrouEm: Date.now(), ...resumo });
  t(true, 'criar equipe + gestor como membro (set, set)');
  let membros = [], pacotes = [], erroP = null;
  const u1 = G.onQuery([...E('eq1'), 'membros'], null, ms => { membros = ms; }, e => console.log('erro gestor', e.code));
  await P.set([...E('eq1'), 'membros', 'paulo'], { papel: 'membro', convite: 'abcdefghijkmnpqrstuvw', entrouEm: Date.now(), ...resumo, nome: 'Paulo' });
  t(true, 'membro entra com o convite (set)');
  const u2 = P.onQuery([...E('eq1'), 'pacotes'], ['para', 'paulo'], ps => { pacotes = ps; }, e => { erroP = e.code; });
  await espera(600);
  t(membros.some(m => m.id === 'paulo'), 'gestor ouve a lista de membros (onQuery sem filtro)');
  t(!erroP, 'membro ouve os próprios pacotes (onQuery com "para")');
  await G.set([...E('eq1'), 'pacotes', 'p1'], JSON.parse(JSON.stringify({ id: 'p1', de: 'Victor', prazo: '', missoes: [{ tipo: 'tarefaItem', alvo: 1, titulo: 'Planilha', data: '', hora: '', xp: 20 }], para: 'paulo', paraNome: 'Paulo', deUid: 'victor', criadoEm: Date.now(), aceitoEm: null })));
  await espera(600);
  t(pacotes.length === 1 && pacotes[0].missoes[0].titulo === 'Planilha', 'pacote chega ao vivo no membro');
  await P.update([...E('eq1'), 'pacotes', 'p1'], { aceitoEm: Date.now() });
  t(true, 'membro marca aceito (update só de aceitoEm)');
  await P.update([...E('eq1'), 'membros', 'paulo'], { ...resumo, nome: 'Paulo', resumo: { xp: 35, nivel: 1, streak: 1, hoje: 35, meta: 40 }, missoes: [{ titulo: 'Planilha', n: 1, de: 1, feitaEm: '2026-11-12', expirada: false, xp: 20, data: '', prazo: '' }] });
  await espera(600);
  t(membros.find(m => m.id === 'paulo').resumo.xp === 35, 'resumo publicado (update) aparece para o gestor ao vivo');
  await G.update(E('eq1'), { convite: 'novo-convite-1234567890' });
  await G.del([...E('eq1'), 'membros', 'paulo']);
  await espera(600);
  let pub = 'ok'; await P.update([...E('eq1'), 'membros', 'paulo'], { ...resumo }).catch(e => { pub = e.code; });
  t(/permission|not-found/.test(pub), 'removido: publicar o resumo falha (' + pub + ') e o app sai da equipe sozinho');
  let nova = 'ok'; await F.getDocs(F.query(F.collection(env.authenticatedContext('paulo').firestore(), ...E('eq1'), 'pacotes'), F.where('para', '==', 'paulo'))).catch(e => { nova = e.code; });
  t(nova === 'permission-denied', 'removido: ao abrir o app de novo, não lê mais os pacotes');
  u1(); u2();
  await P.set([...E('eq1'), 'membros', 'paulo'], { papel: 'membro', convite: 'abcdefghijkmnpqrstuvw', ...resumo }).then(() => t(false, 'convite antigo recusado'), () => t(true, 'convite antigo recusado'));
} catch (e) { t(false, 'erro inesperado: ' + (e.code || e.message)); }
await env.cleanup();
console.log(`RESULTADO: ${ok} ok, ${falhas} falhas`); process.exit(falhas ? 1 : 0);
