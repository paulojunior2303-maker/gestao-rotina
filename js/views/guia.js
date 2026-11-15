'use strict';
/* Tela "Guia de uso" */

const Guide = {
  /* Onde os dados ficam, conforme o modo em que o app está rodando */
  whereData() {
    if (typeof Drive !== 'undefined' && Drive.connected()) return `${Native.available() ? 'neste celular' : 'neste navegador'} e no seu Google Drive (iguais no app e no site)`;
    if (Native.available()) return 'neste celular';
    if (Cloud.state === 'on') return 'na sua conta Claude (área privada), iguais no celular e no computador';
    return 'neste navegador';
  },
};


Views.guia = {
  title: 'Guia de uso', icon: 'info', nav: 'Guia de uso',
  mount(root) {
    const id = App.ui.guideSec; if (!id) return;
    App.ui.guideSec = null;
    const el = root.querySelector('#g-' + id);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  },
  renderEnxuto() {
    const sec = (id, icon, title, html, open) => `<details class="guide-sec card" ${open ? 'open' : ''} id="g-${id}"><summary>${U.icon(icon)}<span>${title}</span>${U.icon('right', 16)}</summary><div class="guide-body">${html}</div></details>`;
    const li = arr => `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `<div class="card guide-hero"><div><h2>${CANAL_ENXUTO ? 'FlowFire Enxuto' : 'FlowFire'}</h2><p class="muted">Calendário do mês e um botão para gravar reuniões e feedbacks. Só isso, bem feito.</p></div></div>
    ${sec('gravar', 'mic', 'Gravar uma reunião ou feedback', li([
      'Toque em <strong>Gravar</strong> (no meio da barra de baixo, ou no botão grande do Calendário). Começa na hora: não precisa criar a reunião antes.',
      'Pode deixar o celular na mesa: a tela fica acesa. Dá para gravar <strong>horas</strong>.',
      'Quer usar o app enquanto grava? Toque em <strong>Continuar gravando e usar o app</strong>. A barra vermelha mostra o tempo; toque nela para voltar.',
      'No fim, toque em <strong>Encerrar gravação</strong> e diga se foi reunião ou feedback (e com quem). Pode deixar para depois.',
    ]), true)}
    ${sec('transcricao', 'spark', 'Transcrição e resumo', li([
      'A gravação é dividida em <strong>partes de 10 minutos</strong>. Cada parte é transcrita assim que fecha, mesmo com a gravação ainda rolando.',
      'Quando todas as partes estão prontas, a IA faz o <strong>resumo</strong> (ata da reunião ou registro do feedback, no padrão do seu agente) e lista os <strong>combinados</strong>, que viram tarefas com um toque.',
      'Precisa da chave da IA em <strong>Configurações → IA</strong>. Sem ela, as gravações ficam guardadas esperando.',
    ]))}
    ${sec('seguro', 'check', 'O áudio nunca se perde', li([
      'O áudio vai para o celular a cada 5 segundos. Se o app fechar, a bateria acabar ou o celular travar, ao abrir de novo a gravação é <strong>recuperada</strong>.',
      'Sem internet? As partes esperam e são transcritas <strong>sozinhas</strong> quando a conexão voltar.',
      'O áudio fica guardado até você apagar (em Gravações → abra a gravação → <strong>Apagar o áudio</strong>). A transcrição e o resumo continuam.',
      'Dá para ouvir e baixar cada parte do áudio.',
    ]))}
    ${sec('calendario', 'calendar', 'Calendário', li([
      'O mês inteiro na tela inicial. Toque num dia para ver o que tem nele: gravações, reuniões, compromissos e prazos.',
      'O <strong>+</strong> adiciona tarefa, compromisso ou atividade no dia escolhido.',
      CANAL_ENXUTO ? 'Esta cópia guarda os dados só neste aparelho, separados do FlowFire.' : 'Entre com a <strong>conta FlowFire</strong> (Configurações → Conta) para os dados irem para a nuvem. O áudio e a transcrição completa ficam no aparelho.',
    ]))}`;
  },
  render() { return this.renderEnxuto(); },
};

Object.assign(Actions, {
  guideOpen({ id }) { App.ui.guideSec = id; App.go('guia'); },
});
