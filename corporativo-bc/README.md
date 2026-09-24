# Quiz Corporativo Balneário Camboriú

Versão do quiz de drinks só com o cardápio do evento Corporativo Balneário Camboriú (9 drinks).
Publicado como subpasta do repositório: https://producaothebartenders-collab.github.io/quiz-carta-tb/corporativo-bc/

- `drinks.json` — os 9 drinks (receita com faixas "3 a 4", unidades PEDAÇOS/CONCHAS/COLHERES, COMPLETAR, "a mistura contém").
- `users.json` — os 28 participantes (só nomes; login sem CPF).
- `config.js` — `window.RANKING_API_URL` do Apps Script **deste evento** (vazio = ranking escondido; o quiz funciona igual).
- Sessão guardada em `sessionStorage` com a chave `tb-quiz-corporativo-bc:user` (não mistura com o quiz principal).

Rodar localmente: `python3 -m http.server 8765` nesta pasta e abrir http://127.0.0.1:8765
