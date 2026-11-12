'use strict';
/* Estado, persistência (LocalStorage) e regras de domínio */
/* Canal de teste (site …/teste/): dados guardados à parte, para nunca misturar com os reais */
const CANAL_TESTE = typeof window !== 'undefined' && window.APP_CHANNEL === 'teste';
const STORAGE_KEY = 'gestao-rotina-wibicam:v1' + (CANAL_TESTE ? ':teste' : '');

/* Indicadores lançados por dia. As chaves são fixas (dados guardados); os nomes podem ser trocados em
   Configurações → Metas (settings.metricNames). Os nomes padrão são genéricos, para qualquer equipe. */
const METRIC_DEFAULT_NAMES = { pontosCamera: 'Serviços concluídos', manutencoes: 'Manutenções realizadas', retrabalhos: 'Retrabalhos' };
const METRICS = Object.keys(METRIC_DEFAULT_NAMES).map(key => ({
  key,
  get label() { const n = typeof S !== 'undefined' && S && S.settings && S.settings.metricNames; return (n && n[key] || '').trim() || METRIC_DEFAULT_NAMES[key]; },
}));
const mLabel = key => METRICS.find(m => m.key === key).label;
const GOAL_METRICS = [...METRICS.filter(m => !m.snapshot), { key: 'tarefasConcluidas', label: 'Tarefas concluídas' }, { key: 'projetosConcluidos', label: 'Projetos concluídos' }];
/* Indicadores de O.S. foram retirados do app (v1.2). Lançamentos e metas antigos continuam guardados. */
const LEGACY_METRICS = { osRecebidas: 'O.S. recebidas', osConcluidas: 'O.S. concluídas', osPendentes: 'O.S. pendentes', osAtrasadas: 'O.S. atrasadas' };
const metricLabel = key => (GOAL_METRICS.find(m => m.key === key) || {}).label || (LEGACY_METRICS[key] ? LEGACY_METRICS[key] + ' (descontinuado)' : key);
const PROJECT_STATUS = {
  planejamento: { label: 'Planejamento', color: '#8e87a3' },
  andamento: { label: 'Em andamento', color: '#9461f5' },
  pausado: { label: 'Pausado', color: '#e3a043' },
  concluido: { label: 'Concluído', color: '#3dbe8b' },
  cancelado: { label: 'Cancelado', color: '#615b70' },
};
const PRIORITY_RANK = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const OPEN = s => s === 'pendente' || s === 'andamento';

