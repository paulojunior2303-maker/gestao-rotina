# Gestão de Rotina — instruções para o Claude

App de gestão de rotina e cronograma para a liderança de uma equipe operacional de CFTV IP (Wi-bicam).
O usuário final não é desenvolvedor: responda em **português do Brasil**, explique em linguagem simples
e diga o que mudou e como testar no celular.

## Arquitetura
- **App web sem dependências** (HTML/CSS/JS puro, scripts clássicos, sem bundler). Ordem de carga em `index.html`.
- `js/store.js`: estado, persistência e regras de negócio (objeto `D`). `js/views/*.js`: uma tela por arquivo,
  registrada em `Views` e com ações em `Actions` (delegação por `data-act`, `data-change`, `data-input`, `data-submit`).
- Rotas por hash simples: `#agenda`, `#tarefas`… (nunca `#/rota?param`, porque o claude.ai só repassa `#nome`).
- Três formas de rodar o **mesmo código**:
  1. **Navegador / GitHub Pages**: dados no LocalStorage.
  2. **Link do claude.ai** (artifact `ae6f85e3-cb62-466a-a3c1-f707cc0d62dd`): `js/cloud.js` salva na conta (capability `db`),
     downloads via `downloads`. Impressão e `<a download>` são bloqueados nesse modo.
  3. **App Android** (`android-app/`, Capacitor): `js/native.js` (Filesystem/Share/App + plugin próprio `PrinterPlugin.java`).
- `python3 build.py` gera `dist/gestao-rotina.html` (arquivo único). É ele que vai para o APK e para o artifact.

## Regras do produto (não quebrar)
- **Nunca inventar dados.** Indicador sem lançamento = “sem dados” (`null`), nunca zero.
- Dados de demonstração sempre com `demo: true`, prefixo “[Exemplo]” e removíveis.
- Progresso/atrasos ignoram só o **Intervalo** (`D.isBreak`) e canceladas. “Horário fixo” só impede o deslocamento automático.
- Layout precisa caber em 393 px de largura (Redmi Note 12 do usuário), com o botão Salvar sempre visível.
- Mudou o formato do estado? Mantenha compatibilidade em `Store.migrate` e em `Cloud.split/join` (limite de 256 KB por documento).
- Interface simples: o usuário não quer um sistema que dê mais trabalho do que economiza.
- Indicadores de **O.S. foram removidos** a pedido do usuário (v1.2). Não reintroduzir. Dados antigos ficam em `LEGACY_METRICS`.
- **Identidade visual v2** (roxo intenso, violeta, lilás, grafite e preto): tema **escuro é o padrão**, claro e automático continuam em Configurações → Aparência.
  Use sempre as variáveis de `:root` / `:root[data-theme="dark"]` em `css/styles.css` (`--primary`, `--accent`, `--lilac`, `--surface*`, …), nunca cores fixas.
  Tipografia: Geist (interface) e Bricolage Grotesque (títulos e números), em `fonts/` (OFL), embutidas no arquivo único pelo `build.py`.
  A "régua do dia" (`H.dayRail`, em `js/ui.js`) é o elemento de assinatura: Dashboard e Agenda. `tests/theme.test.js` verifica o contraste.
- **App enxuto (limpeza aprovada pelo usuário)**: telas Calendário (Início), Gravações, Tarefas, Agenda e Imprevistos + Configurações e Guia de uso.
  O código de jogo/Jornada/missões, equipes, indicadores, projetos, pessoas, checklists, revisão da semana, "Agora", abrir/fechar o dia, gráficos,
  relatórios Excel/PDF e tutorial foi **apagado**. Os dados dessas telas continuam no estado (`S.projects`, `S.indicators`, `S.missoes`, `S.equipes`,
  `S.checks`, `S.diario`…), em `Store.migrate` e nos `split/join` da nuvem, para não perder nada de quem já usava. Endereços antigos caem na tela mais próxima.
- **Navegação**: **barra inferior** no celular (`BOTTOM` em `app.js`: Calendário, Gravações, **Gravar** no meio, Tarefas, Agenda), **sem** botão Menu.
  Menu lateral (☰ ou arrastar da borda): no celular mostra só o que **não** está na barra de baixo (Imprevistos, Configurações, Guia; classe `in-bottom`);
  no computador (sem barra de baixo) mostra tudo e o Calendário tem o botão grande de gravar (`.gv-rec-big`, escondido no celular).
