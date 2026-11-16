#!/usr/bin/env bash
# Hook SessionStart: gera/atualiza o mapa do graphify (só código, local, sem custo de API).
# Nunca falha a sessão: sem graphify ou sem rede, apenas segue sem mapa.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! command -v graphify >/dev/null 2>&1; then
  python3 -m pip install -q graphifyy >/dev/null 2>&1 || pip install -q graphifyy >/dev/null 2>&1 || exit 0
fi
command -v graphify >/dev/null 2>&1 || exit 0
if [ -f graphify-out/graph.json ]; then
  graphify update . >/dev/null 2>&1
else
  graphify extract . --code-only >/dev/null 2>&1 && graphify cluster-only . >/dev/null 2>&1
fi
[ -f graphify-out/graph.json ] && echo "Mapa do graphify pronto em graphify-out/ (use graphify query)."
exit 0
