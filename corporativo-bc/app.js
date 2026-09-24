(() => {
  const PTS = 10;

  const els = {
    login: document.getElementById("screen-login"),
    start: document.getElementById("screen-start"),
    select: document.getElementById("screen-select"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result"),
    loginFilter: document.getElementById("login-filter"),
    loginName: document.getElementById("login-name"),
    loginError: document.getElementById("login-error"),
    btnLogin: document.getElementById("btn-login"),
    btnLogout: document.getElementById("btn-logout"),
    userChip: document.getElementById("user-chip"),
    drinkCount: document.getElementById("drink-count"),
    drinkList: document.getElementById("drink-list"),
    drinkSearch: document.getElementById("drink-search"),
    drinkEmpty: document.getElementById("drink-empty"),
    selectCount: document.getElementById("select-count"),
    btnStart: document.getElementById("btn-start"),
    btnSelectAll: document.getElementById("btn-select-all"),
    btnSelectNone: document.getElementById("btn-select-none"),
    btnPlay: document.getElementById("btn-play"),
    btnBackStart: document.getElementById("btn-back-start"),
    btnNext: document.getElementById("btn-next"),
    btnReplay: document.getElementById("btn-replay"),
    btnHome: document.getElementById("btn-home"),
    progress: document.getElementById("progress-bar"),
    counter: document.getElementById("q-counter"),
    liveScore: document.getElementById("live-score"),
    qType: document.getElementById("q-type"),
    qText: document.getElementById("q-text"),
    options: document.getElementById("options"),
    btnConfirm: document.getElementById("btn-confirm"),
    multiHint: document.getElementById("multi-hint"),
    feedback: document.getElementById("feedback"),
    feedbackTitle: document.getElementById("feedback-title"),
    feedbackBody: document.getElementById("feedback-body"),
    finalScore: document.getElementById("final-score"),
    resultTitle: document.getElementById("result-title"),
    resultDetail: document.getElementById("result-detail"),
    ranking: document.getElementById("screen-ranking"),
    btnRankingStart: document.getElementById("btn-ranking-start"),
    btnRankingResult: document.getElementById("btn-ranking-result"),
    btnRankingBack: document.getElementById("btn-ranking-back"),
    btnRankingRetry: document.getElementById("btn-ranking-retry"),
    rankingStatus: document.getElementById("ranking-status"),
    rankingTableWrap: document.getElementById("ranking-table-wrap"),
    rankingBody: document.getElementById("ranking-body"),
    rankingUpdated: document.getElementById("ranking-updated"),
    saveStatus: document.getElementById("save-status"),
  };

  // URL do App da Web (Apps Script) definida em config.js. Vazia = ranking desligado.
  const RANKING_API_URL = String(window.RANKING_API_URL || "").trim();
  // Identificador deste evento (vai junto com o resultado; o backend confere).
  const EVENTO = "corporativo-bc";
  const RANKING_TIMEOUT_MS = 20000;

  let drinks = [];
  let authUsers = [];
  let currentUser = null;
  let selectedNames = new Set();
  let questions = [];
  let index = 0;
  let score = 0;
  let answered = false;
  let playedDrinks = [];
  let resultSaved = false;
  let rankingReturnScreen = null;
  // Chave própria deste quiz: não compartilha sessão com o quiz principal (mesmo domínio).
  const STORAGE_NS = "tb-quiz-corporativo-bc:";
  const AUTH_KEY = STORAGE_NS + "user";

  function show(screen) {
    [els.login, els.start, els.select, els.quiz, els.result, els.ranking].forEach((s) => {
      if (s) s.classList.remove("active");
    });
    screen.classList.add("active");
  }

  function renderLoginNames(filter = "") {
    const q = searchKey(filter);
    const list = authUsers.filter((u) => !q || searchKey(u.name).includes(q));
    const prev = els.loginName.value;
    els.loginName.innerHTML = "";
    if (!list.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nenhum nome encontrado";
      els.loginName.appendChild(opt);
      return;
    }
    list.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.name;
      opt.textContent = u.name;
      els.loginName.appendChild(opt);
    });
    if (prev && list.some((u) => u.name === prev)) els.loginName.value = prev;
  }

  function setLoggedIn(user) {
    currentUser = user;
    if (user) {
      sessionStorage.setItem(AUTH_KEY, user.name);
      if (els.userChip) {
        els.userChip.textContent = `Olá, ${user.name.split(" ")[0]}`;
        els.userChip.classList.remove("hidden");
      }
    } else {
      sessionStorage.removeItem(AUTH_KEY);
      if (els.userChip) els.userChip.classList.add("hidden");
    }
  }

  function requireAuth() {
    if (currentUser) return true;
    show(els.login);
    return false;
  }

  function tryLogin() {
    els.loginError.classList.add("hidden");
    const name = (els.loginName.value || "").trim();
    if (!name) {
      els.loginError.textContent = "Selecione seu nome na lista.";
      els.loginError.classList.remove("hidden");
      return;
    }
    const user = authUsers.find((u) => u.name === name);
    if (!user) {
      els.loginError.textContent = "Nome não autorizado.";
      els.loginError.classList.remove("hidden");
      return;
    }
    setLoggedIn(user);
    show(els.start);
  }

  function logout() {
    setLoggedIn(null);
    if (els.loginFilter) els.loginFilter.value = "";
    renderLoginNames("");
    show(els.login);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n) {
    return shuffle(arr).slice(0, Math.max(0, n));
  }

  function unique(values) {
    const seen = new Set();
    const out = [];
    for (const v of values) {
      const s = (v || "").toString().trim();
      if (!s) continue;
      const key = s.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  function distractors(pool, correct, n = 3) {
    const correctKey = (correct || "").toString().trim().toUpperCase();
    const candidates = unique(pool).filter((v) => v.toUpperCase() !== correctKey);
    return pick(candidates, n);
  }

  function ingredientNames(drink) {
    return (drink.ingredients || []).map((i) => i.name).filter(Boolean);
  }

  function focusDrinks() {
    return drinks.filter((d) => selectedNames.has(d.name));
  }

  function updateSelectUI() {
    const n = selectedNames.size;
    const qCount = n * 4;
    els.selectCount.textContent =
      n === 1 ? "1 selecionado · 4 perguntas" : `${n} selecionados · ${qCount} perguntas`;
    els.btnPlay.disabled = n < 1;
    els.btnPlay.textContent =
      n < 1
        ? "Selecione ao menos 1 drink"
        : n === 1
          ? "Começar quiz (1 drink · 4 perguntas)"
          : `Começar quiz (${n} drinks · ${qCount} perguntas)`;
  }

  function renderDrinkList() {
    els.drinkList.innerHTML = "";
    const sorted = [...drinks].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    sorted.forEach((drink) => {
      const label = document.createElement("label");
      label.className = "drink-item";
      label.dataset.search = searchKey(drink.name);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedNames.has(drink.name);
      cb.addEventListener("change", () => {
        if (cb.checked) selectedNames.add(drink.name);
        else selectedNames.delete(drink.name);
        updateSelectUI();
      });
      const text = document.createElement("span");
      const name = document.createElement("span");
      name.className = "drink-name";
      name.textContent = drink.name;
      text.appendChild(name);
      if (drink.alcohol_free) {
        const tag = document.createElement("span");
        tag.className = "drink-tag";
        tag.textContent = "sem álcool";
        text.appendChild(tag);
      }
      label.appendChild(cb);
      label.appendChild(text);
      els.drinkList.appendChild(label);
    });
    applyDrinkFilter();
    updateSelectUI();
  }

  function searchKey(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyDrinkFilter() {
    const q = searchKey(els.drinkSearch ? els.drinkSearch.value : "");
    let visible = 0;
    els.drinkList.querySelectorAll(".drink-item").forEach((item) => {
      const match = !q || item.dataset.search.includes(q);
      item.hidden = !match;
      if (match) visible++;
    });
    if (els.drinkEmpty) els.drinkEmpty.hidden = visible > 0;
  }

  if (els.drinkSearch) {
    els.drinkSearch.addEventListener("input", applyDrinkFilter);
  }

  function openSelect() {
    if (!requireAuth()) return;
    if (els.drinkSearch) els.drinkSearch.value = "";
    if (!selectedNames.size) drinks.forEach((d) => selectedNames.add(d.name));
    renderDrinkList();
    show(els.select);
  }

  /* ---------- Textos (artigo do drink: "da Caipirinha", "do Negroni") ---------- */

  function art(drink) {
    return drink && drink.artigo === "a" ? "a" : "o";
  }
  function de(drink) {
    return art(drink) === "a" ? "da" : "do";
  }
  function capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function ingredientUnit(ing) {
    return ((ing && ing.unit) || "").toString().trim().split("\n")[0].trim();
  }

  function ingredientLine(ing) {
    if (!ing || !ing.name) return "";
    const qty = (ing.qty || "").toString().trim();
    const unit = ingredientUnit(ing);
    if (qty && unit) return `${ing.name} — ${qty} ${unit}`;
    if (qty) return `${ing.name} — ${qty}`;
    return ing.name;
  }

  function formatRecipe(drink) {
    return (drink.ingredients || [])
      .map(ingredientLine)
      .filter(Boolean)
      .join(" · ");
  }

  /** Informações extras da ficha (mistura, paladar, gelo, canudo) para o feedback. */
  function drinkNotes(drink, opts = {}) {
    const lines = [];
    if (drink.mistura) lines.push(`A mistura contém: ${drink.mistura}.`);
    if (opts.paladar && drink.paladar) lines.push(`Paladar: ${drink.paladar}.`);
    if (drink.gelo) lines.push(`Gelo: ${drink.gelo}.`);
    if (opts.canudo && drink.canudo) lines.push(`Canudo: ${drink.canudo}.`);
    return lines;
  }

  function isBlendName(name) {
    const n = (name || "").toUpperCase().trim();
    // "MISTURA" e "BLEND" são preparos próprios de cada drink: nunca viram opção falsa.
    return n.includes("BLEND") || n === "MISTURA" || n.startsWith("MISTURA ");
  }

  /** Skip meta / instruction lines — never use as distractors. */
  function isMetaIngredient(name) {
    const n = (name || "").toUpperCase();
    return n.includes("USAR ") || n.includes("PREPARO DO BLEND");
  }

  /** Rough family so distractors feel related (spirit vs juice vs syrup…). */
  function ingredientFamily(name) {
    const n = (name || "").toUpperCase();
    if (isBlendName(n)) return "blend";
    if (isMetaIngredient(n)) return "meta";
    if (/ESPUMA|FOAM|CLARA|OVO/.test(n)) return "egg_foam";
    if (/LICOR|FRANGELICO|AMARETTO|TRIPLE|CURA[CÇ][AÃ]O|KAHLUA|BAILEYS|CREME DE|LIMONCELLO/.test(n))
      return "liqueur";
    if (/WHISKEY|WHISKY|VODKA|GIN\b|RUM\b|CACHA[CÇ]A|TEQUILA|MEZCAL|BRANDY|COGNAC|PISCO/.test(n)) return "base";
    if (/VINHO|ESPUMANTE|CHAMPAGNE|PROSECCO|CERVEJA/.test(n)) return "wine";
    if (/APEROL|CAMPARI|CYNAR|FERNET|AMARO|VERMOUTH|MARTINI|LILLET/.test(n)) return "bitter_aperitif";
    if (/SUCO|LIM[AÃ]O|LARANJA|ABACAXI|MARACUJ[AÁ]|MORANGO|UVA|TANGERINA|MANGA/.test(n)) return "juice";
    if (/SYRUP|XAROPE|A[CÇ][UÚ]CAR|MEL\b|HONEY|SIMPLE/.test(n)) return "sweet";
    if (/BITTER|ANGOSTURA/.test(n)) return "bitter";
    if (/SODA|T[OÔ]NICA|GINGER|ÁGUA|AGUA|REFRIGERANTE/.test(n)) return "soda";
    if (/HORTEL[AÃ]|MANJERIC[AÃ]O|FOLHAS|ALECRIM|GENGIBRE|PIMENTA|CANELA/.test(n)) return "herb";
    return "other";
  }

  /**
   * Pares que não podem aparecer como "falso" um para o outro (seria pegadinha injusta):
   * a caipirinha leva VODKA/CACHAÇA, então VODKA (ABSOLUT) como opção falsa confundiria.
   */
  const CONFLICTS = [["VODKA/CACHAÇA", "VODKA (ABSOLUT)"]];
  function conflictsWith(a, b) {
    const A = a.toUpperCase();
    const B = b.toUpperCase();
    return CONFLICTS.some(([x, y]) => (x === A && y === B) || (x === B && y === A));
  }

  /** Distratores genéricos: só usados se o cardápio não tiver opções suficientes. */
  const GENERIC_INGREDIENTS = [
    { name: "XAROPE DE AÇÚCAR", unit: "ML" },
    { name: "SUCO DE LARANJA", unit: "ML" },
    { name: "HORTELÃ", unit: "FOLHAS" },
    { name: "GINGER ALE", unit: "" },
    { name: "TEQUILA", unit: "ML" },
  ];
  const GENERIC_CHOICES = {
    copo: ["TAÇA COUPÉ", "COPO LONG DRINK 300 ML", "TAÇA MARTINI"],
    preparo: ["MEXIDO NO MIXING GLASS E COADO", "BATIDO E COADO (COAGEM DUPLA)", "MONTADO NO COPO SEM GELO"],
    guarnicao: ["RODELA DE LIMÃO", "FOLHAS DE HORTELÃ", "CEREJA"],
  };

  function stripAccents(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const UNIT_WORDS = /\s*(ML|MLS|PEDACOS?|CONCHAS?|COLHERES|COLHER|DASH(ES)?|GOTAS?|FOLHAS?)\.?$/;

  /**
   * Normaliza a quantidade digitada:
   *  "70" / "70 ml" / "70,0" → "70"
   *  "3 a 4" / "3-4" / "3 até 4" / "4 a 3" → "3 A 4"
   *  "completar" / "complete" / "COMP" → "COMPLETAR"
   */
  function normalizeQty(raw) {
    let s = stripAccents(raw).toUpperCase().replace(/,/g, ".").replace(/\s+/g, " ").trim();
    if (!s) return "";
    if (/^COMP/.test(s)) return "COMPLETAR";
    s = s.replace(UNIT_WORDS, "").trim();
    const num = /^\d+(\.\d+)?$/;
    if (num.test(s)) return String(Number(s));
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:A|-|–|—|ATE|OU|E)\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a === b) return String(a);
      return `${Math.min(a, b)} A ${Math.max(a, b)}`;
    }
    return s;
  }

  function qtyMatches(userQty, expectedQty) {
    const a = normalizeQty(userQty);
    const b = normalizeQty(expectedQty);
    if (!b) return !a; // nothing expected → empty ok
    return a === b;
  }

  function catalogIngredients(allPool) {
    const byName = new Map();
    for (const d of allPool) {
      for (const ing of d.ingredients || []) {
        const name = (ing.name || "").trim();
        if (!name) continue;
        const key = name.toUpperCase();
        if (!byName.has(key)) {
          byName.set(key, {
            name,
            unit: ingredientUnit(ing),
            family: ingredientFamily(name),
            blend: isBlendName(name),
            meta: isMetaIngredient(name),
          });
        }
      }
    }
    return byName;
  }

  /**
   * Multi-select by ingredient name + qty field.
   * False options: other ingredients of the event menu (related families first),
   * never another drink's blend/mistura; generic ones only if the menu runs short.
   */
  function buildIngredientQuestion(drink, allPool) {
    const correctIngs = [];
    const seen = new Set();
    for (const ing of drink.ingredients || []) {
      const name = (ing.name || "").trim();
      if (!name) continue;
      const key = name.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      correctIngs.push({ name, qty: (ing.qty || "").toString().trim(), unit: ingredientUnit(ing) });
    }
    if (correctIngs.length < 1) return null;

    const correctKeys = new Set(correctIngs.map((i) => i.name.toUpperCase()));
    const drinkFamilies = new Set(correctIngs.map((i) => ingredientFamily(i.name)));
    const related = new Set(drinkFamilies);
    if (drinkFamilies.has("base")) {
      related.add("liqueur");
      related.add("bitter_aperitif");
    }
    if (drinkFamilies.has("juice")) related.add("sweet");
    if (drinkFamilies.has("sweet")) related.add("juice");
    if (drinkFamilies.has("wine")) related.add("base");
    if (drinkFamilies.has("soda")) related.add("juice");
    if (drinkFamilies.has("bitter_aperitif")) related.add("wine");
    if (drink.alcohol_free) ["juice", "soda", "sweet", "egg_foam"].forEach((f) => related.add(f));

    const usable = (name) =>
      !correctKeys.has(name.toUpperCase()) &&
      !correctIngs.some((c) => conflictsWith(c.name, name));

    const catalog = [...catalogIngredients(allPool).values()].filter(
      (i) => !i.blend && !i.meta && usable(i.name)
    );
    const sameFamily = catalog.filter((i) => drinkFamilies.has(i.family));
    const nearFamily = catalog.filter((i) => !drinkFamilies.has(i.family) && related.has(i.family));
    const others = catalog.filter((i) => !drinkFamilies.has(i.family) && !related.has(i.family));
    const generic = GENERIC_INGREDIENTS.filter(
      (g) => usable(g.name) && !catalog.some((c) => c.name.toUpperCase() === g.name.toUpperCase())
    );
    const ranked = [...shuffle(sameFamily), ...shuffle(nearFamily), ...shuffle(others), ...shuffle(generic)];

    const fakeCount = Math.min(ranked.length, Math.max(3, Math.min(5, correctIngs.length)));
    if (fakeCount < 2) return null;

    const falseIngs = ranked.slice(0, fakeCount).map((i) => ({ name: i.name, qty: "", unit: i.unit, fake: true }));
    const options = shuffle([...correctIngs.map((i) => ({ ...i, fake: false })), ...falseIngs]);

    const explain = [`Receita ${de(drink)} ${drink.name}: ${formatRecipe(drink)}.`, ...drinkNotes(drink, { paladar: true, canudo: true })];

    return {
      mode: "multi",
      typeLabel: `${drink.name} · Receita`,
      prompt: `Qual a receita ${de(drink)} ${drink.name}? Marque os ingredientes certos e digite a quantidade de cada um.`,
      correct: correctIngs.map((i) => i.name),
      correctQty: Object.fromEntries(correctIngs.map((i) => [i.name.toUpperCase(), i.qty])),
      options,
      explain: explain.join("\n"),
    };
  }

  function buildChoiceQuestion(drink, kind, allPool) {
    const field = kind === "copo" ? "copo" : kind === "preparo" ? "preparo" : "guarnicao";
    const correct = (drink[field] || "").toString().trim();
    if (!correct) return null;

    const pool = allPool.map((d) => d[field]);
    let wrong = distractors(pool, correct);
    if (wrong.length < 3) {
      const taken = new Set([correct, ...wrong].map((v) => v.toUpperCase()));
      const extra = distractors((GENERIC_CHOICES[field] || []).filter((g) => !taken.has(g.toUpperCase())), correct, 3 - wrong.length);
      wrong = [...wrong, ...extra];
    }
    if (wrong.length < 3) return null;

    const nome = drink.name;
    if (kind === "copo") {
      return {
        typeLabel: `${nome} · Copo / Taça`,
        prompt: `Em qual copo/taça é servid${art(drink)} ${art(drink)} ${nome}?`,
        correct,
        options: shuffle([correct, ...wrong]),
        explain: `${capFirst(art(drink))} ${nome} vai em ${correct}.`,
        kind,
      };
    }
    if (kind === "preparo") {
      const notes = drink.gelo ? [`Gelo: ${drink.gelo}.`] : [];
      return {
        typeLabel: `${nome} · Preparo`,
        prompt: `Qual o método de preparo ${de(drink)} ${nome}?`,
        correct,
        options: shuffle([correct, ...wrong]),
        explain: [`Preparo ${de(drink)} ${nome}: ${correct}.`, ...notes].join("\n"),
        kind,
      };
    }
    return {
      typeLabel: `${nome} · Guarnição`,
      prompt: `Qual a guarnição ${de(drink)} ${nome}?`,
      correct,
      options: shuffle([correct, ...wrong]),
      explain: `Guarnição ${de(drink)} ${nome}: ${correct}.`,
      kind,
    };
  }

  /** Exactly 4 questions per selected drink: receita → copo → preparo → guarnição */
  function buildQuestions(focusPool, allPool) {
    const qs = [];
    const ordered = shuffle(focusPool.filter((d) => d.name));

    ordered.forEach((drink) => {
      const qIng = buildIngredientQuestion(drink, allPool);
      const qCopo = buildChoiceQuestion(drink, "copo", allPool);
      const qPreparo = buildChoiceQuestion(drink, "preparo", allPool);
      const qGuarn = buildChoiceQuestion(drink, "guarnicao", allPool);
      if (qIng) qs.push(qIng);
      if (qCopo) qs.push(qCopo);
      if (qPreparo) qs.push(qPreparo);
      if (qGuarn) qs.push(qGuarn);
    });

    return qs;
  }

  function startGame() {
    const focus = focusDrinks();
    if (!focus.length) {
      alert("Selecione ao menos um drink.");
      return;
    }
    questions = buildQuestions(focus, drinks);
    if (!questions.length) {
      alert("Não foi possível montar perguntas com os drinks selecionados.");
      return;
    }
    playedDrinks = [...new Set(focus.map((d) => d.name))];
    resultSaved = false;
    index = 0;
    score = 0;
    answered = false;
    els.liveScore.textContent = "0";
    show(els.quiz);
    renderQuestion();
  }

  function normKey(s) {
    return (s || "").toString().trim().toUpperCase();
  }

  function sameSet(a, b) {
    const A = new Set((a || []).map(normKey));
    const B = new Set((b || []).map(normKey));
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
    return true;
  }

  function syncQtyRow(row) {
    const cb = row.querySelector('input[type="checkbox"]');
    const qty = row.querySelector(".qty-input");
    if (!cb || !qty) return;
    qty.disabled = !cb.checked || answered;
    if (!cb.checked) qty.value = "";
    row.classList.toggle("picked", cb.checked);
  }

  function renderQuestion() {
    const q = questions[index];
    answered = false;
    els.feedback.classList.add("hidden");
    els.btnConfirm.classList.add("hidden");
    els.multiHint.classList.add("hidden");
    els.counter.textContent = `${index + 1} / ${questions.length}`;
    els.progress.style.width = `${((index + 1) / questions.length) * 100}%`;
    els.qType.textContent = q.typeLabel;
    els.qText.textContent = q.prompt;
    els.options.innerHTML = "";
    els.options.classList.toggle("multi", q.mode === "multi");
    els.btnNext.textContent = index === questions.length - 1 ? "Ver resultado" : "Próxima";

    if (q.mode === "multi") {
      els.multiHint.classList.remove("hidden");
      els.btnConfirm.classList.remove("hidden");
      els.btnConfirm.disabled = false;
      q.options.forEach((opt) => {
        const row = document.createElement("div");
        row.className = "option option-check";
        row.dataset.name = opt.name;

        const left = document.createElement("label");
        left.className = "opt-left";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = opt.name;
        const span = document.createElement("span");
        span.className = "opt-name";
        span.textContent = opt.name;
        left.appendChild(cb);
        left.appendChild(span);

        const qtyWrap = document.createElement("div");
        qtyWrap.className = "qty-wrap";
        const qty = document.createElement("input");
        qty.type = "text";
        qty.inputMode = "text"; // aceita número, faixa ("3 a 4") ou "completar"
        qty.autocomplete = "off";
        qty.className = "qty-input";
        qty.placeholder = "qtd";
        qty.disabled = true;
        qty.setAttribute("aria-label", `Quantidade de ${opt.name}`);
        qty.addEventListener("click", (e) => e.stopPropagation());
        const unit = document.createElement("span");
        unit.className = "qty-unit";
        unit.textContent = opt.unit || "";
        qtyWrap.appendChild(qty);
        qtyWrap.appendChild(unit);

        cb.addEventListener("change", () => {
          syncQtyRow(row);
          if (cb.checked) qty.focus();
        });

        row.appendChild(left);
        row.appendChild(qtyWrap);
        els.options.appendChild(row);
      });
    } else {
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option";
        btn.textContent = opt;
        btn.addEventListener("click", () => onAnswerSingle(opt, btn));
        els.options.appendChild(btn);
      });
    }
  }

  function revealMulti(q, selectedNamesList, qtyByName) {
    const correctKeys = new Set(q.correct.map(normKey));
    [...els.options.children].forEach((el) => {
      const cb = el.querySelector('input[type="checkbox"]');
      const qtyInput = el.querySelector(".qty-input");
      if (cb) cb.disabled = true;
      if (qtyInput) qtyInput.disabled = true;
      const key = normKey(cb ? cb.value : el.dataset.name);
      const isRightIng = correctKeys.has(key);
      const wasPicked = selectedNamesList.some((s) => normKey(s) === key);
      const expectedQty = (q.correctQty && q.correctQty[key]) || "";
      const qtyOk = isRightIng && qtyMatches(qtyByName[key] || "", expectedQty);

      if (isRightIng && wasPicked && qtyOk) {
        el.classList.add("correct");
      } else if (isRightIng) {
        el.classList.add("wrong");
        if (qtyInput && expectedQty) {
          qtyInput.value = expectedQty.toUpperCase();
          qtyInput.classList.add("show-answer");
        }
      } else if (wasPicked) {
        el.classList.add("wrong");
      } else {
        el.classList.add("dim");
      }
    });
  }

  function onConfirmMulti() {
    if (answered) return;
    const q = questions[index];
    if (q.mode !== "multi") return;

    const selected = [];
    const qtyByName = {};
    let missingQty = false;
    [...els.options.children].forEach((el) => {
      const cb = el.querySelector('input[type="checkbox"]');
      const qtyInput = el.querySelector(".qty-input");
      if (!cb || !cb.checked) return;
      selected.push(cb.value);
      const key = normKey(cb.value);
      const val = (qtyInput && qtyInput.value) || "";
      qtyByName[key] = val;
      if (!String(val).trim()) missingQty = true;
    });

    if (!selected.length) {
      alert("Marque ao menos um ingrediente.");
      return;
    }
    if (missingQty) {
      alert("Digite a quantidade de cada ingrediente marcado.");
      return;
    }

    answered = true;
    els.btnConfirm.disabled = true;
    els.btnConfirm.classList.add("hidden");

    const namesOk = sameSet(selected, q.correct);
    let qtysOk = namesOk;
    if (namesOk) {
      for (const name of q.correct) {
        const key = normKey(name);
        if (!qtyMatches(qtyByName[key], q.correctQty[key])) {
          qtysOk = false;
          break;
        }
      }
    }
    const correct = namesOk && qtysOk;
    if (correct) score += PTS;
    els.liveScore.textContent = String(score);
    revealMulti(q, selected, qtyByName);

    let title = "Acertou!";
    if (!correct) {
      if (!namesOk) title = "Quase… ingredientes errados";
      else title = "Quase… quantidade errada";
    }
    els.feedbackTitle.textContent = title;
    els.feedbackTitle.className = "feedback-title " + (correct ? "ok" : "bad");
    els.feedbackBody.textContent = q.explain;
    els.feedback.classList.remove("hidden");
  }

  function onAnswerSingle(choice, btn) {
    if (answered) return;
    answered = true;
    const q = questions[index];
    const correct = normKey(choice) === normKey(q.correct);
    if (correct) score += PTS;
    els.liveScore.textContent = String(score);

    [...els.options.children].forEach((el) => {
      el.disabled = true;
      const isRight = normKey(el.textContent) === normKey(q.correct);
      if (isRight) el.classList.add("correct");
      else if (el === btn && !correct) el.classList.add("wrong");
      else el.classList.add("dim");
    });

    els.feedbackTitle.textContent = correct ? "Acertou!" : "Quase…";
    els.feedbackTitle.className = "feedback-title " + (correct ? "ok" : "bad");
    els.feedbackBody.textContent = q.explain;
    els.feedback.classList.remove("hidden");
  }

  function next() {
    if (!answered) return;
    if (index >= questions.length - 1) {
      showResult();
      return;
    }
    index += 1;
    renderQuestion();
  }

  function showResult() {
    const max = questions.length * PTS;
    els.finalScore.textContent = String(score);
    const small = els.finalScore.nextElementSibling;
    if (small) small.textContent = `/${max}`;
    const pct = max ? score / max : 0;
    let title = "Continue praticando!";
    if (pct >= 0.9) title = "Bartender de ouro!";
    else if (pct >= 0.7) title = "Excelente!";
    else if (pct >= 0.5) title = "Bom trabalho!";
    els.resultTitle.textContent = title;
    const acertos = score / PTS;
    const nFocus = selectedNames.size;
    els.resultDetail.textContent =
      `Você acertou ${acertos} de ${questions.length} perguntas` +
      ` (${nFocus} drink${nFocus === 1 ? "" : "s"} · 4 perguntas cada).`;
    show(els.result);
    submitResult(acertos, questions.length);
  }

  /* ---------- Ranking (Google Apps Script) ---------- */

  function setSaveStatus(text, kind) {
    if (!els.saveStatus) return;
    els.saveStatus.textContent = text || "";
    els.saveStatus.className = "save-status" + (text ? "" : " hidden") + (kind ? " " + kind : "");
  }

  function fetchWithTimeout(url, options = {}) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), RANKING_TIMEOUT_MS) : null;
    return fetch(url, { ...options, signal: ctrl ? ctrl.signal : undefined }).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  /** Envia o resultado: só evento, nome, números e drinks jogados (sem CPF). */
  async function submitResult(acertos, total) {
    if (!RANKING_API_URL) {
      setSaveStatus("", "");
      return;
    }
    if (resultSaved || !currentUser) return;
    resultSaved = true; // evita envio duplo do mesmo quiz
    setSaveStatus("Salvando seu resultado no ranking…", "pending");
    try {
      const payload = {
        evento: EVENTO,
        nome: currentUser.name,
        acertos,
        total,
        drinks: playedDrinks,
      };
      const res = await fetchWithTimeout(RANKING_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // text/plain evita preflight CORS
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.erro) || `HTTP ${res.status}`);
      setSaveStatus("✓ Resultado salvo no ranking!", "ok");
    } catch (err) {
      console.warn("Falha ao salvar resultado:", err);
      setSaveStatus("Não foi possível salvar seu resultado agora. Seu quiz não foi afetado.", "bad");
    }
  }

  function setupRankingButtons() {
    [els.btnRankingStart, els.btnRankingResult].forEach((btn) => {
      if (!btn) return;
      if (!RANKING_API_URL) {
        btn.classList.add("hidden"); // ranking desligado: botão escondido
        btn.disabled = true;
      } else {
        btn.classList.remove("hidden");
        btn.addEventListener("click", openRanking);
      }
    });
    if (els.btnRankingBack) {
      els.btnRankingBack.addEventListener("click", () => show(rankingReturnScreen || els.start));
    }
    if (els.btnRankingRetry) els.btnRankingRetry.addEventListener("click", loadRanking);
  }

  function openRanking() {
    const current = [els.start, els.result].find((s) => s && s.classList.contains("active"));
    rankingReturnScreen = current || els.start;
    show(els.ranking);
    loadRanking();
  }

  function setRankingStatus(text, kind) {
    els.rankingStatus.textContent = text || "";
    els.rankingStatus.className = "ranking-status" + (text ? "" : " hidden") + (kind ? " " + kind : "");
  }

  async function loadRanking() {
    els.rankingTableWrap.classList.add("hidden");
    els.rankingUpdated.classList.add("hidden");
    els.btnRankingRetry.classList.add("hidden");
    setRankingStatus("Carregando ranking…", "pending");
    try {
      const sep = RANKING_API_URL.includes("?") ? "&" : "?";
      const res = await fetchWithTimeout(`${RANKING_API_URL}${sep}action=ranking&t=${Date.now()}`, {
        redirect: "follow",
      });
      const data = await res.json();
      if (!res.ok || !data || !data.ok) throw new Error((data && data.erro) || `HTTP ${res.status}`);
      renderRanking(Array.isArray(data.ranking) ? data.ranking : [], data.atualizadoEm);
    } catch (err) {
      console.warn("Falha ao carregar ranking:", err);
      setRankingStatus("Não foi possível carregar o ranking. Verifique a conexão e tente de novo.", "bad");
      els.btnRankingRetry.classList.remove("hidden");
    }
  }

  function renderRanking(list, updatedAt) {
    els.rankingBody.innerHTML = "";
    if (!list.length) {
      setRankingStatus("Ainda não há resultados. Jogue um quiz e seja o primeiro do ranking!", "");
      return;
    }
    setRankingStatus("", "");
    const medals = ["🥇", "🥈", "🥉"];
    list.slice(0, 10).forEach((row, i) => {
      const tr = document.createElement("tr");
      const pos = Number(row.posicao) || i + 1;
      if (currentUser && row.nome === currentUser.name) tr.className = "me";
      const pct = Number(row.percentual) || 0;
      const quizzes = Number(row.quizzes) || 0;
      const addCell = (cls) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        tr.appendChild(td);
        return td;
      };
      addCell("pos").textContent = medals[pos - 1] || `${pos}º`;
      const nameCell = addCell("name");
      const nameEl = document.createElement("span");
      nameEl.className = "rk-name";
      nameEl.textContent = String(row.nome || "—"); // textContent: nomes nunca viram HTML
      const subEl = document.createElement("span");
      subEl.className = "rk-sub";
      subEl.textContent = `${quizzes} quiz${quizzes === 1 ? "" : "zes"} · ${Number(row.perguntas) || 0} perguntas`;
      nameCell.appendChild(nameEl);
      nameCell.appendChild(subEl);
      addCell("num acertos").textContent = String(Number(row.acertos) || 0);
      addCell("num").textContent =
        `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      els.rankingBody.appendChild(tr);
    });
    els.rankingTableWrap.classList.remove("hidden");
    if (updatedAt) {
      els.rankingUpdated.textContent = `Atualizado em ${updatedAt}`;
      els.rankingUpdated.classList.remove("hidden");
    }
  }

  setupRankingButtons();

  els.btnStart.addEventListener("click", () => { if (requireAuth()) openSelect(); });
  els.btnSelectAll.addEventListener("click", () => {
    drinks.forEach((d) => selectedNames.add(d.name));
    renderDrinkList();
  });
  els.btnSelectNone.addEventListener("click", () => {
    selectedNames.clear();
    renderDrinkList();
  });
  els.btnPlay.addEventListener("click", startGame);
  els.btnBackStart.addEventListener("click", () => show(els.start));
  els.btnConfirm.addEventListener("click", onConfirmMulti);
  els.btnNext.addEventListener("click", next);
  els.btnReplay.addEventListener("click", () => { if (requireAuth()) startGame(); });
  els.btnHome.addEventListener("click", openSelect);
  if (els.btnLogin) {
    els.btnLogin.addEventListener("click", () => { tryLogin(); });
  }
  if (els.btnLogout) els.btnLogout.addEventListener("click", logout);
  if (els.loginFilter) {
    els.loginFilter.addEventListener("input", () => renderLoginNames(els.loginFilter.value));
  }
  if (els.loginName) {
    els.loginName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
    });
    els.loginName.addEventListener("dblclick", () => tryLogin());
  }
  if (els.loginFilter) {
    els.loginFilter.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (!els.loginName.value && els.loginName.options.length) els.loginName.selectedIndex = 0;
      tryLogin();
    });
  }

  Promise.all([
    fetch("./drinks.json", { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error("Falha ao carregar drinks.json");
      return r.json();
    }),
    fetch("./users.json", { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error("Falha ao carregar users.json");
      return r.json();
    }),
  ])
    .then(([drinkData, userData]) => {
      drinks = Array.isArray(drinkData) ? drinkData : [];
      els.drinkCount.textContent = String(drinks.length);
      drinks.forEach((d) => selectedNames.add(d.name));

      authUsers = (Array.isArray(userData.users) ? userData.users : [])
        .map((u) => ({ name: String((u && u.name) || "").replace(/\s+/g, " ").trim() }))
        .filter((u) => u.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      renderLoginNames("");

      const saved = sessionStorage.getItem(AUTH_KEY);
      const found = saved && authUsers.find((u) => u.name === saved);
      if (found) {
        setLoggedIn(found);
        show(els.start);
      } else {
        show(els.login);
      }
    })
    .catch((err) => {
      console.error(err);
      els.drinkCount.textContent = "0";
      if (els.btnStart) {
        els.btnStart.disabled = true;
        els.btnStart.textContent = "Dados indisponíveis";
      }
      if (els.loginError) {
        els.loginError.textContent = "Não foi possível carregar a lista de acesso.";
        els.loginError.classList.remove("hidden");
      }
      show(els.login);
    });
})();
