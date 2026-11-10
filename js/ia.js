'use strict';
/* IA (Google Gemini) com a chave do próprio usuário (Configurações → IA).
   O app chama o Gemini direto, sem servidor. Nada é enviado sem o usuário tocar em "Preencher com IA". */
const IA = {
  // Ordem de tentativa: se um modelo estiver sobrecarregado (503/429) ou indisponível, tenta o próximo.
  MODELS: ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
  URL: 'https://generativelanguage.googleapis.com/v1beta/models/',

  key() { return (S.settings.ia && S.settings.ia.key) || ''; },
  ready() { return !!this.key() && this.supported(); },
  supported() { return !Cloud.available(); },   // o link do Claude bloqueia chamadas a outros sites

  /* Chamada genérica. schema = JSON Schema da resposta (devolve o objeto já lido). */
  async call({ system, parts, schema, timeout = 60000 }) {
    if (!this.key()) throw new Error('Cadastre a chave da IA em Configurações → IA.');
    const body = { contents: [{ role: 'user', parts }], ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.2, ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) } };
    let last = null;
    for (const m of this.MODELS) {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeout);
      try {
        const r = await fetch(this.URL + m + ':generateContent', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key() }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          last = new Error(this.explain(r.status, d));
          if ([400, 401, 403].includes(r.status)) throw last;   // chave errada: não adianta tentar outro modelo
          continue;
        }
        const text = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
        if (!text) { last = new Error('A IA não devolveu resposta. Tente de novo.'); continue; }
        return schema ? JSON.parse(text) : text;
      } catch (e) {
        if (e.name === 'AbortError') { last = new Error('A IA demorou demais para responder. Tente de novo.'); continue; }
        if (e instanceof TypeError) { last = new Error('Sem conexão com a IA. Confira a internet.'); continue; }
        throw e;
      } finally { clearTimeout(tm); }
    }
    throw last || new Error('Não foi possível falar com a IA.');
  },
  explain(status, d) {
    const msg = (d && d.error && d.error.message) || '';
    if (status === 400 && /api key/i.test(msg)) return 'Chave da IA inválida. Confira em Configurações → IA.';
    if (status === 401 || status === 403) return 'A chave da IA foi recusada. Confira em Configurações → IA ou crie outra no AI Studio.';
    if (status === 429) return 'Limite de uso da IA atingido por agora. Tente daqui a alguns minutos.';
    if (status >= 500) return 'A IA está sobrecarregada no momento. Tente de novo em instantes.';
    return 'Erro da IA: ' + (msg || status);
  },

  async test() { const t = await this.call({ parts: [{ text: 'Responda apenas: ok' }], timeout: 30000 }); return /ok/i.test(t); },

  /* Ata da reunião: a partir das anotações e/ou do áudio, marca a pauta tratada e lista os combinados */
  async ata(e, { notes = '', audio = null } = {}) {
    const pautas = e.pautas || [];
    const system = `Você organiza a ata de uma reunião conduzida por um líder de equipe técnica (instalação e manutenção de CFTV IP).
Escreva em português do Brasil, de forma objetiva. NÃO invente fatos, nomes, datas, números ou combinados: use só o que estiver nas anotações ou no áudio.
- "tratados": números (1, 2, 3…) dos itens da pauta que foram de fato discutidos. Item só citado de passagem ou adiado não conta.
- "combinados": cada decisão ou tarefa combinada, uma por item, começando pelo responsável quando ele for citado e com o prazo quando houver (ex.: "Carlos monta a escala até sexta").
- "resumo": de 2 a 5 frases com o que foi conversado, incluindo assuntos fora da pauta e o que ficou para depois.
Se não houver nada sobre um campo, devolva lista vazia ou texto vazio.`;
    const parts = [];
    if (audio) parts.push({ inlineData: { mimeType: audio.mime, data: audio.b64 } });
    parts.push({ text: `Reunião: ${e.title} (${U.fmtDate(e.date)}${e.time ? ' ' + e.time : ''})
Pauta numerada:
${pautas.length ? pautas.map((p, i) => `${i + 1}. ${p.text}`).join('\n') : '(sem pauta)'}
${audio ? 'O áudio anexado é a gravação da reunião.' : ''}
${notes.trim() ? `Anotações do líder:\n"""\n${notes.trim()}\n"""` : ''}` });
    const r = await this.call({ system, parts, timeout: audio ? 180000 : 60000, schema: {
      type: 'OBJECT', required: ['tratados', 'combinados', 'resumo'],
      properties: { tratados: { type: 'ARRAY', items: { type: 'INTEGER' } }, combinados: { type: 'ARRAY', items: { type: 'STRING' } }, resumo: { type: 'STRING' } },
    } });
    return {
      tratadas: (r.tratados || []).map(n => pautas[n - 1]).filter(Boolean).map(p => p.id),
      combinados: (r.combinados || []).map(s => String(s).trim()).filter(Boolean),
      resumo: String(r.resumo || '').trim(),
    };
  },
};

/* Gravação de áudio da reunião (microfone do celular ou do computador) */
const Recorder = {
  MAX_MIN: 60, rec: null, chunks: [], started: 0, timer: null, blob: null,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) && !Cloud.available(); },
  async start(onTick) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    this.chunks = []; this.blob = null;
    this.rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    this.rec.ondataavailable = ev => { if (ev.data.size) this.chunks.push(ev.data); };
    this.rec.start(1000);
    this.started = Date.now();
    this.timer = setInterval(() => { const s = Math.floor((Date.now() - this.started) / 1000); onTick(s); if (s >= this.MAX_MIN * 60) this.stop(); }, 500);
    Recorder.keepScreen(true);
  },
  stop() {
    return new Promise(res => {
      clearInterval(this.timer);
      Recorder.keepScreen(false);
      if (!this.rec || this.rec.state === 'inactive') { res(this.blob); return; }
      this.rec.onstop = () => { this.blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' }); this.rec.stream.getTracks().forEach(t => t.stop()); res(this.blob); };
      this.rec.stop();
    });
  },
  keepScreen(on) {   // tela acesa durante a gravação (app Android); falha em silêncio em versões sem o recurso
    try { const r = Native.available() && Native.P().Sistema && Native.P().Sistema.manterTela({ ligada: on }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignorado */ }
  },
  recording() { return !!(this.rec && this.rec.state === 'recording'); },
  async payload() {
    if (!this.blob) return null;
    return { mime: this.blob.type.split(';')[0] || 'audio/webm', b64: await Native.blobToBase64(this.blob) };
  },
  fmt(s) { return `${Math.floor(s / 60)}:${U.pad(s % 60)}`; },
};
