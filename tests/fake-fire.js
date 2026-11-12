// Nuvem simulada (no lugar do Firebase) para os testes: vários "aparelhos" (contextos do navegador) compartilham os dados.
const nuvem = {}, docs = {}, pages = [];
const notify = async src => { for (const p of pages) await p.evaluate(() => window.__ffNotify && window.__ffNotify()).catch(() => {}); };
const fake = ident => {   // roda dentro da página
  let user = JSON.parse(localStorage.getItem('__ffuser') || 'null'), auth = [], ls = [], qls = [];
  const setUser = u => { user = u; localStorage.setItem('__ffuser', JSON.stringify(u)); auth.forEach(cb => cb(u)); };
  const run = async l => l.cb(await window.__ffDQuery(l.col, l.w));
  window.__ffNotify = async () => { if (user) { const all = await window.__ffGet(user.uid); ls.forEach(cb => cb(all)); } for (const l of qls) await run(l); };
  window.__fireFake = {
    onAuth: cb => { auth.push(cb); setTimeout(() => cb(user), 0); return () => {}; },
    signInPopup: async () => setUser(ident), signInToken: async () => setUser(ident), signOut: async () => setUser(null),
    getAll: uid => window.__ffGet(uid), set: (uid, id, data) => window.__ffSet(uid, id, data), del: (uid, id) => window.__ffDel(uid, id),
    listen: (uid, cb) => { ls.push(cb); setTimeout(() => window.__ffNotify(), 0); return () => { ls = ls.filter(x => x !== cb); }; },
    d: {
      get: p => window.__ffDGet(p.join('/')), set: (p, data, merge) => window.__ffDSet(p.join('/'), data, !!merge),
      update: (p, data) => window.__ffDSet(p.join('/'), data, true), del: p => window.__ffDDel(p.join('/')),
      onQuery: (p, w, cb) => { const l = { col: p.join('/'), w, cb }; qls.push(l); setTimeout(() => run(l), 0); return () => { qls = qls.filter(x => x !== l); }; },
    },
  };
};
async function device(browser, ident, url = 'http://localhost:8765/') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.exposeBinding('__ffGet', (_, uid) => JSON.parse(JSON.stringify(nuvem[uid] || {})));
  await ctx.exposeBinding('__ffSet', async (src, uid, id, data) => { (nuvem[uid] = nuvem[uid] || {})[id] = data; await notify(src.page); });
  await ctx.exposeBinding('__ffDel', async (src, uid, id) => { delete (nuvem[uid] || {})[id]; await notify(src.page); });
  await ctx.exposeBinding('__ffDGet', (_, k) => docs[k] ? JSON.parse(JSON.stringify(docs[k])) : null);
  await ctx.exposeBinding('__ffDSet', async (src, k, data, merge) => { docs[k] = merge ? { ...(docs[k] || {}), ...data } : data; await notify(src.page); });
  await ctx.exposeBinding('__ffDDel', async (src, k) => { delete docs[k]; await notify(src.page); });
  await ctx.exposeBinding('__ffDQuery', (_, col, w) => Object.entries(docs).filter(([k, v]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/') && (!w || v[w[0]] === w[1])).map(([k, v]) => ({ id: k.slice(col.length + 1), ...JSON.parse(JSON.stringify(v)) })));
  await ctx.addInitScript(fake, ident);
  const p = await ctx.newPage(); pages.push(p);
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(500);
  if (await p.locator('[data-tour=skip]').count()) { await p.locator('[data-tour=skip]').click(); await p.waitForTimeout(200); }
  return p;
}
module.exports = { nuvem, docs, pages, device };
