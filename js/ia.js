'use strict';
/* IA (Google Gemini) com a chave do próprio usuário (Configurações → IA).
   O app chama o Gemini direto, sem servidor. Nada é enviado sem o usuário tocar em "Preencher com IA". */
const IA = {
  // Ordem de tentativa: se um modelo estiver sobrecarregado (503/429) ou indisponível, tenta o próximo.
  MODELS: ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
  RETRY_PAUSE: 3000,   // se todos estiverem sobrecarregados, espera e tenta mais uma rodada
  URL: 'https://generativelanguage.googleapis.com/v1beta/models/',

  key() { return (S.settings.ia && S.settings.ia.key) || ''; },
  ready() { return !!this.key() && this.supported(); },
  supported() { return !Cloud.available(); },   // o link do Claude bloqueia chamadas a outros sites

  /* Chamada genérica. schema = JSON Schema da resposta (devolve o objeto já lido). */
  async call({ system, parts, schema, timeout = 60000, models }) {
    if (!this.key()) throw new Error('Cadastre a chave da IA em Configurações → IA.');
    const body = { contents: [{ role: 'user', parts }], ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.2, ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) } };
    let last = null;
    const list = models || this.MODELS;
    for (const m of [...list, null, ...list]) {
      if (m === null) { await new Promise(r => setTimeout(r, this.RETRY_PAUSE)); continue; }   // 2ª rodada
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

  /* Transcrição de um trecho de áudio (rápida: usa primeiro o modelo leve) */
  async transcribe(audio) {
    const t = await this.call({ models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'], timeout: 45000,
      system: 'Transcreva fielmente, em português do Brasil, o que é falado neste trecho de uma reunião de equipe técnica. Não resuma, não comente e não invente. Quando outra pessoa começar a falar, comece uma nova linha com "— ". Se não houver fala compreensível, responda apenas com: [silêncio]',
      parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: 'Transcreva este trecho.' }] });
    return /^\[sil[eê]ncio\]$/i.test(t.trim()) ? '' : t.trim();
  },

  async test() { const t = await this.call({ parts: [{ text: 'Responda apenas: ok' }], timeout: 30000 }); return /ok/i.test(t); },

  /* Instruções do agente do usuário (Configurações → IA). Sem elas, um estilo padrão enxuto. */
  agent() { return ((S.settings.ia && S.settings.ia.agente) || '').trim(); },
  level() { return (S.settings.ia && S.settings.ia.nivel) || 'detalhada'; },
  LEVELS: { detalhada: 'ATA detalhada: registre os assuntos com contexto, problemas identificados, propostas, decisões e encaminhamentos', compacta: 'ATA compacta: mantenha apenas os principais assuntos, decisões e orientações', resumida: 'ATA resumida: apresente uma síntese geral da reunião, sem perder informações essenciais' },
  DEFAULT_AGENT: `Você é o assistente de documentação de um líder de equipe técnica (instalação e manutenção de CFTV IP).
Escreva em português do Brasil, de forma profissional, natural e objetiva, direto ao ponto, sem burocracia e sem repetir informações.
Não invente fatos, participantes, decisões ou responsabilidades. Não transforme sugestões em decisões; o que ficou sem definição é pendência.
Elimine conversas paralelas. Preserve nomes, números, datas e prazos. Considere que transcrições automáticas podem ter erros e não complete trechos incompreensíveis com suposições.`,
  system(task) {
    return `${this.agent() || this.DEFAULT_AGENT}

=== Instruções do aplicativo Gestão de Rotina (seguir sempre, junto com as de cima) ===
${task}
Entregue texto simples, pronto para copiar: sem markdown (não use #, ** ou _). Numere os assuntos ("1. ", "2. ") e use "• " para os tópicos.`;
  },

  /* Ata da reunião (no padrão do agente) + o que o app precisa: pauta tratada e combinados */
  async ata(e, { notes = '', audio = null, transcript = '', nivel } = {}) {
    const pautas = e.pautas || [];
    const lvl = this.LEVELS[nivel || this.level()] || this.LEVELS.detalhada;
    const system = this.system(`Tarefa: /ata. Transforme a reunião abaixo em uma ATA organizada. Nível: ${lvl}.
Use a data e o título informados. Se o agente definir um cabeçalho (ex.: "ATA DE REUNIÃO — Equipe ..."), use-o.
Responda em JSON com:
- "ata": o documento completo da ata, pronto para usar, com quebras de linha (\\n): uma linha para cada campo do cabeçalho, uma linha em branco antes de cada assunto numerado e uma linha para cada tópico.
- "tratados": números (1, 2, 3…) dos itens da pauta que foram de fato discutidos (item adiado ou só citado não conta).
- "combinados": decisões confirmadas e compromissos assumidos, um por item, começando pelo responsável quando citado e com o prazo quando houver. Não inclua sugestões nem pendências.`);
    const parts = [];
    if (audio) parts.push({ inlineData: { mimeType: audio.mime, data: audio.b64 } });
    parts.push({ text: `Reunião: ${e.title}
Data: ${U.fmtDate(e.date)}${e.time ? ', ' + e.time : ''}
Pauta numerada:
${pautas.length ? pautas.map((p, i) => `${i + 1}. ${p.text}`).join('\n') : '(sem pauta)'}
${audio ? 'O áudio anexado é a gravação da reunião.' : ''}
${transcript.trim() ? `Transcrição da reunião (automática, pode ter erros; [mm:ss] = tempo):\n"""\n${transcript.trim()}\n"""` : ''}
${notes.trim() ? `Anotações do líder:\n"""\n${notes.trim()}\n"""` : ''}` });
    const r = await this.call({ system, parts, timeout: audio ? 180000 : 90000, schema: {
      type: 'OBJECT', required: ['ata', 'tratados', 'combinados'],
      properties: { ata: { type: 'STRING' }, tratados: { type: 'ARRAY', items: { type: 'INTEGER' } }, combinados: { type: 'ARRAY', items: { type: 'STRING' } } },
    } });
    return {
      tratadas: (r.tratados || []).map(n => pautas[n - 1]).filter(Boolean).map(p => p.id),
      combinados: (r.combinados || []).map(s => String(s).trim()).filter(Boolean),
      ata: this.tidy(String(r.ata || '')),
    };
  },
  /* Garante quebras de linha se a IA devolver o documento "corrido" */
  tidy(t) {
    t = t.replace(/\r/g, '').trim();
    if (t.split('\n').length > 3) return t;
    return t.replace(/\s+(Data:|Assunto:|Participantes:|Local:)/g, '\n$1')
      .replace(/\s+(\d{1,2}\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, '\n\n$1')
      .replace(/\s+([•*]\s)/g, '\n$1')
      .replace(/\s+(Pendências|Encaminhamentos|Considerações finais|Próximos passos)(:?)\s/g, '\n\n$1$2\n')
      .trim();
  },

  /* Comandos rápidos do agente sobre um texto pronto */
  REWRITE: { natural: '/natural — Deixe o texto mais natural, fluido e menos formal, mantendo o profissionalismo.', compact: '/compact — Reduza o conteúdo ao essencial, preservando as informações importantes.', detalhado: '/detalhado — Aprofunde o conteúdo, mantendo todos os pontos relevantes da fonte.' },
  async rewrite(text, mode, source = '') {
    return this.tidy(await this.call({ system: this.system(`Tarefa: ${this.REWRITE[mode]}
Mantenha a mesma estrutura de documento (cabeçalho, assuntos numerados). Não acrescente fatos que não estejam no texto${source ? ' ou na transcrição de referência' : ''}.
Responda apenas com o documento reescrito.`), parts: [{ text: `Documento:\n"""\n${text}\n"""${source ? `\n\nTranscrição de referência (fonte, pode ter erros):\n"""\n${source.slice(0, 60000)}\n"""` : ''}` }], timeout: 90000 }));
  },

  /* Pauta de uma reunião futura, a partir do tema e das pendências de reuniões anteriores */
  async pauta({ title, tema, pendencias = [] }) {
    const r = await this.call({ system: this.system(`Tarefa: monte a PAUTA de uma reunião que ainda vai acontecer.
Responda em JSON com "itens": a lista de assuntos, em sequência lógica, cada um curto (até ~10 palavras), sem numeração.
Use apenas o que estiver no tema descrito e nas pendências informadas; não invente assuntos. Inclua as pendências que tiverem relação com a reunião.`),
      parts: [{ text: `Reunião: ${title || '(sem título)'}
O que o líder quer tratar:
"""
${tema}
"""
${pendencias.length ? `Pendências de reuniões anteriores:\n${pendencias.map(x => '- ' + x).join('\n')}` : ''}` }],
      schema: { type: 'OBJECT', required: ['itens'], properties: { itens: { type: 'ARRAY', items: { type: 'STRING' } } } }, timeout: 60000 });
    return (r.itens || []).map(x => String(x).replace(/^\s*[\d.)•\-–]+\s*/, '').trim()).filter(Boolean);
  },
};

