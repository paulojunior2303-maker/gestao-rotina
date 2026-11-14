#!/usr/bin/env bash
# Publica a cópia enxuta (/enxuto/) num passo só: build --enxuto e envio de enxuto/index.html para o main
# (só essa pasta muda no main, então o APK não é gerado). Rodar no ramo enxuto.
# Uso: bash tools/publicar-enxuto.sh "Mensagem do commit"
set -euo pipefail
cd "$(dirname "$0")/.."
python3 build.py --enxuto >/dev/null
git fetch -q origin main
wt=$(mktemp -d)
git worktree add -q --detach "$wt" origin/main
mkdir -p "$wt/enxuto"
cp dist/gestao-rotina-enxuto.html "$wt/enxuto/index.html"
(
  cd "$wt"
  # o site precisa copiar a pasta enxuto/ (uma vez só)
  if ! grep -q "enxuto" .github/workflows/pages.yml; then
    sed -i 's#          if \[ -d teste \]; then cp -r teste _site/; fi#          if [ -d teste ]; then cp -r teste _site/; fi\n          if [ -d enxuto ]; then cp -r enxuto _site/; fi#' .github/workflows/pages.yml
    sed -i 's#^\# Publica o site (GitHub Pages) a cada mudança no main: app oficial na raiz e o site de teste em /teste/.#\# Publica o site (GitHub Pages) a cada mudança no main: app oficial na raiz, site de teste em /teste/ e cópia enxuta em /enxuto/.#' .github/workflows/pages.yml
  fi
  git add enxuto/index.html .github/workflows/pages.yml
  if git diff --cached --quiet; then echo "Nada mudou na cópia enxuta."; exit 0; fi
  git commit -q -m "${1:-Cópia enxuta atualizada}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jb4fcf3XjAw1MmFGEMHmyn"
  git push -q origin HEAD:main
  echo "Cópia enxuta enviada: $(git rev-parse --short HEAD)"
)
git worktree remove --force "$wt"
