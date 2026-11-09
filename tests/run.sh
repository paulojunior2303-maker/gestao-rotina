#!/usr/bin/env bash
# Roda todos os testes automatizados (Playwright + Chromium) a partir da raiz do repositório.
# Uso: bash tests/run.sh            (todos)
#      bash tests/run.sh web        (só os arquivos cujo nome contém "web")
set -u
cd "$(dirname "$0")/.."
PORT=8765
python3 build.py >/dev/null
mkdir -p android-app/www && cp dist/gestao-rotina.html android-app/www/index.html
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
status=0
for t in tests/*.test.js; do
  [[ -n "${1:-}" && "$t" != *"$1"* ]] && continue
  out=$(node "$t" 2>&1); code=$?
  oks=$(grep -c '^ *ok -' <<<"$out")
  if [[ $code -ne 0 ]] || grep -qE 'XX -|FALHOU|ERRO|[1-9][0-9]* falhas' <<<"$out"; then
    echo "FALHOU  $t ($oks ok)"; grep -E 'XX -|FALHOU|ERRO|falhas' <<<"$out" | head -10; status=1
  else
    echo "ok      $t ($oks verificações)"
  fi
done
exit $status
