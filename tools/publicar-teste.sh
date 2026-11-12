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
(
  cd "$wt"
  git add teste/index.html
  if git diff --cached --quiet; then echo "Nada mudou no site de teste."; exit 0; fi
  git commit -q -m "${1:-Site de teste atualizado}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jb4fcepCHXkURu54pDv8Zs"
  git push -q origin HEAD:main
  echo "Site de teste enviado: $(git rev-parse --short HEAD)"
)
git worktree remove --force "$wt"
