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
- **Tema claro/escuro**: use sempre as variáveis de cor de `:root` / `:root[data-theme="dark"]` em `css/styles.css`, nunca cores fixas. `tests/theme.test.js` verifica o contraste.

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