const Store = {
  state: null,
  rev: 0,             // muda a cada salvamento (cache de cálculos, ex.: Jornada)
  persistent: true,   // LocalStorage disponível
  lastSaved: null,
  warned: false,

  defaults() {
    // Rotina quase em branco: só uma atividade de exemplo; cada pessoa monta a sua
    const routine = [{ id: U.uid(), start: '08:30', end: '09:00', title: 'Alinhamento com a equipe (exemplo)', category: 'equipe', priority: 'media', notes: 'Atividade de exemplo: edite ou exclua em Configurações → Rotina padrão.', fixed: false, freq: 'semanal', days: [1, 2, 3, 4, 5], monthDay: 1 }];
    return {
      version: 1,
      settings: {
        workStart: '08:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00',
        breakMode: 'flexivel',   // flexivel (marca na hora) | fixo (bloco da rotina) | nenhum
        breakDur: 60,            // duração padrão do intervalo flexível (min)
        workDays: [1, 2, 3, 4, 5],
        alertDays: 2,
        theme: 'escuro',  // escuro | claro | auto (segue o aparelho)
        showIndicadores: false,
        showProjetos: false,     // tela Projetos oculta por padrão (Configurações → Aparência)
        jogo: true,              // modo jogo: XP, sequência e conquistas (Configurações → Aparência)
        empresa: '',             // nome da empresa/equipe mostrado no menu (opcional, Configurações → Aparência)
        metricNames: {},         // nomes personalizados dos indicadores (vazio = METRIC_DEFAULT_NAMES)
        lembretes: { on: false, antes: 15, repetir: true, resumo: true },   // avisos no celular/navegador
        ia: { key: '', agente: '', nivel: 'detalhada' },   // chave do Google Gemini do próprio usuário (Configurações → IA)   // tela Indicadores oculta por padrão (Configurações → Aparência)
        categories: [
          { id: 'demandas', name: 'Demandas', color: '#8e87a3' },
          { id: 'equipe', name: 'Equipe', color: '#b08cf5' },
          { id: 'operacional', name: 'Operacional', color: '#7b3fe4' },
          { id: 'administrativo', name: 'Administrativo', color: '#6f6a82' },
          { id: 'pendencias', name: 'Pendências', color: '#e3a043' },
          { id: 'intervalo', name: 'Intervalo', color: '#4b4559' },
          { id: 'projetos', name: 'Projetos', color: '#6c8ef0' },
          { id: 'estrategico', name: 'Estratégico', color: '#3fb5a8' },
          { id: 'indicadores', name: 'Indicadores', color: '#c77deb' },
          { id: 'imprevistos', name: 'Imprevistos', color: '#ee5a6f' },
          { id: 'campo', name: 'Visita em campo', color: '#86bf6a' },
        ],
        priorities: {
          baixa: { label: 'Baixa', color: '#8e87a3' },
          media: { label: 'Média', color: '#9b7bea' },
          alta: { label: 'Alta', color: '#e3a043' },
          urgente: { label: 'Urgente', color: '#ee5a6f' },
        },
        statuses: {
          pendente: { label: 'Pendente', color: '#8e87a3' },
          andamento: { label: 'Em andamento', color: '#9461f5' },
          concluida: { label: 'Concluída', color: '#3dbe8b' },
          cancelada: { label: 'Cancelada', color: '#615b70' },
        },
        technicians: [],
        goals: [],
      },
      routine,
      days: {},
      weekly: {
        focus: [],   // em branco: o usuário define o foco e o checklist de cada dia
        checks: {},
      },
      monthly: {
        cycles: [1, 2, 3, 4].map(n => ({ n, title: '', items: [] })),   // em branco
        checks: {},
      },
      tasks: [],
      projects: [],
      occurrences: [],
      events: [],
      indicators: [],
      feedbacks: [],   // feedbacks individuais da equipe (tela Feedbacks)
      equipes: [],     // equipes de que a pessoa participa ({ id, nome, papel: gestor|membro }) — Conta FlowFire
      missoes: [],     // missões da Jornada (recebidas do gestor ou criadas pela própria pessoa)
      meta: { v2: true, v3: true, v4: true, v5: true },   // ex.: tutorialSeen; v2 = já no formato do novo visual
    };
  },

  load() {
    try {
      const t = '__teste__'; localStorage.setItem(t, '1'); localStorage.removeItem(t);
      const raw = localStorage.getItem(STORAGE_KEY);
      this.state = raw ? this.migrate(JSON.parse(raw)) : this.defaults();
    } catch (e) {
      this.persistent = false;
      this.state = this.defaults();
    }
    S = this.state;
  },

  migrate(s) {
    const d = this.defaults();
    const needV2 = !(s.meta && s.meta.v2);
    if (needV2 && s.settings && !s.settings.theme) s.settings.theme = 'claro';   // dados antigos sem tema = claro
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const k of Object.keys(d.settings)) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
    if (needV2) { this.migrateV2(s); s.meta = { ...(s.meta || {}), v2: true }; }
    if (!s.meta.v3) { this.migrateV3(s); s.meta.v3 = true; }
    if (!s.meta.v4) { this.migrateV4(s); s.meta.v4 = true; }
    if (!s.meta.v5) { if (s.settings && s.settings.empresa === 'Wi-bicam, CFTV IP') s.settings.empresa = ''; s.meta.v5 = true; }
    return s;
  },

  /* v4/v5: o app ficou genérico (para qualquer equipe), sem nome de empresa. Quem já usava mantém os nomes dos indicadores de antes. */
  migrateV4(s) {
    if (!s.settings) return;
    s.settings.metricNames = { pontosCamera: 'Pontos de câmera instalados', ...(s.settings.metricNames || {}) };
  },

  /* v3: intervalo de almoço flexível (o usuário não tem horário fixo). Tira o intervalo da rotina dos dias futuros já montados. */
  migrateV3(s) {
    if (!s.settings) return;
    s.settings.breakMode = 'flexivel';
    const t = U.today();
    for (const [k, blocks] of Object.entries(s.days || {})) if (k > t) s.days[k] = blocks.filter(b => !(b.category === 'intervalo' && b.routineId && b.status === 'pendente'));
  },

  /* v2 (novo visual): planejamento semanal/mensal em branco, nova paleta e tema escuro como padrão.
     Só mexe no que ainda está igual ao modelo original; nada criado pelo usuário é apagado. */
  migrateV2(s) {
    const oldWeek = { 1: ['Planejamento', ['Analisar pendências anteriores', 'Distribuir atividades', 'Definir prioridades', 'Verificar disponibilidade da equipe', 'Estabelecer metas semanais']],
      2: ['Operação', ['Acompanhar instalações', 'Acompanhar manutenções', 'Monitorar produtividade', 'Verificar gargalos operacionais']],
      3: ['Gestão de pessoas', ['Avaliar desempenho dos técnicos', 'Identificar dificuldades', 'Realizar feedbacks', 'Planejar treinamentos']],
      4: ['Projetos e estratégia', ['Acompanhar projetos', 'Conferir prazos e entregas', 'Planejar melhorias', 'Avaliar novas demandas']],
      5: ['Resultados', ['Consolidar indicadores', 'Conferir O.S. concluídas e pendentes', 'Avaliar resultados', 'Registrar problemas', 'Preparar a próxima semana']] };
    const oldCycles = [['Diagnóstico', ['Levantamento de indicadores', 'Análise de produtividade', 'Levantamento de pendências', 'Definição de objetivos']],
      ['Equipe e estrutura', ['Avaliação da equipe', 'Treinamentos', 'Materiais e equipamentos', 'Necessidades operacionais']],
      ['Projetos e qualidade', ['Acompanhamento de projetos', 'Análise de prazos', 'Avaliação de qualidade', 'Propostas de melhoria']],
      ['Consolidação', ['Fechamento dos indicadores', 'Avaliação de metas', 'Registro de problemas recorrentes', 'Planejamento do mês seguinte']]];
    if (s.weekly && Array.isArray(s.weekly.focus)) {
      s.weekly.focus = s.weekly.focus.map(f => {
        const old = oldWeek[f.day]; if (!old) return f;
        const items = (f.items || []).filter(i => !old[1].includes(i.text));
        return { ...f, items, title: f.title === old[0] ? '' : f.title };
      }).filter(f => f.title || f.items.length);
    }
    if (s.monthly && Array.isArray(s.monthly.cycles)) {
      s.monthly.cycles = s.monthly.cycles.map((c, i) => {
        const old = oldCycles[i]; if (!old) return c;
        return { ...c, title: c.title === old[0] ? '' : c.title, items: (c.items || []).filter(x => !old[1].includes(x.text)) };
      });
    }
    const map = { '#64748b': '#8e87a3', '#7c3aed': '#b08cf5', '#0284c7': '#7b3fe4', '#475569': '#6f6a82', '#d97706': '#e3a043', '#cbd5e1': '#4b4559', '#2563eb': '#6c8ef0',
      '#0d9488': '#3fb5a8', '#4f46e5': '#c77deb', '#dc2626': '#ee5a6f', '#65a30d': '#86bf6a', '#94a3b8': '#8e87a3', '#16a34a': '#3dbe8b', '#6b7280': '#615b70' };
    const st = s.settings || {};
    (st.categories || []).forEach(c => { if (map[c.color]) c.color = map[c.color]; });
    const dp = this.defaults().settings;
    for (const grp of ['priorities', 'statuses']) for (const [k, v] of Object.entries(st[grp] || {})) if (v && map[v.color] && dp[grp][k]) v.color = dp[grp][k].color;
    if (st.theme === 'claro') st.theme = 'escuro';   // o novo visual nasce escuro; o claro continua disponível
  },

  /* touch = alteração feita aqui (marca o horário e envia ao Google Drive). Dados vindos de fora usam touch: false. */
  save({ cloud = true, touch = true } = {}) {
    this.rev++;
    if (touch && this.state) { this.state.meta = this.state.meta || {}; this.state.meta.updatedAt = Date.now(); }
    if (this.persistent) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); this.lastSaved = new Date(); }
      catch (e) { this.persistent = false; }
    }
    if (cloud) Cloud.schedule();
    if (typeof Reminders !== 'undefined') Reminders.schedule();
    if (touch && typeof Drive !== 'undefined') Drive.schedule();
    if (touch && typeof Fire !== 'undefined') Fire.schedule();
    if (Native.available()) Native.persist();
    if (!this.persistent && Cloud.state !== 'on' && Cloud.state !== 'connecting' && !this.warned) {
      this.warned = true;
      UI.toast('Não foi possível salvar os dados neste navegador.', 'error');
    }
  },
  /* Há onde guardar os dados de forma duradoura? */
  isPersistent() { return Cloud.state === 'on' || (this.persistent && !Cloud.available()); },

  replace(newState, { fromCloud = false, fromDrive = false } = {}) {
    this.state = this.migrate(newState);
    S = this.state;
    if (typeof Jogo !== 'undefined') Jogo.last = null;   // dados vindos de fora não geram o aviso de "+XP"
    this.save({ cloud: !fromCloud, touch: !fromCloud && !fromDrive });
  },

  /* ---------- Dados de demonstração (sempre marcados com demo: true) ---------- */
  hasDemo() {
    return ['tasks', 'projects', 'occurrences', 'events', 'indicators'].some(k => S[k].some(x => x.demo)) || S.settings.technicians.some(t => t.demo);
  },
  loadDemo() {
    if (this.hasDemo()) return false;
    const t = U.today(), now = new Date().toISOString();
    const tk = (title, category, priority, status, due, extra = {}) => ({ id: U.uid(), demo: true, title: '[Exemplo] ' + title, description: 'Registro de demonstração — pode ser removido em Configurações.', category, priority, status, createdAt: now, startDate: t, dueDate: due, dueTime: '', notes: '', completedAt: status === 'concluida' ? now : null, ...extra });
    S.tasks.push(
      tk('Revisar pendências da semana', 'pendencias', 'alta', 'pendente', U.addDays(t, 1)),
      tk('Conferir estoque de materiais', 'administrativo', 'media', 'andamento', U.addDays(t, 4)),
      tk('Enviar relatório semanal', 'indicadores', 'urgente', 'pendente', U.addDays(t, -1)),
      tk('Agendar treinamento da equipe', 'equipe', 'baixa', 'concluida', U.addDays(t, -2)),
    );
    const t1 = { id: U.uid(), demo: true, name: 'Colaborador Exemplo A' }, t2 = { id: U.uid(), demo: true, name: 'Colaborador Exemplo B' };
    S.settings.technicians.push(t1, t2);
    const st = names => names.map((n, i) => ({ id: U.uid(), name: n, done: i < 2 }));
    S.projects.push(
      { id: U.uid(), demo: true, name: '[Exemplo] Implantação no cliente', client: 'Cliente Exemplo', description: 'Projeto de demonstração.', responsible: t1.name, startDate: U.addDays(t, -20), dueDate: U.addDays(t, 15), status: 'andamento', manualProgress: null, notes: '', stages: st(['Vistoria técnica', 'Projeto e orçamento', 'Instalação de câmeras', 'Configuração do NVR', 'Entrega e treinamento']), pendencias: [{ id: U.uid(), text: 'Aguardando liberação de acesso ao telhado', done: false }], createdAt: now, completedAt: null },
      { id: U.uid(), demo: true, name: '[Exemplo] Melhoria de processo interno', client: 'Empreendimento Exemplo', description: 'Projeto de demonstração.', responsible: t2.name, startDate: U.addDays(t, 3), dueDate: U.addDays(t, 40), status: 'planejamento', manualProgress: 0, notes: '', stages: [], pendencias: [], createdAt: now, completedAt: null },
    );
    S.occurrences.push({ id: U.uid(), demo: true, title: '[Exemplo] Sistema fora do ar no cliente', description: 'Ocorrência de demonstração.', priority: 'urgente', date: t, time: '09:40', dueDate: t, dueTime: '17:00', responsible: t1.name, status: 'pendente', notes: '', scheduled: null, createdAt: now });
    S.events.push({ id: U.uid(), demo: true, title: '[Exemplo] Reunião com cliente', date: U.addDays(t, 2), time: '10:00', notes: '' });
    // Lançamentos de indicadores de exemplo nos últimos 10 dias úteis
    let k = t, n = 0, seed = 7;
    const rnd = (a, b) => { seed = (seed * 9301 + 49297) % 233280; return a + Math.floor((seed / 233280) * (b - a + 1)); };
    while (n < 10) {
      k = U.addDays(k, -1);
      if (!D.isWorkday(k)) continue;
      n++;
      for (const tec of [t1, t2]) {
        S.indicators.push({ id: U.uid(), demo: true, date: k, technician: tec.name, notes: '', values: { pontosCamera: rnd(0, 8), manutencoes: rnd(0, 3), retrabalhos: rnd(0, 1) } });
      }
    }
    S.settings.goals.push({ id: U.uid(), demo: true, name: '[Exemplo] Serviços concluídos na semana', metric: 'pontosCamera', period: 'semanal', target: 30, direction: 'min' });
    return true;
  },
  removeDemo() {
    for (const k of ['tasks', 'projects', 'occurrences', 'events', 'indicators']) S[k] = S[k].filter(x => !x.demo);
    S.settings.technicians = S.settings.technicians.filter(x => !x.demo);
    S.settings.goals = S.settings.goals.filter(x => !x.demo);
    for (const k of Object.keys(S.days)) S.days[k] = S.days[k].filter(b => !b.demo);
  },
};
let S = null;

