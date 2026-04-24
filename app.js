// ===== Data =====
const [INGREDIENTS, AAFCO] = await Promise.all([
  fetch("data/ingredients.json").then(r => r.json()),
  fetch("data/aafco.json").then(r => r.json()),
]);

// ===== Config =====
const CAT_ORDER = ["牛肉","豬肉","雞肉","鴨肉","羊肉","火雞","兔肉","海鮮","蛋類","乳品","蔬菜","水果","穀物","油脂","豆類","補充品","調味","飼料"];
const CAT_COLORS = {
  "牛肉":"#b0463a","豬肉":"#d97a7a","雞肉":"#e08a4f","鴨肉":"#8b5a3c","羊肉":"#a65d4f","火雞":"#c97e3a","兔肉":"#b88060",
  "海鮮":"#4a90a4","蛋類":"#d4a94a","乳品":"#e8d4a0","蔬菜":"#5b9355","水果":"#c95d95","穀物":"#b89456",
  "油脂":"#8a7a3f","豆類":"#8a9355","補充品":"#7b5a8a","調味":"#808080","飼料":"#5a5a5a",
};
const STORAGE_KEY = "dogCalc_v4";

// Nutrients we actively suggest ingredients for when short.
// (Skipped: kcal — always scale instead; carb/fiber — no AAFCO min; amino acids — too many.)
const GAP_SUGGEST = {
  protein:  { label: "蛋白質",   unitScale: 1 },
  fat:      { label: "脂肪",     unitScale: 1 },
  ca:       { label: "鈣",       unitScale: 1 },    // mg
  p:        { label: "磷",       unitScale: 1 },
  k:        { label: "鉀",       unitScale: 1 },
  fe:       { label: "鐵",       unitScale: 1 },
  zn:       { label: "鋅",       unitScale: 1 },
  mn:       { label: "錳",       unitScale: 1 },
  cu:       { label: "銅",       unitScale: 1 },
  i:        { label: "碘",       unitScale: 1 },
  se:       { label: "硒",       unitScale: 1 },
  omega3:   { label: "Omega-3",  unitScale: 1 },
  omega6:   { label: "Omega-6",  unitScale: 1 },
  vitA_IU:  { label: "維生素 A", unitScale: 1 },
  vitD_IU:  { label: "維生素 D", unitScale: 1 },
  vitE_mg:  { label: "維生素 E", unitScale: 1 },
  b1:       { label: "B1",       unitScale: 1 },
  b2:       { label: "B2",       unitScale: 1 },
  b3:       { label: "B3",       unitScale: 1 },
  b5:       { label: "B5",       unitScale: 1 },
  b6:       { label: "B6",       unitScale: 1 },
  b9:       { label: "B9",       unitScale: 1 },
  b12:      { label: "B12",      unitScale: 1 },
  choline:  { label: "膽鹼",     unitScale: 1 },
};

// ===== State =====
function newPet(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "狗狗",
    weight: 10,
    activity: 1.6,
    lifeStage: "maintenance",
    conditions: [],
    recipes: [{ id: crypto.randomUUID(), name: "預設食譜", items: [] }],
    currentRecipeId: null,
    ...overrides,
  };
}

function migratePet(p) {
  // v3 → v4: pet.recipe → pet.recipes[]
  if (p.recipe && !p.recipes) {
    p.recipes = [{ id: crypto.randomUUID(), name: "預設食譜", items: p.recipe }];
    delete p.recipe;
  }
  if (!Array.isArray(p.recipes) || p.recipes.length === 0) {
    p.recipes = [{ id: crypto.randomUUID(), name: "預設食譜", items: [] }];
  }
  if (!p.currentRecipeId || !p.recipes.find(r => r.id === p.currentRecipeId)) {
    p.currentRecipeId = p.recipes[0].id;
  }
}

