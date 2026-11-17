#!/usr/bin/env bash
# Publica o site de teste (/teste/) num passo só: build --teste e envio de teste/index.html para o main
# (só essa pasta muda no main, então o APK não é gerado). Rodar no ramo teste.
# Uso: bash tools/publicar-teste.sh "Mensagem do commit"
set -euo pipefail
cd "$(dirname "$0")/.."
python3 build.py --teste >/dev/null
git fetch -q origin main
wt=$(mktemp -d)
git worktree add -q --detach "$wt" origin/main
cp dist/gestao-rotina-teste.html "$wt/teste/index.html"
cp icon-180.png "$wt/teste/icon-180.png"   # ícone do iPhone (Adicionar à Tela de Início)
(
  cd "$wt"
  git add teste/index.html teste/icon-180.png
  if git diff --cached --quiet; then echo "Nada mudou no site de teste."; exit 0; fi
  git commit -q -m "${1:-Site de teste atualizado}

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jb4fcfohob92MitdZgDnCs"
  git push -q origin HEAD:main
  echo "Site de teste enviado: $(git rev-parse --short HEAD)"
)
git worktree remove --force "$wt"
