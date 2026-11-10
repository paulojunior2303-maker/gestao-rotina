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
- **Planejamento semanal e mensal começam em branco** (o usuário monta). Explicação detalhada no Guia de uso (`#g-semanal`, `#g-mensal`; botão “Como funciona” usa `guideOpen`).
- `Store.migrateV2` (marca `meta.v2`) limpou o modelo antigo do planejamento, trocou a paleta e passou o tema para escuro uma única vez. Não remover.
- **Lembretes** (`js/lembretes.js`, `Reminders`): calculados de novo a cada gravação (`Store.save`). Android: `@capacitor/local-notifications`
  (botões Feito/Ciente; até 60 agendados); navegador: só com o site aberto. Plugin próprio `SistemaPlugin.java` abre bateria/inicialização automática (Xiaomi).
- **Aviso de versão nova** (`Updater`): o APK compara `App.getInfo().version` com a última Release do GitHub.
- **Reuniões** (`js/views/reunioes.js`, menu Dia a dia): são `S.events` com `reuniao: true` e/ou `pautas`; `registro` = tratadas + combinados + resumo.
  Combinados podem virar tarefas. Formulário/visualização/registro em `Events` (`js/views/mensal.js`).
- **IA** (`js/ia.js`): Google Gemini direto do app, com a chave do usuário em `settings.ia.key` (Configurações → IA). Modelos em `IA.MODELS`
  (tenta o próximo em 503/429/timeout). `Recorder` grava o áudio (webm/opus 24 kbps, até 60 min; não é guardado). Indisponível no link do Claude.
  **Nunca** colocar chave real em código, teste ou commit (repositório público): os testes simulam a API.
- Ícones/splash do Android: `node android-app/tools/icons.js` (gera a partir da marca do anel).

## Testes (rodar antes de todo commit)
```bash
bash tests/run.sh          # todos (Playwright + Chromium; ~3 min)
bash tests/run.sh android  # só um arquivo
```
`android-device.test.js` simula o Redmi Note 12 com Capacitor falso. Ao criar uma funcionalidade, adicione verificações.

## Publicação
- **GitHub Pages**: automático a cada push em `main` → https://paulojunior2303-maker.github.io/gestao-rotina/
- **APK**: `.github/workflows/android-apk.yml` gera, assina e publica uma Release (`GestaoRotina.apk`), versão `1.1.<run>`.
  Precisa dos secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  **Nunca** versionar `*.jks`/`keystore.properties`: a mesma chave é obrigatória para atualizar sem perder dados.
- **Link do claude.ai**: republicar `dist/gestao-rotina.html` no artifact acima (ferramentas de artifact), quando disponíveis na sessão.
