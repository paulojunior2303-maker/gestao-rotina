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
- **Indicadores fica oculto** por padrão (`settings.showIndicadores`, chave em Configurações → Aparência). Oculto também esconde Metas e o card de metas do Dashboard.
- **Navegação só pelo menu lateral** (☰ ou arrastar da borda esquerda). A barra inferior foi removida a pedido do usuário: não recriar.
- **Agenda unificada** (`js/views/agenda.js`): abas Dia (cronograma + faixa da semana `Cal.strip`), Semana (`WeekPlan`, em `semanal.js`: foco/checklist + compromissos e prazos de cada dia)
  e Mês (`MonthPlan`, em `mensal.js`: calendário + metas das 4 semanas, que começam em branco). `#semanal`/`#mensal` antigos redirecionam para a Agenda.
- **Calendário** (`js/calendar.js`, `Cal`) é o recurso principal: no Início e em Agenda → Mês. Mês/semana, bolinhas no celular e títulos no computador,
  lista do dia escolhido, arrastar para trocar de mês, "Hoje", "+ Novo" (reunião, compromisso, tarefa, atividade). Reuniões têm cor própria (`--t-reuniao`).
- **Intervalo de almoço**: `settings.breakMode` = flexivel (padrão; botão "Intervalo agora" na Agenda, empurra o resto) | fixo (bloco da rotina) | nenhum.
- **Feedbacks** (`js/views/feedbacks.js`, `S.feedbacks`): por colaborador, gravação ao vivo, `IA.feedback` (/feedback do agente), acordos → tarefas com responsável.
  Peças reaproveitáveis de IA/gravação em `IAUI` (`js/ia.js`).
- `Store.migrateV2` (marca `meta.v2`) limpou o modelo antigo do planejamento, trocou a paleta e passou o tema para escuro uma única vez. Não remover.
- **Lembretes** (`js/lembretes.js`, `Reminders`): calculados de novo a cada gravação (`Store.save`). Android: `@capacitor/local-notifications`
  (botões Feito/Ciente; até 60 agendados); navegador: só com o site aberto. Plugin próprio `SistemaPlugin.java` abre bateria/inicialização automática (Xiaomi).
- **Google Drive** (`js/drive.js`, `Drive`): arquivo `gestao-rotina-dados.json` na pasta "Gestão de Rotina" do Drive do usuário (escopo `drive.file`).
  Vale a versão com `meta.updatedAt` mais novo (`Store.save` marca o horário; dados vindos de fora usam `touch: false`). Sincroniza ao abrir/voltar e ~2,5 s após cada alteração.
  Android: `GooglePlugin.java` (AuthorizationClient do play-services-auth; cliente OAuth Android = pacote + SHA-1 da chave de release).
  Site: Google Identity Services com o cliente Web (token ~1 h em sessionStorage; depois aparece "Sincronizar"). Projeto Google Cloud do usuário.
  `tests/drive.test.js` simula a API do Drive. A conexão (e-mail, ids) fica em `localStorage['gr-drive']`, por aparelho.
- **Aviso de versão nova** (`Updater`): o APK compara `App.getInfo().version` com a última Release do GitHub.
- **Reuniões** (`js/views/reunioes.js`, menu Dia a dia; dá para iniciar antes do horário): são `S.events` com `reuniao: true` e/ou `pautas`; `registro` = tratadas + combinados + resumo.
  Combinados podem virar tarefas. Formulário/visualização/registro em `Events` (`js/views/mensal.js`).
- **IA** (`js/ia.js`): Google Gemini direto do app, com a chave do usuário em `settings.ia.key` (Configurações → IA). Modelos em `IA.MODELS`
  (tenta o próximo em 503/429/timeout). `Recorder` grava em trechos independentes de 40 s (webm/opus 24 kbps, até 90 min) e transcreve cada um ao vivo (`IA.transcribe`); ao encerrar, `IA.ata` usa a transcrição em texto. O áudio não é guardado; a transcrição vai em `registro.transcricao` (até 30 mil caracteres). Durante a gravação a janela não fecha (`canClose`). Indisponível no link do Claude.
  Ata no padrão do **agente do usuário** (`settings.ia.agente`, colado em Configurações → IA; nível em `settings.ia.nivel`) via `IA.system()`;
  `IA.rewrite` = comandos /natural, /compact, /detalhado; `IA.pauta` gera a pauta (com pendências de `Events.pendencias`). `IA.tidy` garante quebras de linha.
  **Nunca** colocar chave real nem o prompt do agente do usuário em código, teste ou commit (repositório público): os testes simulam a API.
- Ícones/splash do Android: `node android-app/tools/icons.js` (gera a partir da marca do anel).

## Testes (rodar antes de todo commit)
```bash
bash tests/run.sh          # todos (Playwright + Chromium; ~3 min)
bash tests/run.sh android  # só um arquivo
```
`android-device.test.js` simula o Redmi Note 12 com Capacitor falso. Ao criar uma funcionalidade, adicione verificações.

## Fluxo de trabalho: canal de teste (pedido do usuário)
- **Nada vai para o app oficial sem aprovação do usuário.** Toda mudança nova é feita no ramo `teste` e publicada só no
  **site de teste**: https://paulojunior2303-maker.github.io/gestao-rotina/teste/
- Publicar o teste: no ramo `teste`, `python3 build.py --teste` → copiar `dist/gestao-rotina-teste.html` para `teste/index.html`
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
