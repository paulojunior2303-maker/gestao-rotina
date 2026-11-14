#!/usr/bin/env bash
# Roda todos os testes automatizados (Playwright + Chromium) a partir da raiz do repositório.
# Uso: bash tests/run.sh            (todos)
#      bash tests/run.sh web        (só os arquivos cujo nome contém "web")
set -u
cd "$(dirname "$0")/.."
PORT=8765
python3 build.py >/dev/null && python3 build.py --teste >/dev/null && python3 build.py --enxuto >/dev/null
mkdir -p android-app/www && cp dist/gestao-rotina.html android-app/www/index.html
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!
sleep 1
status=0
# Os arquivos rodam em paralelo (até 4 de cada vez) para a bateria terminar mais rápido
TMP=$(mktemp -d); trap 'kill $SRV 2>/dev/null; rm -rf "$TMP"' EXIT
files=()
for t in tests/*.test.js; do
  [[ -n "${1:-}" && "$t" != *"$1"* ]] && continue
  files+=("$t")
  ( node "$t" >"$TMP/$(basename "$t").out" 2>&1; echo $? >"$TMP/$(basename "$t").code" ) &
  while (( $(jobs -rp | wc -l) > 4 )); do sleep 0.3; done   # 4 testes + o servidor
done
wait $(jobs -rp | grep -v "^$SRV$") 2>/dev/null
for t in "${files[@]}"; do
  out=$(cat "$TMP/$(basename "$t").out"); code=$(cat "$TMP/$(basename "$t").code")
  oks=$(grep -c '^ *ok -' <<<"$out")
  if [[ $code -ne 0 ]] || grep -qE 'XX -|FALHOU|ERRO|[1-9][0-9]* falhas' <<<"$out"; then
    echo "FALHOU  $t ($oks ok)"; grep -E 'XX -|FALHOU|ERRO|falhas' <<<"$out" | head -10; status=1
  else
    echo "ok      $t ($oks verificações)"
  fi
done
exit $status
