'use strict';
/* Transferência de dados entre versões (APK, web, link do Claude):
   - arquivo de backup (.json), aceito sem filtro de tipo (Android costuma não reconhecer .json);
   - "código de transferência": o backup comprimido (gzip) em texto, para copiar e colar
     por WhatsApp, e-mail, Keep etc., sem depender de arquivos. */
const Transfer = {
  PREFIX_GZ: 'GR1:',   // gzip + base64
  PREFIX_RAW: 'GR0:',  // base64 sem compressão (navegadores antigos)

  b64FromBytes(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  bytesFromB64(b64) {
    const s = atob(b64); const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },

  async encode(state) {
    const json = JSON.stringify(state);
    if (typeof CompressionStream === 'function') {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return this.PREFIX_GZ + this.b64FromBytes(buf);
    }
    return this.PREFIX_RAW + this.b64FromBytes(new TextEncoder().encode(json));
  },

  /* Aceita: código GR1/GR0, ou o JSON do arquivo de backup. Retorna o estado ou lança erro com mensagem amigável. */
  async decode(text) {
    let t = String(text || '').trim();
    if (!t) throw new Error('Nada foi colado.');
    let json;
    const at = t.search(/GR[01]:/);
    if (at >= 0) {
      t = t.slice(at).replace(/\s+/g, '');
      const kind = t.slice(0, 4), b64 = t.slice(4);
      let bytes;
      try { bytes = this.bytesFromB64(b64); } catch (e) { throw new Error('O código está incompleto ou foi alterado. Copie-o inteiro de novo.'); }
      if (kind === this.PREFIX_GZ) {
        if (typeof DecompressionStream !== 'function') throw new Error('Este navegador é antigo demais para ler o código. Use o arquivo de backup.');
        try {
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          json = await new Response(stream).text();
        } catch (e) { throw new Error('O código está incompleto ou foi alterado. Copie-o inteiro de novo.'); }
      } else json = new TextDecoder().decode(bytes);
    } else {
      json = t.replace(/^﻿/, '');
    }
    let data;
    try { data = JSON.parse(json); } catch (e) { throw new Error('Não é um backup deste aplicativo (conteúdo inválido).'); }
    if (!data || !data.settings || !Array.isArray(data.tasks)) throw new Error('Não é um backup deste aplicativo.');
    return data;
  },

  summary(d) {
    const n = (a) => Array.isArray(a) ? a.length : 0;
    return `${U.plural(n(d.tasks), 'tarefa')}, ${U.plural(n(d.projects), 'projeto')}, ${U.plural(n(d.occurrences), 'imprevisto')}, ${U.plural(n(d.indicators), 'lançamento')} de indicadores e ${U.plural(Object.keys(d.days || {}).length, 'dia')} de agenda`;
  },

  confirmImport(data) {
    UI.confirm(`Importar estes dados?<br><br><strong>${U.esc(this.summary(data))}</strong>.<br><br>Os dados atuais <strong>desta versão</strong> serão substituídos. Se quiser, exporte um backup antes.`, () => {
      Store.replace(data);
      App.render();
      UI.toast('Dados importados.');
    }, { okLabel: 'Importar' });
  },

  async copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* tenta o método alternativo */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  },

  /* Janela "Enviar meus dados": gera o código, copia e oferece compartilhar */
  async openExport() {
    let code;
    try { code = await this.encode(S); } catch (e) { UI.toast('Não foi possível gerar o código: ' + U.esc(e.message), 'error'); return; }
    const kb = Math.max(1, Math.round(code.length / 1024));
    const canShare = Native.available() || (typeof navigator.share === 'function' && !Cloud.available());
    const big = code.length > 60000;
    const m = UI.modal({
      title: 'Levar meus dados para outra versão',
      body: `
        <ol class="steps">
          <li>Toque em <strong>Copiar código</strong>${canShare ? ' ou <strong>Enviar código</strong>' : ''}.</li>
          <li>Mande o código para você mesmo, por exemplo pelo WhatsApp (conversa “Você”), e-mail ou Google Keep.</li>
          <li>Na outra versão (site, link do Claude ou outro celular), abra <strong>Configurações → Dados → Receber dados</strong>, cole o código e confirme.</li>
        </ol>
        <p class="muted small">Contém ${U.esc(this.summary(S))} · ${kb} KB.${big ? ' <strong>O código é grande:</strong> se o WhatsApp cortar a mensagem, use e-mail ou o arquivo de backup.' : ''}</p>
        <textarea class="code-box" readonly rows="4">${U.esc(code)}</textarea>`,
      footer: `${canShare ? `<button class="btn" data-share>${U.icon('arrow', 15)} Enviar código</button>` : ''}<span class="grow"></span><button class="btn primary" data-copy>${U.icon('check', 15)} Copiar código</button>`,
    });
    const box = m.el.querySelector('.code-box');
    box.addEventListener('focus', () => box.select());
    m.el.querySelector('[data-copy]').onclick = async () => {
      if (await this.copyText(code)) UI.toast('Código copiado. Cole na outra versão em Configurações → Dados → Receber dados.');
      else { box.focus(); box.select(); UI.toast('Não foi possível copiar sozinho: o texto está selecionado. Use “Copiar” do teclado.', 'warn'); }
    };
    const sh = m.el.querySelector('[data-share]');
    if (sh) sh.onclick = async () => {
      try {
        if (Native.available()) await Native.P().Share.share({ title: 'Dados do Gestão de Rotina', text: code, dialogTitle: 'Enviar código de transferência' });
        else await navigator.share({ title: 'Dados do Gestão de Rotina', text: code });
      } catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e.name)))) UI.toast('Não foi possível enviar: ' + U.esc(e.message || e), 'error'); }
    };
  },

  /* Janela "Receber dados": colar código (ou o conteúdo do backup) ou escolher o arquivo */
  openImport() {
    const m = UI.modal({
      title: 'Receber dados de outra versão',
      body: `
        <p>Cole aqui o <strong>código de transferência</strong> gerado na outra versão (começa com <code>GR1:</code>).</p>
        <textarea class="code-box" rows="5" placeholder="Cole o código aqui…" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
        <div class="form-error" hidden></div>
        <p class="muted small mt">Ou, se você tem o <strong>arquivo de backup</strong> (.json):</p>
        <label class="btn">${U.icon('upload', 15)} Escolher arquivo de backup<input type="file" data-file hidden></label>`,
      footer: `<span class="grow"></span><button class="btn ghost" data-cancel>Cancelar</button><button class="btn primary" data-go>Continuar</button>`,
    });
    const err = m.el.querySelector('.form-error');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    const go = async (text) => {
      err.hidden = true;
      try { const data = await this.decode(text); m.close(); this.confirmImport(data); }
      catch (e) { fail(e.message); }
    };
    m.el.querySelector('[data-cancel]').onclick = () => m.close();
    m.el.querySelector('[data-go]').onclick = () => go(m.el.querySelector('.code-box').value);
    m.el.querySelector('[data-file]').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { await go(await f.text()); } catch (ex) { fail('Não foi possível ler o arquivo: ' + ex.message); }
    });
  },
};