- **Botão flutuante "+"** (`#fab`, `FAB` em `app.js`): cada view declara `fab` (objeto ou função `{ act, label, data }`). Calendário e Agenda usam `quickAdd`
  (só a anotação rápida, **sem** a lista "Ou escolha": reunião/feedback/relatório ficam em Gravações, a pedido do usuário). Tarefas usa o formulário de tarefa.
- **Tarefa e agenda são uma coisa só (pedido do usuário, v1.1.23)**: o "+" tem só **Tarefa** (padrão, já no dia escolhido) e **Imprevisto**; o antigo "Na agenda" virou
  tarefa com `dueDate` + `dueTime` + `dur` (minutos, opcional; `Cal.fimTarefa`). Não criar bloco em `S.days` a partir do "+" nem do relatório/áudio (`Gravador.aplicar`
  e `IA.itensNorm` convertem `tipo: 'agenda'` em tarefa). `Cal.itemsOn(hoje)` também traz as tarefas abertas **sem data** e as **atrasadas** (`semData`), para tudo aparecer
  no Calendário e na Agenda; nas duas listas a tarefa tem ✓/↶ (`Cal.check` → `tkSet`). "Intervalo agora" (flexível) fica no topo da Agenda (`.ag-btns`).
  Blocos da rotina (`S.days`) continuam: vêm da rotina padrão e o `Actions.agNew` segue existindo (formulário completo), mas sem botão no "+".
- **Formulário de tarefa enxuto (pedido do usuário)**: tudo numa tela só, sem "Mais detalhes"/"Mais opções". No "+" (`Capture`, aba Tarefa): Quando, Horário + Duração
  (`#cap-dur`, `Tasks.DURS`), Quem faz, Prioridade + Repetir (`#cap-prio`, `#cap-rep`) e Observação (`#cap-obs` → `description`). Aba Imprevisto: tempo agora,
  Quem resolve, Prioridade + Prazo para resolver (`#cap-oprio`, `#cap-odue`) e Observação. **Não há mais "Mais detalhes"** (nem `Capture.details`).
  `Occ.form` (Registrar/Editar imprevisto) também é uma tela só, dois campos por linha, sem status (botões Iniciar/Resolver/Reabrir do cartão).
  `Tasks.form` (Nova tarefa da tela Tarefas e Editar): os mesmos campos, dois por linha também no celular (`.form-grid:has(.tk-form-dica)`); **sem** categoria,
  status e data de início (ficam como estão; status pelos botões da lista). Ao editar, `description` + `notes` antigas viram um campo só ("Observação").
- **Anotação rápida** (`js/captura.js`, `Capture`): o "+" do Início, da Agenda e dos Imprevistos abre um campo de texto único com o tipo
  (Tarefa · Imprevisto). `Capture.parse` lê, sem internet, data/horário/duração/nome da equipe. Imprevisto com tempo
  (`Capture.encaixarAgora`) entra na agenda **agora** e empurra o resto (a atividade em andamento continua depois), com "Desfazer". Testes: `tests/captura.test.js`.
- **Recursos do dia a dia que ficaram**: `js/replan.js` (`Replan`, "Reorganizar meu dia" no menu da Agenda; `Replan.fromNow` adianta a agenda quando um imprevisto
  termina antes); tarefas que se repetem (`task.repeat` diaria|semanal|quinzenal|mensal, `repeatDay`; `Tasks.setStatus` cria a próxima e a apaga ao reabrir);
  `UI.form` com campos `more: true` em "Mais opções" (`moreOpen`). Testes: `tests/recursos.test.js`.
- **Relatório do dia por voz** (`tipo: 'relatorio'` na gravação; botão em Gravações e, no fim do expediente, no Calendário): `IA.relatorio` recebe a transcrição
  e o contexto do dia (`Gravador.contextoDia`) e devolve o relatório pronto (WhatsApp/copiar) + `g.itens` (tarefa | imprevisto | compromisso | agenda, com data,
  hora, duração, responsável e situação feito|pendente|futuro). A pessoa confere/troca o tipo e toca em "Anotar no app" (`Gravador.aplicar`; agenda sem hora vira tarefa;
  o que já foi feito fica só no relatório, exceto imprevisto). Testes em `tests/enxuto.test.js` [7].