let state = load() || { pets: [newPet()], currentId: null };
state.pets.forEach(migratePet);
if (!state.currentId || !state.pets.find(p => p.id === state.currentId)) {
  state.currentId = state.pets[0].id;
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() {
  try {
    // Prefer v4, fall back to v3
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("dogCalc_v3");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function currentPet() { return state.pets.find(p => p.id === state.currentId) || state.pets[0]; }
function currentRecipe() {
  const p = currentPet();
  return p.recipes.find(r => r.id === p.currentRecipeId) || p.recipes[0];
}

// ===== AAFCO target resolution =====
function resolveNutrients(pet) {
  const base = AAFCO.profiles.maintenance.nutrients;
  const profile = AAFCO.profiles[pet.lifeStage] || {};
  const overrides = profile.overrides || {};
  const condOverrides = {};
  for (const c of pet.conditions || []) {
    const co = AAFCO.conditions[c]?.overrides || {};
    for (const [k, v] of Object.entries(co)) {
      condOverrides[k] = { ...(condOverrides[k] || {}), ...v };
    }
  }
  return base.map(n => {
    const merged = { ...n };
    if (overrides[n.id]) Object.assign(merged, overrides[n.id]);
    if (condOverrides[n.id]) Object.assign(merged, condOverrides[n.id]);
    return merged;
  });
}

function resolveDER(pet) {
  const rer = 70 * Math.pow(Math.max(pet.weight, 0), 0.75);
  let mult = pet.activity;
  for (const c of pet.conditions || []) {
    const m = AAFCO.conditions[c]?.der_multiplier;
    if (m) mult *= m;
  }
  return { rer, der: rer * mult, mult };
}

// ===== Nutrition math =====
function findIng(name) { return INGREDIENTS.find(i => i.name === name); }

function aggregate(items) {
  const totals = {};
  let totalG = 0;
  for (const { name, qty } of items) {
    const ing = findIng(name);
    if (!ing) continue;
    const g = parseFloat(qty) || 0;
    totalG += g;
    for (const [k, v] of Object.entries(ing)) {
      if (typeof v !== "number" || k.startsWith("_")) continue;
      totals[k] = (totals[k] || 0) + v * g;
    }
  }
  return { totals, totalG };
}

function perK(totals, kcal, k = 1000) {
  if (!kcal) return {};
  const out = {};
  for (const [n, v] of Object.entries(totals)) out[n] = v * k / kcal;
  return out;
}

function getStatus(provided, min, max, isRef) {
  if (isRef) return "ref";
  if (min != null && provided < min * 0.98) return "bad_low";
  if (max != null && provided > max * 1.02) return "bad_high";
  return "ok";
}

function dmbPercent(totals, totalG) {
  const water = totals.water || 0;
  const dry = totalG - water;
  if (dry <= 0) return null;
  return {
    dry, water,
    protein: (totals.protein || 0) / dry * 100,
    fat:     (totals.fat || 0) / dry * 100,
    carb:    (totals.carb || 0) / dry * 100,
    fiber:   (totals.fiber || 0) / dry * 100,
  };
}

// ===== Gap suggestion =====
function suggestForGap(key, gapAbsolute) {
  // gapAbsolute is how many units of nutrient we need to add (in raw data units,
  // matching ingredient per-gram values).
  if (gapAbsolute <= 0) return [];
  // Rank ingredients by grams needed (lower = more efficient). Skip only 調味 & 飼料 (not supplements — homemade supplements like eggshell/kelp powder are often the most practical fix).
  const cands = INGREDIENTS
    .filter(i => (i[key] || 0) > 0 && !["調味","飼料"].includes(i.group))
    .map(i => ({ ing: i, grams: gapAbsolute / i[key] }))
    .filter(x => isFinite(x.grams) && x.grams > 0)
    .sort((a, b) => a.grams - b.grams);
  return cands.slice(0, 3).map(x => ({ name: x.ing.name, group: x.ing.group, grams: x.grams }));
}

// ===== UI helpers =====
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "style") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
};
function fmt(v, d = 2) {
  if (v == null || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs < 0.01) return v.toExponential(1);
  if (abs < 1) return v.toFixed(3);
  if (abs < 10) return v.toFixed(d);
  if (abs < 100) return v.toFixed(1);
  return Math.round(v).toString();
}

// ===== Render =====
function renderPetBar() {
  const sel = $("#petSelect");
  sel.innerHTML = "";
  for (const p of state.pets) sel.appendChild(h("option", { value: p.id }, `🐶 ${p.name} (${p.weight}kg)`));
  sel.value = state.currentId;
  $("#petDelete").disabled = state.pets.length <= 1;
}

function renderRecipeBar() {
  const p = currentPet();
  const sel = $("#recipeSelect");
  sel.innerHTML = "";
  for (const r of p.recipes) sel.appendChild(h("option", { value: r.id }, `📋 ${r.name}`));
  sel.value = p.currentRecipeId;
  $("#recipeDelete").disabled = p.recipes.length <= 1;
}

function renderPetFields() {
  const p = currentPet();
  $("#weight").value = p.weight;
  $("#activity").value = p.activity;
  $("#lifeStage").value = p.lifeStage;
  const box = $("#conditions");
  box.innerHTML = "";
  for (const [id, c] of Object.entries(AAFCO.conditions)) {
    if (id.startsWith("_")) continue;
    const lab = h("label", {},
      h("input", { type: "checkbox", value: id, ...(p.conditions?.includes(id) ? { checked: true } : {}) }),
      " " + c.label
    );
    lab.querySelector("input").addEventListener("change", e => {
      const set = new Set(p.conditions || []);
      if (e.target.checked) set.add(id); else set.delete(id);
      p.conditions = [...set];
      save(); renderAll();
    });
    box.appendChild(lab);
  }
}

function renderEnergy() {
  const p = currentPet();
  const { rer, der, mult } = resolveDER(p);
  $("#rer").textContent = Math.round(rer);
  $("#der").textContent = Math.round(der);
  $("#derNote").textContent = Math.abs(mult - p.activity) > 0.001 ? ` (×${mult.toFixed(2)} 含狀況調整)` : "";
}

function renderPicker() {
  const items = currentRecipe().items;
  const recipeNames = new Set(items.map(r => r.name));
  const sorted = [...INGREDIENTS].sort((a,b) =>
    (CAT_ORDER.indexOf(a.group) - CAT_ORDER.indexOf(b.group)) || a.name.localeCompare(b.name, "zh")
  );
  const grid = $("#ingGrid");
  grid.innerHTML = "";
  for (const ing of sorted) {
    const active = recipeNames.has(ing.name);
    const btn = h("button", {
      class: "ing-btn" + (active ? " active" : ""),
      style: { "--cat-color": CAT_COLORS[ing.group] || "#999" },
      dataset: { name: ing.name, en: ing.en || "", group: ing.group },
      onclick: () => addOrFocus(ing.name),
    }, ing.name, active ? h("span", { class: "pending" }, "已加入") : null);
    grid.appendChild(btn);
  }
  const leg = $("#catLegend");
  leg.innerHTML = "";
  const groupsPresent = [...new Set(sorted.map(i => i.group))];
  for (const g of CAT_ORDER) {
    if (!groupsPresent.includes(g)) continue;
    leg.appendChild(h("span", { class: "item" },
      h("span", { class: "dot", style: { background: CAT_COLORS[g] } }),
      g
    ));
  }
}

function renderRecipe() {
  const items = currentRecipe().items;
  const list = $("#recipe");
  list.innerHTML = "";
  for (const item of items) {
    const ing = findIng(item.name);
    if (!ing) continue;
    const row = h("div", {
      class: "recipe-row",
      style: { "--cat-color": CAT_COLORS[ing.group] || "#999" },
    },
      h("div", {},
        h("div", { class: "name" }, ing.name),
        h("div", { class: "sub" }, ing.group + (ing.en ? " · " + ing.en : ""))
      ),
      h("input", {
        class: "qty", type: "number", min: "0", step: "1", inputmode: "decimal",
        value: item.qty,
        oninput: e => { item.qty = e.target.value; save(); renderSummary(); renderRecipeTotals(); },
      }),
      h("span", { class: "unit" }, "g"),
      h("button", {
        class: "del", title: "移除",
        onclick: () => {
          const r = currentRecipe();
          r.items = r.items.filter(x => x.name !== item.name);
          save(); renderAll();
        },
      }, "×"),
    );
    list.appendChild(row);
  }
}

function renderRecipeTotals() {
  const items = currentRecipe().items;
  const { totals, totalG } = aggregate(items);
  const kcal = totals.kcal || 0;
  $("#totalG").textContent = totalG.toFixed(1);
  $("#totalKcal").textContent = kcal.toFixed(1);
  const { der } = resolveDER(currentPet());
  $("#derPct").textContent = (der > 0 && kcal > 0) ? `(${(kcal / der * 100).toFixed(0)}% DER)` : "";
}

function renderSummary() {
  const p = currentPet();
  const items = currentRecipe().items;
  const { totals, totalG } = aggregate(items);
  const kcal = totals.kcal || 0;
  const dm = dmbPercent(totals, totalG);

  // Macro cards
  const macroCards = $("#macroCards");
  macroCards.innerHTML = "";
  for (const [k, label] of [["protein","蛋白質"],["fat","脂肪"],["carb","碳水"]]) {
    macroCards.appendChild(h("div", { class: "m" },
      h("div", { class: "lbl" }, label),
      h("div", { class: "v" }, fmt(totals[k] || 0) + " g"),
      h("div", { class: "sub" }, dm ? "DMB " + dm[k].toFixed(1) + "%" : ""),
    ));
  }

  // DMB box
  const dmbBox = $("#dmbBox");
  dmbBox.innerHTML = "";
  if (dm) {
    dmbBox.appendChild(h("div", {}, `乾物比 (DMB)·乾物重 ${dm.dry.toFixed(1)} g / 水分 ${dm.water.toFixed(1)} g`));
    dmbBox.appendChild(h("div", { class: "row" },
      ...[["protein","蛋白質"],["fat","脂肪"],["carb","碳水"],["fiber","膳食纖維"]].map(([k,l]) =>
        h("div", { class: "col" },
          h("div", { class: "v" }, dm[k].toFixed(1)),
          h("div", { class: "k" }, l + " %DM")
        )
      )
    ));
  }

  // Ratios
  const ratio = $("#ratioBox");
  ratio.innerHTML = "";
  const ca = totals.ca || 0, ph = totals.p || 0;
  if (ca + ph > 0) {
    const r = ph > 0 ? (ca / ph) : Infinity;
    const status = (r >= 1 && r <= 2.1) ? "ok" : (r < 1 ? "bad" : "warn");
    const note = r < 1 ? "Ca:P 偏低(建議 1:1 ~ 2:1)" : r > 2.1 ? "Ca:P 偏高" : "Ca:P 適當";
    ratio.appendChild(h("span", {}, `鈣磷比 ${r.toFixed(2)} : 1 — `, h("span", { class: "tag " + status }, note)));
  }
  const o6 = totals.omega6 || 0, o3 = totals.omega3 || 0;
  if (o6 + o3 > 0 && o3 > 0) {
    const r = o6 / o3;
    const ok = r >= 2 && r <= 30;
    ratio.appendChild(h("span", {}, `Omega-6 : Omega-3 = ${r.toFixed(2)} : 1 `,
      h("span", { class: "tag " + (ok ? "ok" : "warn") }, ok ? "可接受" : "比例偏高")
    ));
  }

  // Per-nutrient AAFCO status + gap suggestions
  const nutrients = resolveNutrients(p);
  const perKcal = perK(totals, kcal, 1000);
  const counts = { ok: 0, bad_low: 0, bad_high: 0, ref: 0 };
  const byGroup = {};
  const gaps = [];  // {key, label, deficit, gap_absolute}
  for (const n of nutrients) {
    let provided;
    if (n.sumOf) provided = n.sumOf.reduce((s, k) => s + (perKcal[k] || 0), 0);
    else provided = perKcal[n.src] || 0;
    if (n.scale) provided = provided * n.scale;
    const isRef = n.ref || (n.min == null && n.max == null);
    const status = getStatus(provided, n.min, n.max, isRef);
    if (status === "ok") counts.ok++;
    else if (status === "bad_low") counts.bad_low++;
    else if (status === "bad_high") counts.bad_high++;
    else counts.ref++;
    (byGroup[n.group] = byGroup[n.group] || []).push({ n, provided, status });

    // Record gap for suggestable nutrients
    if (status === "bad_low" && GAP_SUGGEST[n.src]) {
      // Convert `provided (per 1000 kcal × scale)` back to absolute daily need.
      const unitScale = n.scale || 1;
      // provided_per1k  in display units; convert to per-gram raw:
      // target_min_per1k = n.min (in display units). Want daily absolute amount.
      const targetDailyPer1k = n.min;
      const deficitPer1k = targetDailyPer1k - provided;
      if (deficitPer1k > 0) {
        const kcalScale = kcal / 1000;
        const deficit_display = deficitPer1k * kcalScale;
        // Convert display units back to raw per-gram units (inverse of scale)
        const gap_raw = deficit_display / unitScale;
        gaps.push({ key: n.src, label: n.label, unit: n.unit, deficit_display, gap_raw });
      }
    }
  }

  const sc = $("#statusCounts");
  sc.innerHTML = "";
  sc.appendChild(h("div", { class: "box ok" }, h("b", {}, counts.ok), "OK 達標"));
  sc.appendChild(h("div", { class: "box warn" }, h("b", {}, counts.bad_low), "不足"));
  sc.appendChild(h("div", { class: "box bad" }, h("b", {}, counts.bad_high), "超上限"));
  sc.appendChild(h("div", { class: "box ref" }, h("b", {}, counts.ref), "參考"));

  // Gap suggestions
  const gapBox = $("#gapSuggestions");
  gapBox.innerHTML = "";
  if (gaps.length && kcal > 0) {
    gapBox.appendChild(h("h4", {}, "補充建議(依目前熱量計算)"));
    for (const gap of gaps.slice(0, 8)) {
      const suggestions = suggestForGap(gap.key, gap.gap_raw);
      const line = h("div", { class: "gap-line" },
        h("span", { class: "gap-name" }, `缺 ${gap.label} ${fmt(gap.deficit_display)} ${gap.unit}`),
      );
      if (suggestions.length) {
        const sugs = h("span", { class: "gap-sugs" });
        suggestions.forEach((s, i) => {
          if (i > 0) sugs.appendChild(document.createTextNode(" · "));
          sugs.appendChild(h("button", {
            class: "sug-chip",
            style: { "--cat-color": CAT_COLORS[s.group] || "#999" },
            title: `加入 ${fmt(s.grams)}g ${s.name}`,
            onclick: () => addOrFocus(s.name, s.grams),
          }, `+${s.name} ~${fmt(s.grams)}g`));
        });
        line.appendChild(h("span", { class: "gap-arrow" }, " → "));
        line.appendChild(sugs);
      }
      gapBox.appendChild(line);
    }
  }

  // Detail
  const det = $("#nutrientDetail");
  det.innerHTML = "";
  const groupLabels = { macro: "巨量", fat: "脂肪酸", mineral: "礦物質", vitamin: "維生素", aa: "胺基酸" };
  for (const g of ["macro","fat","mineral","vitamin","aa"]) {
    if (!byGroup[g]) continue;
    const grp = h("div", { class: "nut-group" }, h("h4", {}, groupLabels[g] || g));
    for (const { n, provided, status } of byGroup[g]) {
      const tagClass = status === "ok" ? "ok" : status === "bad_low" ? "warn" : status === "bad_high" ? "bad" : "ref";
      const tagText = status === "ok" ? "OK" : status === "bad_low" ? "不足" : status === "bad_high" ? "超" : "參";
      const rangeStr = n.min != null && n.max != null ? `${n.min}–${n.max}`
        : n.min != null ? `≥ ${n.min}`
        : n.max != null ? `≤ ${n.max}`
        : "—";
      grp.appendChild(h("div", { class: "nut-row" },
        h("div", { class: "n" }, n.label),
        h("div", { class: "vals" }, `${fmt(provided)} ${n.unit}`),
        h("div", { class: "vals" }, `目標 ${rangeStr}`),
        h("span", { class: "tag " + tagClass }, tagText),
      ));
    }
    det.appendChild(grp);
  }
}

function renderAll() {
  renderPetBar();
  renderRecipeBar();
  renderPetFields();
  renderEnergy();
  renderPicker();
  renderRecipe();
  renderRecipeTotals();
  renderSummary();
}

// ===== Actions: recipe items =====
function addOrFocus(name, grams) {
  const r = currentRecipe();
  const existing = r.items.find(x => x.name === name);
  if (existing) {
    if (grams != null) existing.qty = (parseFloat(existing.qty) || 0) + Math.round(grams * 10) / 10;
    save(); renderAll();
    for (const row of $$(".recipe-row")) {
      if (row.querySelector(".name")?.textContent === name) {
        const inp = row.querySelector(".qty");
        inp?.focus(); inp?.select(); break;
      }
    }
    return;
  }
  r.items.push({ name, qty: grams != null ? Math.round(grams * 10) / 10 : 50 });
  save(); renderAll();
}

function clearRecipe() {
  const r = currentRecipe();
  if (!r.items.length) return;
  if (!confirm(`清除「${r.name}」的所有食材?`)) return;
  r.items = [];
  save(); renderAll();
}

function scaleToDER() {
  const r = currentRecipe();
  const { totals } = aggregate(r.items);
  const kcal = totals.kcal || 0;
  if (kcal <= 0) { alert("目前食譜無熱量,請先輸入克數。"); return; }
  const { der } = resolveDER(currentPet());
  const factor = der / kcal;
  if (!isFinite(factor) || factor <= 0) return;
  for (const it of r.items) {
    const g = parseFloat(it.qty) || 0;
    it.qty = +(g * factor).toFixed(1);
  }
  save(); renderAll();
}

// ===== Actions: recipes (CRUD) =====
function newRecipe() {
  const name = prompt("新食譜名稱:", `食譜 ${currentPet().recipes.length + 1}`);
  if (!name) return;
  const p = currentPet();
  const r = { id: crypto.randomUUID(), name, items: [] };
  p.recipes.push(r);
  p.currentRecipeId = r.id;
  save(); renderAll();
}
function renameRecipe() {
  const r = currentRecipe();
  const name = prompt("重新命名:", r.name);
  if (!name) return;
  r.name = name.trim();
  save(); renderAll();
}
function deleteRecipe() {
  const p = currentPet();
  if (p.recipes.length <= 1) return;
  const r = currentRecipe();
  if (!confirm(`刪除「${r.name}」食譜?`)) return;
  p.recipes = p.recipes.filter(x => x.id !== r.id);
  p.currentRecipeId = p.recipes[0].id;
  save(); renderAll();
}

// ===== Share =====
function buildShareUrl() {
  const p = currentPet();
  const r = currentRecipe();
  const payload = {
    v: 1,
    pet: { name: p.name, weight: p.weight, activity: p.activity, lifeStage: p.lifeStage, conditions: p.conditions },
    recipe: { name: r.name, items: r.items.map(i => ({ n: i.name, q: i.qty })) },
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `${location.origin}${location.pathname}#share=${b64}`;
}
function buildShareText() {
  const p = currentPet();
  const r = currentRecipe();
  const { totals, totalG } = aggregate(r.items);
  const { der } = resolveDER(p);
  const lines = [];
  lines.push(`【${r.name}】`);
  lines.push(`🐶 ${p.name} · ${p.weight}kg · DER ${Math.round(der)} kcal/天`);
  lines.push(`共 ${totalG.toFixed(1)} g · ${(totals.kcal || 0).toFixed(0)} kcal`);
  lines.push(``);
  for (const it of r.items) {
    lines.push(`• ${it.name} ${it.qty} g`);
  }
  const dm = dmbPercent(totals, totalG);
  if (dm) {
    lines.push(``);
    lines.push(`乾物比:蛋白 ${dm.protein.toFixed(1)}% / 脂肪 ${dm.fat.toFixed(1)}% / 碳水 ${dm.carb.toFixed(1)}%`);
  }
  const ca = totals.ca || 0, ph = totals.p || 0;
  if (ca && ph) lines.push(`鈣磷比 ${(ca/ph).toFixed(2)}:1`);
  return lines.join("\n");
}
function openShare() {
  $("#shareUrl").value = buildShareUrl();
  $("#shareText").value = buildShareText();
  $("#shareModal").showModal();
}
function copyField(sel) {
  const el = $(sel);
  el.select();
  navigator.clipboard?.writeText(el.value)
    .then(() => { const btn = sel === "#shareUrl" ? $("#copyUrl") : $("#copyText"); const old = btn.textContent; btn.textContent = "✓ 已複製"; setTimeout(() => btn.textContent = old, 1200); })
    .catch(() => alert("請手動複製"));
}

function tryImportFromHash() {
  const m = location.hash.match(/share=([^&]+)/);
  if (!m) return;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!payload?.recipe?.items) return;
    const msg = `匯入分享食譜:\n「${payload.recipe.name}」\n${payload.recipe.items.length} 項食材,體重 ${payload.pet.weight}kg\n\n匯入到新寵物「${payload.pet.name}」?`;
    if (!confirm(msg)) { history.replaceState(null, "", location.pathname); return; }
    const newPetObj = newPet({
      name: payload.pet.name,
      weight: payload.pet.weight,
      activity: payload.pet.activity || 1.6,
      lifeStage: payload.pet.lifeStage || "maintenance",
      conditions: payload.pet.conditions || [],
    });
    newPetObj.recipes = [{
      id: crypto.randomUUID(),
      name: payload.recipe.name || "匯入食譜",
      items: payload.recipe.items.map(i => ({ name: i.n, qty: i.q })),
    }];
    newPetObj.currentRecipeId = newPetObj.recipes[0].id;
    state.pets.push(newPetObj);
    state.currentId = newPetObj.id;
    save();
    history.replaceState(null, "", location.pathname);
    renderAll();
  } catch (e) {
    console.warn("Share import failed", e);
  }
}

