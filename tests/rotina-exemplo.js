// Rotina de 12 blocos (08:00–18:00) usada pelos testes. O app novo começa só com uma atividade de exemplo.
const LIST = [
  ['08:00', '08:30', 'Abertura e análise de demandas', 'demandas'],
  ['08:30', '09:00', 'Alinhamento da equipe', 'equipe'],
  ['09:00', '10:30', 'Acompanhamento operacional', 'operacional'],
  ['10:30', '11:30', 'Atividades administrativas', 'administrativo'],
  ['11:30', '12:00', 'Resolução de pendências', 'pendencias'],
  ['12:00', '13:00', 'Intervalo', 'intervalo', true],
  ['13:00', '14:30', 'Gestão de projetos', 'projetos'],
  ['14:30', '15:30', 'Gestão da equipe', 'equipe'],
  ['15:30', '16:15', 'Planejamento estratégico', 'estrategico'],
  ['16:15', '17:15', 'Relatórios e indicadores', 'indicadores'],
  ['17:15', '17:40', 'Janela flexível para imprevistos', 'imprevistos'],
  ['17:40', '18:00', 'Fechamento do expediente', 'administrativo'],
];
// Troca a rotina padrão do app aberto na página pela de 12 blocos
module.exports = p => p.evaluate(list => {
  S.routine = list.map(([start, end, title, category, fixed]) => ({ id: U.uid(), start, end, title, category, priority: 'media', notes: '', fixed: !!fixed, freq: 'semanal', days: [1, 2, 3, 4, 5], monthDay: 1 }));
  commit();
}, LIST);