- **Áudio ou texto** (Gravar → "Áudio ou texto" ou botão em Gravações; nome genérico a pedido do usuário; `tipo: 'audio'`, `g.de`, `origem` audio|texto|misto): tela única `Gravador.pedido`
  com **vários áudios** (input sem `accept`, para o Android abrir o gerenciador de arquivos; `ehAudio`/`mimeDe`: WhatsApp .opus → `audio/ogg`; até ~19 MB cada) e/ou o texto colado.
  `importarPedido` guarda cada áudio como uma parte (rótulo "Áudio N", arquivo) e o texto como parte `texto: true` em `textos`; transcrição/novas tentativas iguais às gravações;
  no fim `IA.recado({ fontes })` analisa tudo junto e devolve resumo + itens (`IA.itensNorm`; pedido para o usuário = `responsavel` vazio). Tela igual à do relatório.
  **Compartilhar do Android** (WhatsApp → Compartilhar → FlowFire, um ou vários áudios e/ou texto): `CompartilharPlugin.java` (intent-filters SEND/SEND_MULTIPLE `*/*` no
  `AndroidManifest.xml`, porque o WhatsApp manda .opus com tipo desconhecido) lê os arquivos e manda em base64 no evento `recebido` (retido até o app ouvir; reserva `pendentes()`);
  `Gravador.ouvirCompartilhar/compartilhado` abre a tela do pedido já preenchida. Só funciona no APK (testado com build local `assembleDebug`).
- **Nome de quem usa o app** (`settings.usuario`; cartão "Como você se chama?" no Calendário enquanto estiver vazio e Configurações → Você): vai na saudação e em `IA.system`
  (quem fala na primeira pessoa nas gravações é essa pessoa). No relatório do dia, item do próprio usuário fica com `responsavel` vazio (agenda/tarefa dele); de outra pessoa, com o nome dela.