/* ---------- Regras de domínio ---------- */
const D = {
  cat(id) { return S.settings.categories.find(c => c.id === id) || { id: '', name: 'Sem categoria', color: '#8e87a3' }; },
  prio(p) { return S.settings.priorities[p] || { label: '—', color: '#8e87a3' }; },
  status(s) { return S.settings.statuses[s] || { label: '—', color: '#8e87a3' }; },
  techNames() { return S.settings.technicians.map(t => t.name); },

  isWorkday(k) { return S.settings.workDays.includes(U.weekday(k)); },
  nextWorkday(k) { let n = U.addDays(k, 1); for (let i = 0; i < 14 && !D.isWorkday(n); i++) n = U.addDays(n, 1); return n; },

  routineFor(k) {
    if (!D.isWorkday(k)) return [];
    const wd = U.weekday(k), dom = U.parse(k).getDate();
    const fixedBreak = (S.settings.breakMode || 'fixo') === 'fixo';
    return S.routine
      .filter(r => fixedBreak || r.category !== 'intervalo')   // intervalo flexível: marcado na hora pela Agenda
      .filter(r => r.freq === 'mensal' ? Number(r.monthDay) === dom : (r.days || []).includes(wd))
      .map(r => ({ id: r.id, routineId: r.id, start: r.start, end: r.end, title: r.title, category: r.category, priority: r.priority, notes: r.notes || '', fixed: !!r.fixed, status: 'pendente' }));
  },
  sortBlocks(arr) { return [...arr].sort((a, b) => U.toMin(a.start) - U.toMin(b.start) || U.toMin(a.end) - U.toMin(b.end)); },
  dayBlocks(k) { return D.sortBlocks(S.days[k] || D.routineFor(k)); },
  ensureDay(k) { if (!S.days[k]) S.days[k] = D.routineFor(k).map(b => ({ ...b })); return S.days[k]; },
  findBlock(k, id) { return D.ensureDay(k).find(b => b.id === id); },

  /* Intervalo: não conta no progresso nem como atraso. "Horário fixo" só impede o deslocamento automático. */
  isBreak(b) { return b.category === 'intervalo'; },
  blockDone(b) { return b.status === 'concluida' || b.status === 'cancelada'; },
  blockLate(b, k) {
    if (D.isBreak(b) || D.blockDone(b)) return false;
    const t = U.today();
    if (k < t) return true;
    return k === t && U.toMin(b.end) <= U.nowMin();
  },
  blockNow(b, k) { const n = U.nowMin(); return k === U.today() && U.toMin(b.start) <= n && U.toMin(b.end) > n; },
  conflicts(blocks) {
    const ids = new Set();
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j];
      if (a.status === 'cancelada' || b.status === 'cancelada') continue;
      if (U.toMin(a.start) < U.toMin(b.end) && U.toMin(b.start) < U.toMin(a.end)) { ids.add(a.id); ids.add(b.id); }
    }
    return ids;
  },
  progress(k) {
    const bl = D.dayBlocks(k).filter(b => !D.isBreak(b) && b.status !== 'cancelada');
    const done = bl.filter(b => b.status === 'concluida').length;
    return { done, total: bl.length, pct: bl.length ? Math.round(done / bl.length * 100) : null };
  },
  /* Desloca as atividades posteriores à âncora para que não fiquem sobrepostas.
     Atividades de horário fixo (ex.: intervalo) e concluídas não são movidas. */
  reflow(k, anchorId) {
    const blocks = D.sortBlocks(D.ensureDay(k));
    const anchor = blocks.find(b => b.id === anchorId);
    if (!anchor) return 0;
    const fixed = blocks.filter(b => b.fixed && b.id !== anchorId && b.status !== 'cancelada');
    let cursor = U.toMin(anchor.end);
    let moved = 0;
    for (const b of blocks) {
      if (b === anchor || b.fixed || D.blockDone(b)) continue;
      if (U.toMin(b.start) < U.toMin(anchor.start)) continue;
      const dur = U.toMin(b.end) - U.toMin(b.start);
      let s = Math.max(U.toMin(b.start), cursor);
      for (let guard = 0; guard < 20; guard++) {
        const hit = fixed.find(f => s < U.toMin(f.end) && s + dur > U.toMin(f.start));
        if (!hit) break;
        s = U.toMin(hit.end);
      }
      if (s !== U.toMin(b.start)) moved++;
      b.start = U.fromMin(s); b.end = U.fromMin(Math.min(1439, s + dur));
      cursor = s + dur;
    }
    return moved;
  },
  overflowCount(k) { const end = U.toMin(S.settings.workEnd); return D.dayBlocks(k).filter(b => !D.blockDone(b) && U.toMin(b.end) > end).length; },
  moveBlock(fromK, id, toK, start) {
    const src = D.ensureDay(fromK);
    const i = src.findIndex(b => b.id === id);
    if (i < 0) return null;
    const [b] = src.splice(i, 1);
    const dur = U.toMin(b.end) - U.toMin(b.start);
    const nb = { ...b, id: U.uid(), routineId: null, status: b.status === 'andamento' ? 'pendente' : b.status, notes: [b.notes, `Remanejada de ${U.fmtShort(fromK)} ${b.start}`].filter(Boolean).join(' · ') };
    if (start) { nb.start = start; nb.end = U.fromMin(U.toMin(start) + dur); }
    D.ensureDay(toK).push(nb);
    if (b.occurrenceId) { const o = S.occurrences.find(x => x.id === b.occurrenceId); if (o) o.scheduled = { date: toK, blockId: nb.id }; }
    return nb;
  },

  /* Prazos: retorna nível de alerta (late | today | soon | ok) */
  deadline(date, time, done) {
    if (!date || done) return null;
    const d = U.diffDays(U.today(), date);
    if (d < 0) return { level: 'late', label: `Atrasada há ${U.plural(-d, 'dia')}` };
    if (d === 0) return (time && U.toMin(time) <= U.nowMin()) ? { level: 'late', label: 'Atrasada (hoje)' } : { level: 'today', label: time ? `Vence hoje, ${time}` : 'Vence hoje' };
    if (d <= Number(S.settings.alertDays || 0)) return { level: 'soon', label: `Vence em ${U.plural(d, 'dia')}` };
    return { level: 'ok', label: `Prazo ${U.fmtShort(date)}` };
  },
  taskLate(t) { const i = D.deadline(t.dueDate, t.dueTime, !OPEN(t.status)); return !!i && i.level === 'late'; },
  occLate(o) { const i = D.deadline(o.dueDate, o.dueTime, !OPEN(o.status)); return !!i && i.level === 'late'; },

  projectProgress(p) {
    if (p.stages && p.stages.length) return Math.round(p.stages.filter(s => s.done).length / p.stages.length * 100);
    return U.clamp(Number(p.manualProgress) || 0, 0, 100);
  },
  projectLate(p) { return p.dueDate && p.dueDate < U.today() && !['concluido', 'cancelado'].includes(p.status); },

  /* ---------- Indicadores ---------- */
  records(from, to) { return S.indicators.filter(r => r.date >= from && r.date <= to); },
  metricValue(metric, from, to, filterFn) {
    const meta = METRICS.find(m => m.key === metric);
    if (metric === 'tarefasConcluidas') return S.tasks.filter(t => t.status === 'concluida' && t.completedAt && t.completedAt.slice(0, 10) >= from && t.completedAt.slice(0, 10) <= to).length;
    if (metric === 'projetosConcluidos') return S.projects.filter(p => p.status === 'concluido' && p.completedAt && p.completedAt.slice(0, 10) >= from && p.completedAt.slice(0, 10) <= to).length;
    let recs = D.records(from, to).filter(r => r.values && r.values[metric] !== null && r.values[metric] !== undefined && r.values[metric] !== '');
    if (filterFn) recs = recs.filter(filterFn);
    if (!recs.length) return null;
    if (meta && meta.snapshot) {
      const last = recs.reduce((m, r) => r.date > m ? r.date : m, '');
      return recs.filter(r => r.date === last).reduce((s, r) => s + Number(r.values[metric]), 0);
    }
    return recs.reduce((s, r) => s + Number(r.values[metric]), 0);
  },
  lastDateWith(metric, from, to) {
    const recs = D.records(from, to).filter(r => r.values && r.values[metric] !== null && r.values[metric] !== undefined);
    return recs.reduce((m, r) => r.date > m ? r.date : m, '') || null;
  },
  goalRange(goal, ref = U.today()) {
    if (goal.period === 'mensal') { const mk = U.monthKey(ref); return [U.monthStart(mk), U.monthEnd(mk)]; }
    if (goal.period === 'diaria') return [ref, ref];
    const ws = U.weekStart(ref); return [ws, U.addDays(ws, 6)];
  },
  goalStatus(goal, ref) {
    const [from, to] = D.goalRange(goal, ref);
    const val = D.metricValue(goal.metric, from, to);
    const target = Number(goal.target) || 0;
    if (val === null) return { val: null, target, pct: null, achieved: null, from, to };
    const achieved = goal.direction === 'max' ? val <= target : val >= target;
    const pct = goal.direction === 'max' ? (val <= target ? 100 : Math.round(target / val * 100)) : (target ? Math.min(100, Math.round(val / target * 100)) : 100);
    return { val, target, pct, achieved, from, to };
  },
};
