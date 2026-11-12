# Testes das regras do Firestore (simulador oficial do Firebase)

Precisam de Java e de `firebase-tools`, `@firebase/rules-unit-testing` e `firebase` (npm). Não fazem parte do `tests/run.sh`.

```bash
cd tests/regras
npm i --no-save firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-flowfire "node regras.test.mjs && node fluxo.test.mjs"
```

- `regras.test.mjs`: quem pode ler/gravar o quê (dados pessoais, equipe, membros, pacotes de missões).
- `fluxo.test.mjs`: as mesmas chamadas que `js/equipes.js` faz, do início ao fim, com as regras reais.