- **Cópia enxuta** (ramo `enxuto`, site https://paulojunior2303-maker.github.io/gestao-rotina/enxuto/): `python3 build.py --enxuto` → `dist/gestao-rotina-enxuto.html`
  (`APP_CHANNEL = 'enxuto'` → `CANAL_ENXUTO`, também `CANAL_TESTE`; LocalStorage `…:enxuto`; sem Drive e sem conta FlowFire por enquanto). Publicar: `bash tools/publicar-enxuto.sh "msg"`
  (grava `enxuto/index.html` no `main`; o `pages.yml` copia a pasta). O app oficial agora é igual a ela (mesmo código); a cópia só muda os dados (aparelho) e a falta de conta/Drive.
  **Gravador** (`js/gravador.js`, `Gravador` + `AudioDB` + `Views.gravacoes`): um toque grava; pedaços a cada 5 s no IndexedDB (`pedacos`), parte de 10 min (`partes`)
  transcrita assim que fecha (`IA.transcribe`, texto em `textos`); sem internet/chave fica `pendente` e tenta de novo (evento `online`, abrir o app, a cada 10 s/1 min);
  app fechado no meio → `Gravador.recuperar()`; no fim `IA.ata`/`IA.feedback` e `Gravador.vincular` cria a reunião (`S.events`, `gravacaoId`) ou o feedback.
  `S.gravacoes` (nuvem em `gv-AAAA-MM`); áudio e transcrição completa ficam só no aparelho até a pessoa apagar. Testes: `tests/enxuto.test.js` (microfone falso, partes de 3 s).
- **Agenda numa tela só** (`js/views/agenda.js`): calendário compacto em cima (`Cal.render('agenda')`, semana; "Ver o mês inteiro" expande) e, embaixo,
  o dia escolhido numa lista única por horário: blocos da rotina + reuniões/compromissos/prazos (`.blk-it`). O dia da agenda é `App.ui.agendaDate`, sincronizado com `Cal.sync`.
  O planejamento semanal/mensal (foco, checklist, metas das 4 semanas) foi retirado da interface a pedido do usuário; `S.weekly`/`S.monthly` continuam guardados.
  `#semanal`/`#mensal` antigos redirecionam para a Agenda.
- **Calendário** (`js/calendar.js`, `Cal`) é o recurso principal: no Início e no topo da Agenda. Mês/semana, bolinhas no celular e títulos no computador,
  lista do dia escolhido, arrastar para trocar de mês/semana, "Hoje". Reuniões têm cor própria (`--t-reuniao`).
- **Intervalo de almoço**: `settings.breakMode` = flexivel (padrão; "+" → "Intervalo agora" na Agenda, empurra o resto) | fixo (bloco da rotina) | nenhum.
- **Tarefas**: botões na linha (▶ começar, ✓ concluir, ✕ cancelar, ↶ reabrir; ⋯ só Editar e Excluir); não há seletor de status na lista.
  A tela abre direto na lista: situações numa linha que rola para o lado (`.stat-chips`, `aria-pressed`), busca à vista (`.tk-busca`) e os demais filtros
  atrás do botão **Filtros** (`tkFiltros`, `App.ui.taskFOpen`; no celular ficam escondidos, a não ser que algum esteja ligado; no computador sempre à vista).
- **Revisão de design (v1.1.22, aprovada pelo usuário)**: semana do calendário começa no **domingo** (`Cal.inicioSemana`; `U.weekStart` continua segunda para dados antigos);
  gravação com cor própria (`--t-gravacao`, verde-azulado) e gravação pronta/reunião registrada **sem risco** (`Cal.feito` → `ok`); "+" discreto (superfície, ícone roxo,
  sem brilho) que sai da frente ao rolar para baixo (`body.fab-off`); toques de 44 px no celular; tema **"Sol forte"** (`settings.theme = 'sol'` → tema claro +
  `data-contraste="alto"`); saudação por hora (`Views.dashboard.saudacao`: bom dia 5h–11h59, boa tarde 12h–17h59, boa noite 18h–4h59).
  O usuário **recusou** trocar o Início por um resumo "agora/próximo" (o calendário do mês inteiro fica) e **recusou** os conceitos visuais novos (letreiro, painel de embarque, placa de obra): manter a identidade v2.
  Testes: `tests/visual.test.js`.
- **Design v3 (6 sugestões, no teste; bloco "Design v3" no fim de `css/styles.css`)**: (1) Tarefas como lista de papel: linha fina, círculo `.tk-ck` para concluir
  (`tkSet`), grupos por quando (`.tk-grp`: atrasadas, hoje, amanhã, próximos 7 dias, mais adiante, sem data), prioridade só alta/urgente em palavra (`.tk-prio`), abas sublinhadas
  (`.tk-abas`, ainda `.stat-chip`); **botão único** (`Tasks.botao`, pedido do usuário) no lugar do círculo: ▶ começa → na tarefa em execução vira ✓ e conclui → concluída/cancelada reabre.
  Regras em `Tasks.pode` (chamado por `tkSet` e pelos avisos): **só conclui o que foi começado** e **só uma tarefa em execução por vez** (para trocar: concluir ou
  **Reagendar** no ⋯, `Tasks.reagendar`, que volta para pendente com novo dia/horário). Com uma em execução, o ▶ das outras fica apagado (`.bloq`). Calendário e Agenda usam o mesmo
  botão (`Cal.check` → `Tasks.botao`). Avisos do Android: `TAREFA` tem "Começar" (`comecar`), `TAREFA_RUN` (em execução) tem "Concluir" (`feito`). ✕ "Cancelar" fica no ⋯ (`tkMore`).
  **Tarefa em execução destacada** (`.task.andamento`, `.calx-it.run`, `.blk-it.run`; `run` em `Cal.itemsOn`): fundo roxo, faixa à esquerda, "em execução" com ponto pulsando (`.run-dot`)
  e grupo próprio no topo ("Em execução agora", `g-execucao`), também na lista do dia do Início e na Agenda. (2) Início com a data grande (`Views.dashboard.diaHero`: `.dh-n` + resumo de
  três números que levam a Tarefas/Agenda); o topo mostra só a saudação. Calendário sem caixinhas. (3) Roxo só onde importa: lista do dia em grafite, `.calx-agora` (atividade da
  rotina em andamento) em destaque, vermelho só no atrasado; `Cal.check` usa o mesmo círculo. (4) Agenda proporcional: `min-height` de 1 px/min (54–220 px), tempo livre
  `.ag-livre`, linha da hora atual `.ag-agora`, itens sem horário no grupo `.ag-semhora`, tarefa com horário tracejada; concluir a rotina também é círculo. (5) Computador:
  abertas em três colunas (`.tk-cols`: Hoje · Depois · Sem data; refaz ao cruzar 901 px). (6) Telas vazias com a voz do app (`H.vazio`): Tarefas, Imprevistos, Gravações, Agenda.
- **Nome do app: FlowFire** (tudo junto, na fonte arredondada Quicksand no menu), ícone em `icon.svg` (só as duas labaredas roxas da logo original, em vetor; o arco e a estrela foram retirados a pedido do usuário) e PNGs do Android em `res/mipmap-*` e `splash.png`.
  **Não renomear**: a pasta do Drive (`Drive.FOLDER = 'Gestão de Rotina'`, senão a sincronização perde o arquivo), a chave do LocalStorage, o pacote Android e o arquivo `GestaoRotina.apk` (o aviso de atualização das versões instaladas procura esse nome).
- **Conta FlowFire / Firebase** (`js/fire.js`, `Fire`): login com Google (web: popup; Android: `GooglePlugin.autorizar` com escopos openid/email/profile → `signInWithCredential` com o access token) e sincronização ao vivo no Firestore em `canais/{oficial|teste}/usuarios/{uid}/docs/{id}` (JSON como texto em `v`; documentos por mês para agenda, reuniões, feedbacks e indicadores). SDK carregado sob demanda do gstatic. Regras em `firestore.rules` (cada um só os próprios documentos). Testes usam `window.__fireFake` (`tests/fire.test.js`). Projeto Firebase `gestao-de-rotina-514301` (o mesmo do Drive). As **equipes** na nuvem foram retiradas do app (as regras de `equipes` continuam em `firestore.rules`, sem uso).
- **Sincronização sem perguntar** (`Fire.tresVias`, `mergeDoc`, `saveBase`): o aparelho guarda em `localStorage['ff-fire-base:<canal>']` o resumo (`Fire.hash`) de cada
  documento no último ponto igual à nuvem. Ao abrir: só a nuvem mudou → recebe; só aqui → envia; os dois → junta item por item por `id` (empate: lado mais novo; dias: por data).
  A pergunta "Juntar os dados" só aparece na primeira vez de um aparelho que já tem dados. **Itens apagados** viram "lápides" em `S.meta.apagados` (`Store.marcarApagados`, só em
  alterações feitas aqui; `Store.replace` não conta como apagar; somem após 60 dias): `mergeDoc` não traz de volta o que um aparelho apagou, e o `core` soma as lápides dos dois lados.
- **Segurança (auditoria)**: `UI.toast` é sempre texto puro; `Transfer.semChave` tira `settings.ia.key` do backup e do código de transferência (importar mantém a chave do aparelho);
  `Store.sanear` (no `migrate`) limpa campos "de máquina" (`CAMPOS_MAQUINA`: ids, cores, datas, status…) de dados vindos de fora; `CompartilharPlugin` só lê `content://`.
  Texto livre continua sendo escapado com `U.esc` na hora de mostrar. Testes: `tests/seguranca.test.js`.
- `tests/run.sh` roda os arquivos em paralelo (4 por vez).
- **Reuniões e feedbacks** não têm mais tela própria (`#reunioes`/`#feedbacks` abrem Gravações). Ficam o formulário de reunião/compromisso (`Events`, `js/views/mensal.js`,
  aberto pelo calendário e pelo +), `Meetings` (`js/views/reunioes.js`) e o formulário de feedback (`FB`, `js/views/feedbacks.js`, pelo +).
  Peças reaproveitáveis de IA/gravação em `IAUI` (`js/ia.js`).
- **App genérico** (para qualquer equipe): sem marca de empresa no código. `settings.empresa` (opcional, Configurações → Aparência) aparece no menu;
  `settings.metricNames` renomeia os 3 indicadores (chaves fixas `pontosCamera`/`manutencoes`/`retrabalhos`; nomes padrão em `METRIC_DEFAULT_NAMES`).
  Rotina padrão começa com **uma atividade de exemplo** na instalação nova (o usuário monta a sua; botão "Limpar rotina").
  Os testes usam a rotina antiga de 12 blocos (`tests/rotina-exemplo.js`).
  "Técnicos" virou "Equipe" na interface (a chave continua `settings.technicians`). `Store.migrateV4` (marca `meta.v4`) mantém, para quem já usava,
  "Pontos de câmera instalados"; `meta.v5` tira o "Wi-bicam, CFTV IP" (pedido do usuário: nenhum nome de empresa no app). A chave do LocalStorage (`gestao-rotina-wibicam:v1`) e o pacote Android **não mudam** (perderia dados/atualizações).
- `Store.migrateV2` (marca `meta.v2`) limpou o modelo antigo do planejamento, trocou a paleta e passou o tema para escuro uma única vez. Não remover.
- **Lembretes ligados por padrão** (pedido do usuário; `meta.v6` liga uma vez para quem já usava; instalação nova já nasce com `v6`): no Android, `initNative` pede a permissão
  uma vez (`localStorage['ff-lem-pedido']`); no navegador, cartão "Quer ser avisado no horário?" no Calendário (`Reminders.webCard`, "Agora não" → `ff-lem-web`).
- **Marcar reunião/compromisso/feedback sem gravar**: botão em Gravações (`gvMarcar` → `Events.form` / `FB.form`).
- **Gravação com tela bloqueada (Android)**: `GravacaoService.java` (serviço em primeiro plano tipo microfone + wake lock parcial, aviso fixo "FlowFire está gravando"),
  ligado por `Sistema.gravando({ ligada })` a partir de `Recorder.keepScreen` (vale para o `Gravador` e o `Recorder`). Só liga com a permissão do microfone já dada.
- **Tarefa com horário x rotina**: tarefa aberta com `dueTime` + `dur` ocupa o horário (`Cal.ocupados`, `Cal.batem`): a Agenda mostra "Conflito" e o aviso `.ag-bate`,
  o "+" avisa com "Reorganizar", e `Replan.plan` trata essas tarefas como horário fixo (a rotina desvia). Testes: `tests/melhorias.test.js`.
- **Testes antes do APK**: o `android-apk.yml` tem o job `testes` (Playwright 1.63 + `tests/run.sh`); o job `apk` só roda se ele passar.
- **Lembretes** (`js/lembretes.js`, `Reminders`): calculados de novo a cada gravação (`Store.save`). Android: `@capacitor/local-notifications`
  (botões Feito/Ciente; até 60 agendados); navegador: só com o site aberto. Plugin próprio `SistemaPlugin.java` abre bateria/inicialização automática (Xiaomi).
- **Google Drive** (`js/drive.js`, `Drive`): arquivo `gestao-rotina-dados.json` na pasta "Gestão de Rotina" do Drive do usuário (escopo `drive.file`).
  Vale a versão com `meta.updatedAt` mais novo (`Store.save` marca o horário; dados vindos de fora usam `touch: false`). Sincroniza ao abrir/voltar e ~2,5 s após cada alteração.
  Android: `GooglePlugin.java` (AuthorizationClient do play-services-auth; cliente OAuth Android = pacote + SHA-1 da chave de release).
  Site: Google Identity Services com o cliente Web (token ~1 h em sessionStorage; depois aparece "Sincronizar"). Projeto Google Cloud do usuário.
  `tests/drive.test.js` simula a API do Drive. A conexão (e-mail, ids) fica em `localStorage['gr-drive']`, por aparelho.
- **iPhone (PWA na Tela de Início; não há app iOS)**: metas `apple-mobile-web-app-*`, `viewport-fit=cover`, `apple-touch-icon` = `icon-180.png`
  (gerado por `node tools/icone-iphone.js`, junto com `icon-512.png`; o `build.py` troca por endereço completo, menos no teste, que usa `teste/icon-180.png`).
  `Theme.apply` troca a barra de status (escuro: `black-translucent`; claro: `default`). Campos com 16 px só no iOS (`@supports (-webkit-touch-callout: none)`, evita zoom).
  Cartão "Use como app no iPhone" no Calendário (`Views.dashboard.iphoneCard`, some com "Entendi" → `localStorage['ff-iphone-ok']`). Áudio do Safari é MP4: `IA.mimeIA`.
  `sw.js`: a lista `FILES` precisa bater com os `<script>` do `index.html` (`tests/iphone.test.js` confere; antes listava arquivos apagados e o cache offline falhava).
- **Aviso de versão nova** (`Updater`): o APK compara `App.getInfo().version` com a última Release do GitHub.
- **Reuniões** são `S.events` com `reuniao: true` e/ou `pautas`; `registro` = tratadas + combinados + resumo (as gravadas ficam ligadas por `gravacaoId`).
- **IA** (`js/ia.js`): Google Gemini direto do app, com a chave do usuário em `settings.ia.key` (Configurações → IA). Modelos em `IA.MODELS`
  (tenta o próximo em 503/429/timeout). `Recorder` grava em trechos independentes de 40 s (webm/opus 24 kbps, até 90 min) e transcreve cada um ao vivo (`IA.transcribe`); ao encerrar, `IA.ata` usa a transcrição em texto. O áudio não é guardado; a transcrição vai em `registro.transcricao` (até 30 mil caracteres). Durante a gravação a janela não fecha (`canClose`). Indisponível no link do Claude.
  Ata no padrão do **agente do usuário** (`settings.ia.agente`, colado em Configurações → IA; nível em `settings.ia.nivel`) via `IA.system()`;
  `IA.rewrite` = comandos /natural, /compact, /detalhado; `IA.pauta` gera a pauta (com pendências de `Events.pendencias`). `IA.tidy` garante quebras de linha.
  **Nunca** colocar chave real nem o prompt do agente do usuário em código, teste ou commit (repositório público): os testes simulam a API.
- Ícones/splash do Android: `node android-app/tools/icons.js` (gera a partir da marca do anel).

## Skills de design e escrita (`.claude/skills/`, pedido do usuário)
Cópias das skills abertas (cada pasta tem a LICENSE/NOTICE original): `impeccable` (pbakaus/impeccable, Apache-2.0: criar, criticar, auditar e polir a interface),
`ui-ux-pro-max` (nextlevelbuilder/ui-ux-pro-max-skill, MIT: busca local de estilos, paletas e regras de UX; `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`,
caminho ajustado de `${CLAUDE_PLUGIN_ROOT}` para a raiz do projeto) e `stop-slop` (hardikpandya/stop-slop, MIT: tirar o jeito de texto de IA).
A `taste-skill` foi removida (feita para landing pages, 35 MB; não serve a este app).
**As regras deste arquivo valem mais que as das skills**: identidade visual v2 (variáveis de `css/styles.css`, Geist/Bricolage), 393 px, app sem dependências,
português simples, nada de fotos/efeitos pesados. As skills não entram no site nem no APK (o `pages.yml` e o `build.py` não copiam `.claude/`).
Para atualizar: copiar de novo a pasta da skill do repositório original.
Uso: digitar `/impeccable critique …`, `/ui-ux-pro-max …`, `/stop-slop …`. Críticas da impeccable ficam em `.impeccable/` (ignorado pelo Git).

## Testes (rodar antes de todo commit)
```bash
bash tests/run.sh          # todos (Playwright + Chromium; ~3 min)
bash tests/run.sh android  # só um arquivo
```
`android-device.test.js` simula o Redmi Note 12 com Capacitor falso. Ao criar uma funcionalidade, adicione verificações.

## Fluxo de trabalho: canal de teste (pedido do usuário)
- **Nada vai para o app oficial sem aprovação do usuário.** Toda mudança nova é feita no ramo `teste` e publicada só no
  **site de teste**: https://paulojunior2303-maker.github.io/gestao-rotina/teste/
- Publicar o teste: `bash tools/publicar-teste.sh "mensagem"` (faz tudo abaixo). Manualmente: no ramo `teste`, `python3 build.py --teste` → copiar `dist/gestao-rotina-teste.html` para `teste/index.html`
  no ramo `main` (só essa pasta; não dispara o APK) e enviar. O build de teste usa outra chave no LocalStorage (`…:teste`),
  desliga o Google Drive e mostra a marca TESTE (`CANAL_TESTE` em `js/store.js`).
- Cada recurso num commit separado, para dar para aprovar só uma parte. Quando o usuário aprovar, levar os commits
  aprovados do `teste` para o `main` (merge ou cherry-pick) → isso gera o APK e atualiza o site oficial.
- Não há APK de teste (decisão do usuário: testes só pela web).

## Publicação
- **GitHub Pages**: automático a cada push em `main` → https://paulojunior2303-maker.github.io/gestao-rotina/
- **APK**: `.github/workflows/android-apk.yml` gera, assina e publica uma Release (`GestaoRotina.apk`), versão `1.1.<run>`.
  Precisa dos secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  **Nunca** versionar `*.jks`/`keystore.properties`: a mesma chave é obrigatória para atualizar sem perder dados.
- **Link do claude.ai**: republicar `dist/gestao-rotina.html` no artifact acima (ferramentas de artifact), quando disponíveis na sessão.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