/* Gravação da reunião com transcrição ao vivo.
   O áudio é gravado em trechos independentes (~40 s). Cada trecho vai para a IA assim que termina e o texto aparece
   na tela; trechos que falharem (sem internet, IA sobrecarregada) são tentados de novo ao encerrar.
   O áudio não fica guardado: só o texto. */
const Recorder = {
  MAX_MIN: 90, SEG_MS: 40000,
  stream: null, rec: null, running: false, started: 0, timer: null, segTimer: null,
  parts: [], queue: Promise.resolve(), pending: 0, onUpdate: null, mime: '',
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) && !Cloud.available(); },
  recording() { return this.running; },
  elapsed() { return Math.floor((Date.now() - this.started) / 1000); },
  fmt(s) { return `${Math.floor(s / 60)}:${U.pad(s % 60)}`; },
  keepScreen(on) {   // tela acesa durante a gravação (app Android); falha em silêncio em versões sem o recurso
    try { const r = Native.available() && Native.P().Sistema && Native.P().Sistema.manterTela({ ligada: on }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignorado */ }
  },

  /* onUpdate({ elapsed, text, pending, failed }) é chamado a cada segundo e a cada trecho transcrito */
  async start(onUpdate) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    this.parts = []; this.pending = 0; this.queue = Promise.resolve(); this.onUpdate = onUpdate;
    this.running = true; this.started = Date.now();
    this.segment();
    this.timer = setInterval(() => { this.emit(); if (this.elapsed() >= this.MAX_MIN * 60) this.stop(); }, 1000);
    this.keepScreen(true);
  },
  segment() {
    const idx = this.parts.length, at = this.elapsed();
    this.parts.push({ at, text: null, blob: null, failed: false });
    const chunks = [];
    const rec = this.rec = new MediaRecorder(this.stream, { ...(this.mime ? { mimeType: this.mime } : {}), audioBitsPerSecond: 24000 });
    rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (this.running) this.segment();   // emenda o próximo trecho na hora
      this.parts[idx].blob = blob;
      this.transcribe(idx);
      if (this.stopResolve && !this.running) { const r = this.stopResolve; this.stopResolve = null; r(); }
    };
    rec.start();
    this.segTimer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, this.SEG_MS);
  },
  transcribe(idx) {
    const part = this.parts[idx];
    if (!part.blob || part.blob.size < 2000) { part.text = ''; this.emit(); return; }   // trecho vazio/curtíssimo
    this.pending++; this.emit();
    this.queue = this.queue.then(async () => {
      try {
        const b64 = await Native.blobToBase64(part.blob);
        part.text = await IA.transcribe({ mime: part.blob.type.split(';')[0], b64 });
        part.failed = false; part.blob = null;
      } catch (e) { part.failed = true; part.error = e.message; }
      this.pending--; this.emit();
    });
  },
  stop() {
    if (!this.running) return Promise.resolve();
    this.running = false;
    clearInterval(this.timer); clearTimeout(this.segTimer);
    this.keepScreen(false);
    return new Promise(res => {
      this.stopResolve = () => { this.stream.getTracks().forEach(t => t.stop()); this.emit(); res(); };
      if (this.rec && this.rec.state === 'recording') this.rec.stop(); else this.stopResolve();
    });
  },
  /* Espera os trechos em andamento e tenta de novo os que falharam */
  async finish() {
    await this.queue;
    this.parts.forEach((p, i) => { if (p.failed && p.blob) this.transcribe(i); });
    await this.queue;
  },
  failed() { return this.parts.filter(p => p.failed).length; },
  text() { return this.parts.filter(p => p.text).map(p => `[${this.fmt(p.at)}] ${p.text}`).join('\n'); },
  reset() { this.parts = []; this.onUpdate = null; },
  emit() { if (this.onUpdate) this.onUpdate({ elapsed: this.running ? this.elapsed() : null, text: this.text(), pending: this.pending, failed: this.failed() }); },
};