// ===== Pet modal =====
function openPetModal(pet = null) {
  const m = $("#petModal");
  const f = $("#petForm");
  f.reset();
  $("#petModalTitle").textContent = pet ? "編輯 " + pet.name : "新增寵物";
  if (pet) {
    f.name.value = pet.name; f.weight.value = pet.weight; f.activity.value = pet.activity; f.lifeStage.value = pet.lifeStage;
    for (const cb of f.querySelectorAll('input[name="conditions"]')) cb.checked = (pet.conditions || []).includes(cb.value);
  }
  m.dataset.editId = pet?.id || "";
  m.showModal();
}
$("#petCancel").addEventListener("click", () => $("#petModal").close());
$("#petForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  const editId = $("#petModal").dataset.editId;
  const conditions = [...f.querySelectorAll('input[name="conditions"]:checked')].map(c => c.value);
  const data = { name: f.name.value.trim() || "狗狗", weight: +f.weight.value, activity: +f.activity.value, lifeStage: f.lifeStage.value, conditions };
  if (editId) Object.assign(state.pets.find(x => x.id === editId), data);
  else { const p = newPet(data); state.pets.push(p); state.currentId = p.id; }
  save(); $("#petModal").close(); renderAll();
});

// ===== Search =====
function applySearch(q) {
  q = q.trim().toLowerCase();
  for (const btn of $$(".ing-btn")) {
    if (!q) { btn.classList.remove("hidden"); continue; }
    const match = btn.dataset.name.toLowerCase().includes(q)
      || (btn.dataset.en || "").toLowerCase().includes(q)
      || btn.dataset.group.toLowerCase().includes(q);
    btn.classList.toggle("hidden", !match);
  }
}

