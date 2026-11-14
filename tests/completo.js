// Testes do app completo: liga as telas que o modo enxuto esconde (window.APP_COMPLETO = true em toda página).
// O app publicado usa o modo enxuto; estes testes continuam cobrindo o código das telas que ficaram guardadas.
const { chromium } = require('playwright');
if (!chromium.__completo) {
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...a) => {
    const b = await launch(...a);
    const nc = b.newContext.bind(b);
    b.newContext = async (...o) => { const c = await nc(...o); await c.addInitScript(() => { window.APP_COMPLETO = true; }); return c; };
    return b;
  };
  chromium.__completo = true;
}
