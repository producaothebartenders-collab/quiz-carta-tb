# Quiz Criação de Drinks

Treino das famílias de coquetéis da planilha CRIACAO_DRINKS (aba COQUETÉIS CLÁSSICOS): receita com doses, copo/taça, método de preparo e guarnição.

Publicado como subpasta: https://producaothebartenders-collab.github.io/quiz-carta-tb/criacao-de-drinks/

- `drinks.json` — 59 drinks, agrupados por família (Sours, Tiki, Collins, Spritz, Spirit Forward, Milanese, Especiais, Outros).
- `users.json` — mesma lista de acesso do quiz principal (nome + CPF).
- `config.js` — `window.RANKING_API_URL` deste quiz (vazio = ranking escondido).
- Sessão em `sessionStorage` com a chave `tb-quiz-criacao-drinks` (não mistura com os outros quizzes).

Rodar localmente: `python3 -m http.server 8766` nesta pasta e abrir http://127.0.0.1:8766
