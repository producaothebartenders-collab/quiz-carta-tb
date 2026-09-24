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
    loginCpf: document.getElementById("login-cpf"),
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
    btnSelectAutorais: document.getElementById("btn-select-autorais"),
    btnSelectClassicos: document.getElementById("btn-select-classicos"),
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
  };

  let drinks = [];
  let authUsers = [];
  let currentUser = null;
  let selectedNames = new Set();
  let questions = [];
  let index = 0;
  let score = 0;
  let answered = false;
  const AUTH_KEY = "tb-quiz-user";

  function show(screen) {
    [els.login, els.start, els.select, els.quiz, els.result].forEach((s) => {
      if (s) s.classList.remove("active");
    });
    screen.classList.add("active");
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function renderLoginNames(filter = "") {
    const q = filter.trim().toLowerCase();
    const list = authUsers.filter((u) => !q || u.name.toLowerCase().includes(q));
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

  async function tryLogin() {
    els.loginError.classList.add("hidden");
    const name = (els.loginName.value || "").trim();
    const cpf = digitsOnly(els.loginCpf.value);
    if (!name) {
      els.loginError.textContent = "Selecione seu nome na lista.";
      els.loginError.classList.remove("hidden");
      return;
    }
    if (cpf.length !== 11) {
      els.loginError.textContent = "Digite o CPF completo (11 números).";
      els.loginError.classList.remove("hidden");
      return;
    }
    const user = authUsers.find((u) => u.name === name);
    if (!user) {
      els.loginError.textContent = "Nome não autorizado.";
      els.loginError.classList.remove("hidden");
      return;
    }
    const hash = await sha256Hex(cpf);
    const stored = user.pinHash;
    if (hash !== stored) {
      els.loginError.textContent = "CPF não confere. Tente de novo.";
      els.loginError.classList.remove("hidden");
      els.loginCpf.value = "";
      els.loginCpf.focus();
      return;
    }
    setLoggedIn(user);
    els.loginCpf.value = "";
    show(els.start);
  }

  function logout() {
    setLoggedIn(null);
    els.loginCpf.value = "";
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

  function formatIngredient(ing) {
    if (!ing || !ing.name) return "";
    const qty = (ing.qty || "").toString().trim();
    const unit = (ing.unit || "").toString().trim();
    if (qty && unit) return `${ing.name} — ${qty} ${unit}`;
    if (qty) return `${ing.name} — ${qty}`;
    return ing.name;
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
            if (drink.carta) {
        const carta = document.createElement("span");
        carta.className = "drink-tag drink-tag-carta";
        carta.textContent = drink.carta === "classicos" ? "clássico" : "autoral";
        text.appendChild(carta);
      }
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

  function ingredientLine(ing) {
    if (!ing || !ing.name) return "";
    const qty = (ing.qty || "").toString().trim();
    const unit = (ing.unit || "").toString().trim().split("\n")[0].trim();
    if (qty && unit) return `${qty} ${unit} ${ing.name}`;
    if (qty) return `${qty} ${ing.name}`;
    return ing.name;
  }

  function formatRecipe(drink) {
    return (drink.ingredients || [])
      .map(ingredientLine)
      .filter(Boolean)
      .join(" · ");
  }

  function isBlendName(name) {
    const n = (name || "").toUpperCase();
    return n.includes("BLEND") || n.includes("PREPARO DO BLEND");
  }

  /** Skip meta / instruction lines — never use as distractors. */
  function isMetaIngredient(name) {
    const n = (name || "").toUpperCase();
    return (
      n.includes("USAR ") ||
      n.includes("CASAMENTOS") ||
      n.includes("XV ANOS") ||
      n.includes("GÁS PARA") ||
      n.includes("GAS PARA") ||
      n.includes("PREPARO DO BLEND")
    );
  }

  /** Rough family so distractors feel related (spirit vs juice vs syrup…). */
  function ingredientFamily(name) {
    const n = (name || "").toUpperCase();
    if (isBlendName(n)) return "blend";
    if (isMetaIngredient(n)) return "meta";
    // Foams / egg before juice (avoids ESPUMA CUPUAÇU → juice)
    if (/ESPUMA|FOAM|CLARA|OVO|ALBUM|ALBUL/.test(n)) return "egg_foam";
    if (/LICOR|FRANGELICO|AMARETTO|TRIPLE|CURACAO|CURA[CÇ][AÃ]O|KAHLUA|BAILEYS|CREME DE|SAMBUCA|CHARTREUSE|CHAMBORD|LIMONCELLO|DRAMBUIE|LICOR 43/.test(n))
      return "liqueur";
    if (
      /WHISKEY|WHISKY|VODKA|GIN|RUM|CACHA[CÇ]A|TEQUILA|MEZCAL|BRANDY|COGNAC|PISCO|ABSINTO|JAGER|JÄGER|SAQU[EÊ]/.test(
        n
      )
    )
      return "base";
    if (/VINHO|ESPUMANTE|CHAMPAGNE|PROSECCO|CERVEJA/.test(n)) return "wine";
    if (/APEROL|CAMPARI|CYNAR|FERNET|AMARO|VERMOUTH|MARTINI|LILLET|PICON/.test(n))
      return "bitter_aperitif";
    if (/SUCO|LIM[AÃ]O|LARANJA|ABACAXI|MARACUJ[AÁ]|MORANGO|UVA|TORANJA|GRAPEFRUIT|CUPUA[CÇ]U|MANGA|PITAYA|CH[AÁ]\b/.test(n))
      return "juice";
    if (/SYRUP|XAROPE|MAPLE|A[CÇ][UÚ]CAR|MEL|HONEY|SIMPLE|GOMME/.test(n)) return "sweet";
    if (/BITTER|ANGOSTURA|ORANGE BITTER|PEYCHAUD/.test(n)) return "bitter";
    if (/SODA|T[OÔ]NICA|GINGER|ÁGUA|AGUA|SPRITE|REFRIGERANTE|SCHWEPPES|H2OH/.test(n))
      return "soda";
    if (/HORTEL[AÃ]|MANJERIC[AÃ]O|FOLHAS|ALECRIM|GENGIBRE|PIMENTA/.test(n)) return "herb";
    return "other";
  }

  function normalizeQty(raw) {
    const s = (raw || "").toString().trim().replace(",", ".");
    if (!s) return "";
    const n = Number(s);
    if (!Number.isNaN(n) && s.match(/^-?\d+(\.\d+)?$/)) {
      return String(n);
    }
    return s.toUpperCase();
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
            unit: ((ing.unit || "").toString().trim().split("\n")[0] || "ML").trim() || "ML",
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
   * False options: same families as the drink, never foreign blends.
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
      correctIngs.push({
        name,
        qty: (ing.qty || "").toString().trim(),
        unit: ((ing.unit || "").toString().trim().split("\n")[0] || "ML").trim() || "ML",
      });
    }
    if (correctIngs.length < 1) return null;

    const correctKeys = new Set(correctIngs.map((i) => i.name.toUpperCase()));
    const drinkFamilies = new Set(correctIngs.map((i) => ingredientFamily(i.name)));
    // Prefer families present in the drink; also allow nearby pantry
    const related = new Set(drinkFamilies);
    if (drinkFamilies.has("base")) {
      related.add("liqueur");
      related.add("bitter_aperitif");
    }
    if (drinkFamilies.has("juice")) related.add("sweet");
    if (drinkFamilies.has("sweet")) related.add("juice");
    if (drinkFamilies.has("wine")) {
      related.add("base");
      related.add("liqueur");
    }
    if (drinkFamilies.has("egg_foam")) related.add("sweet");
    if (drinkFamilies.has("soda")) related.add("juice");
    // Blends of THIS drink stay in correctIngs; foreign blends already excluded

    const catalog = catalogIngredients(allPool);
    const falseCandidates = [];
    for (const item of catalog.values()) {
      if (correctKeys.has(item.name.toUpperCase())) continue;
      if (item.blend) continue; // never plant another drink's blend as a distractor
      if (item.meta || item.family === "meta") continue;
      if (!related.has(item.family) && item.family !== "other") continue;
      falseCandidates.push(item);
    }

    // Prefer same-family first
    const sameFamily = falseCandidates.filter((i) => drinkFamilies.has(i.family));
    const otherRelated = falseCandidates.filter((i) => !drinkFamilies.has(i.family));
    const ranked = [...shuffle(sameFamily), ...shuffle(otherRelated)];

    const fakeCount = Math.min(
      ranked.length,
      Math.max(3, Math.min(5, correctIngs.length))
    );
    if (fakeCount < 2) return null;

    const falseIngs = ranked.slice(0, fakeCount).map((i) => ({
      name: i.name,
      qty: "",
      unit: i.unit || "ML",
      fake: true,
    }));

    const options = shuffle([
      ...correctIngs.map((i) => ({ ...i, fake: false })),
      ...falseIngs,
    ]);

    return {
      mode: "multi",
      typeLabel: `${drink.name} · Receita`,
      prompt: `Qual a receita do ${drink.name}? Marque os ingredientes certos e digite a quantidade de cada um.`,
      correct: correctIngs.map((i) => i.name),
      correctQty: Object.fromEntries(
        correctIngs.map((i) => [i.name.toUpperCase(), i.qty])
      ),
      options,
      explain: `Receita de ${drink.name}: ${formatRecipe(drink)}.`,
    };
  }

  function buildChoiceQuestion(drink, kind, allPool) {
    const field =
      kind === "copo" ? "copo" : kind === "preparo" ? "preparo" : "guarnicao";
    const correct = (drink[field] || "").toString().trim();
    if (!correct) return null;

    const pool = allPool.map((d) => d[field]);
    const wrong = distractors(pool, correct);
    if (wrong.length < 3) return null;

    if (kind === "copo") {
      return {
        typeLabel: `${drink.name} · Copo / Taça`,
        prompt: `Em qual copo/taça é servido o ${drink.name}?`,
        correct,
        options: shuffle([correct, ...wrong]),
        explain: `${drink.name} vai em ${correct}.`,
        kind,
      };
    }
    if (kind === "preparo") {
      return {
        typeLabel: `${drink.name} · Preparo`,
        prompt: `Qual o método de preparo de ${drink.name}?`,
        correct,
        options: shuffle([correct, ...wrong]),
        explain: `Preparo de ${drink.name}: ${correct}.`,
        kind,
      };
    }
    return {
      typeLabel: `${drink.name} · Guarnição`,
      prompt: `Qual a guarnição de ${drink.name}?`,
      correct,
      options: shuffle([correct, ...wrong]),
      explain: `Guarnição de ${drink.name}: ${correct}.`,
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
        qty.inputMode = "decimal";
        qty.className = "qty-input";
        qty.placeholder = "qtd";
        qty.disabled = true;
        qty.setAttribute("aria-label", `Quantidade de ${opt.name}`);
        qty.addEventListener("click", (e) => e.stopPropagation());
        const unit = document.createElement("span");
        unit.className = "qty-unit";
        unit.textContent = opt.unit || "ML";
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
          qtyInput.value = expectedQty;
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
  }

  els.btnStart.addEventListener("click", () => { if (requireAuth()) openSelect(); });
  els.btnSelectAll.addEventListener("click", () => {
    drinks.forEach((d) => selectedNames.add(d.name));
    renderDrinkList();
  });
  if (els.btnSelectAutorais) {
    els.btnSelectAutorais.addEventListener("click", () => {
      selectedNames.clear();
      drinks.filter((d) => d.carta === "autorais").forEach((d) => selectedNames.add(d.name));
      renderDrinkList();
    });
  }
  if (els.btnSelectClassicos) {
    els.btnSelectClassicos.addEventListener("click", () => {
      selectedNames.clear();
      drinks.filter((d) => d.carta === "classicos").forEach((d) => selectedNames.add(d.name));
      renderDrinkList();
    });
  }
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
  if (els.loginCpf) {
    els.loginCpf.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
    });
  }

  Promise.all([
    fetch("drinks.json").then((r) => {
      if (!r.ok) throw new Error("Falha ao carregar drinks.json");
      return r.json();
    }),
    fetch("users.json").then((r) => {
      if (!r.ok) throw new Error("Falha ao carregar users.json");
      return r.json();
    }),
  ])
    .then(([drinkData, userData]) => {
      drinks = Array.isArray(drinkData) ? drinkData : [];
      els.drinkCount.textContent = String(drinks.length);
      drinks.forEach((d) => selectedNames.add(d.name));

      authUsers = Array.isArray(userData.users) ? userData.users : [];
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
