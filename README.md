# Gestão de Rotina — Liderança Operacional (Wi-bicam · CFTV IP)

Aplicativo web de gestão pessoal: agenda por horário, planejamento semanal e mensal, tarefas,
projetos, imprevistos e indicadores. Ele funciona inteiramente no navegador, sem servidor nem internet,
e guarda os dados no **LocalStorage** do navegador.

**Versão online:** https://paulojunior2303-maker.github.io/gestao-rotina/ (GitHub Pages: abra no navegador e use “Instalar app”).

## Como executar

**Opção 1 — arquivo único (mais simples)**
Abra `dist/gestao-rotina.html` com duplo clique (Chrome, Edge, Firefox ou Safari).

**Opção 2 — código-fonte servido localmente (permite instalar como app / uso offline)**
```bash
cd gestao-rotina
python3 -m http.server 8080
```
Acesse `http://localhost:8080`. Em servidor http(s), o navegador oferece “Instalar app” (PWA).

> Os dados ficam no navegador em que você usa o app. Outro navegador ou outro aparelho começa vazio.
> Use **Configurações → Exportar backup** com frequência e **Importar backup** para levar os dados a outro lugar.

Depois de editar o código, gere de novo o arquivo único com `python3 build.py`.

**Opção 3 — link no claude.ai**
Publicado como artifact privado. Nesse modo os dados ficam na **sua conta Claude**, numa área privada só sua,
e aparecem iguais no celular e no computador. Os arquivos (Excel, backup, relatório) são baixados pela confirmação de download do app.
O relatório PDF vem como arquivo HTML: abra-o e use Imprimir → “Salvar como PDF”.

## Estrutura do código

```
index.html            Estrutura da página (menu, área de conteúdo, modais)
css/styles.css        Visual, layout responsivo e estilo de impressão (PDF)
js/utils.js           Datas, horários, formatação, ícones
js/store.js           Estado, persistência, dados de demonstração e regras de negócio
                      (rotina → agenda do dia, reorganização, prazos, cálculo de indicadores e metas)
js/ui.js              Modal, formulário genérico, confirmação, menu de ações, avisos, chips
js/cloud.js           Sincronização com a conta Claude quando aberto como link
js/charts.js          Gráficos SVG (barras, anel de progresso, barras horizontais)
js/xlsx.js            Gerador de planilha .xlsx sem dependências
js/reports.js         Exportação Excel e relatório PDF
js/views/*.js         Uma tela por arquivo (dashboard, agenda, imprevistos, semanal, mensal,
                      tarefas, projetos, indicadores, config)
js/app.js             Navegação (rotas #/...), eventos e relógio
build.py              Gera dist/gestao-rotina.html
```

Para criar uma tela nova, crie `js/views/minha-tela.js` registrando `Views.minhaTela = { title, icon, nav, render() }`,
inclua o `<script>` no `index.html` e adicione o id em `NAV` (`js/app.js`).

## Regras importantes

- **Rotina padrão × dia:** cada dia útil exibe a rotina padrão. Na primeira alteração, o dia ganha uma cópia própria.
  Depois disso, mudanças na rotina valem só para os dias ainda não alterados.
- **Reorganização:** ao deslocar uma atividade, as seguintes são empurradas na mesma ordem.
  Atividades de horário fixo (ex.: intervalo) e as já concluídas ficam no lugar.
- **Indicadores:** campo em branco é tratado como “sem dados”, nunca como zero.
  O.S. recebidas, concluídas, pontos de câmera, manutenções e retrabalhos são **somados** no período.
  O.S. pendentes e atrasadas são **posição** e mostram o último valor registrado.
- **Demonstração:** os exemplos levam a marca `[Exemplo]` e o selo EXEMPLO, e podem ser removidos sem afetar seus dados.
