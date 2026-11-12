// Testa as regras do Firestore no simulador oficial do Firebase.
// Uso: npx firebase emulators:exec --only firestore --project demo-flowfire "node tests/regras/regras.test.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
let ok = 0, falhas = 0;
const t = async (nome, p) => { try { await p; ok++; console.log('  ok -', nome); } catch (e) { falhas++; console.log('  XX -', nome, '→', e.message); } };
const env = await initializeTestEnvironment({ projectId: 'demo-flowfire', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8181 } });
const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const A = db('victor'), B = db('paulo'), C = db('estranho'), N = db(null);
const E = ['canais', 'oficial', 'equipes', 'eq1'], CONV = 'convite-secreto-123456';

console.log('[dados pessoais]');
await t('dono grava os próprios dados', assertSucceeds(setDoc(doc(A, 'canais/oficial/usuarios/victor/docs/core'), { v: '{}' })));
await t('dono lê os próprios dados', assertSucceeds(getDoc(doc(A, 'canais/oficial/usuarios/victor/docs/core'))));
await t('outra pessoa NÃO lê', assertFails(getDoc(doc(B, 'canais/oficial/usuarios/victor/docs/core'))));
await t('outra pessoa NÃO grava', assertFails(setDoc(doc(B, 'canais/oficial/usuarios/victor/docs/core'), { v: 'x' })));
await t('sem login NÃO lê', assertFails(getDoc(doc(N, 'canais/oficial/usuarios/victor/docs/core'))));
await t('canal desconhecido NÃO grava', assertFails(setDoc(doc(A, 'canais/outro/usuarios/victor/docs/core'), { v: '{}' })));

console.log('[equipe]');
await t('gestor cria a equipe', assertSucceeds(setDoc(doc(A, ...E), { nome: 'Equipe CFTV', dono: 'victor', convite: CONV })));
await t('NÃO cria equipe em nome de outro', assertFails(setDoc(doc(B, 'canais/oficial/equipes/eq2'), { nome: 'X', dono: 'victor', convite: CONV })));
await t('gestor entra como gestor', assertSucceeds(setDoc(doc(A, ...E, 'membros', 'victor'), { papel: 'gestor', nome: 'Victor' })));
await t('não-membro NÃO lê a equipe', assertFails(getDoc(doc(B, ...E))));
await t('NÃO entra sem o convite certo', assertFails(setDoc(doc(B, ...E, 'membros', 'paulo'), { papel: 'membro', convite: 'errado-errado-errado' })));
await t('NÃO entra como gestor', assertFails(setDoc(doc(B, ...E, 'membros', 'paulo'), { papel: 'gestor', convite: CONV })));
await t('entra com o convite do link', assertSucceeds(setDoc(doc(B, ...E, 'membros', 'paulo'), { papel: 'membro', convite: CONV, nome: 'Paulo' })));
await t('membro lê a equipe', assertSucceeds(getDoc(doc(B, ...E))));
await t('NÃO cria membro em nome de outro', assertFails(setDoc(doc(B, ...E, 'membros', 'estranho'), { papel: 'membro', convite: CONV })));
await t('membro atualiza o próprio resumo', assertSucceeds(updateDoc(doc(B, ...E, 'membros', 'paulo'), { resumo: { xp: 120 } })));
await t('membro NÃO vira gestor', assertFails(updateDoc(doc(B, ...E, 'membros', 'paulo'), { papel: 'gestor' })));
await t('membro NÃO lê o resumo de outro', assertFails(getDoc(doc(B, ...E, 'membros', 'victor'))));
await t('membro NÃO lista a equipe toda', assertFails(getDocs(collection(B, ...E, 'membros'))));
await t('gestor lista todos os membros', assertSucceeds(getDocs(collection(A, ...E, 'membros'))));
await t('membro NÃO altera a equipe', assertFails(updateDoc(doc(B, ...E), { nome: 'Hackeada' })));
await t('gestor altera a equipe (ex.: novo convite)', assertSucceeds(updateDoc(doc(A, ...E), { convite: 'convite-novo-1234567890' })));

console.log('[missões]');
await t('gestor envia pacote para membro', assertSucceeds(setDoc(doc(A, ...E, 'pacotes', 'p1'), { para: 'paulo', de: 'Victor', missoes: [{ tipo: 'tarefa', alvo: 2 }], aceitoEm: null })));
await t('gestor NÃO envia para quem não é da equipe', assertFails(setDoc(doc(A, ...E, 'pacotes', 'p2'), { para: 'estranho', missoes: [] })));
await t('membro NÃO cria pacote', assertFails(setDoc(doc(B, ...E, 'pacotes', 'p3'), { para: 'paulo', missoes: [] })));
await t('membro lê os pacotes dele (consulta por "para")', assertSucceeds(getDocs(query(collection(B, ...E, 'pacotes'), where('para', '==', 'paulo')))));
await t('estranho NÃO lê pacotes', assertFails(getDocs(query(collection(C, ...E, 'pacotes'), where('para', '==', 'paulo')))));
await t('membro marca o pacote como aceito', assertSucceeds(updateDoc(doc(B, ...E, 'pacotes', 'p1'), { aceitoEm: 123 })));
await t('membro NÃO altera as missões', assertFails(updateDoc(doc(B, ...E, 'pacotes', 'p1'), { missoes: [] })));

console.log('[saída]');
await t('gestor remove o membro', assertSucceeds(deleteDoc(doc(A, ...E, 'membros', 'paulo'))));
await t('removido NÃO lê mais a equipe', assertFails(getDoc(doc(B, ...E))));
await t('removido NÃO lê mais os pacotes dele', assertFails(getDocs(query(collection(B, ...E, 'pacotes'), where('para', '==', 'paulo')))));
await t('NÃO volta com convite antigo', assertFails(setDoc(doc(B, ...E, 'membros', 'paulo'), { papel: 'membro', convite: CONV })));

await env.cleanup();
console.log(`\nRESULTADO: ${ok} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