// ===== Wire up =====
$("#petSelect").addEventListener("change", e => { state.currentId = e.target.value; save(); renderAll(); });
$("#petNew").addEventListener("click", () => openPetModal(null));
$("#petEdit").addEventListener("click", () => openPetModal(currentPet()));
$("#petDelete").addEventListener("click", () => {
  if (state.pets.length <= 1) return;
  const p = currentPet();
  if (!confirm(`刪除「${p.name}」及其全部食譜?`)) return;
  state.pets = state.pets.filter(x => x.id !== p.id);
  state.currentId = state.pets[0].id;
  save(); renderAll();
});
$("#recipeSelect").addEventListener("change", e => { currentPet().currentRecipeId = e.target.value; save(); renderAll(); });
$("#recipeNew").addEventListener("click", newRecipe);
$("#recipeRename").addEventListener("click", renameRecipe);
$("#recipeDelete").addEventListener("click", deleteRecipe);
$("#recipeShare").addEventListener("click", openShare);
$("#copyUrl").addEventListener("click", () => copyField("#shareUrl"));
$("#copyText").addEventListener("click", () => copyField("#shareText"));
$("#shareClose").addEventListener("click", () => $("#shareModal").close());

$("#weight").addEventListener("input", e => {
  currentPet().weight = +e.target.value; save(); renderEnergy(); renderRecipeTotals(); renderSummary(); renderPetBar();
});
$("#activity").addEventListener("change", e => { currentPet().activity = +e.target.value; save(); renderEnergy(); renderRecipeTotals(); renderSummary(); });
$("#lifeStage").addEventListener("change", e => { currentPet().lifeStage = e.target.value; save(); renderSummary(); });
$("#scaleToDER").addEventListener("click", scaleToDER);
$("#clearAll").addEventListener("click", clearRecipe);
$("#search").addEventListener("input", e => applySearch(e.target.value));

renderAll();
tryImportFromHash();
