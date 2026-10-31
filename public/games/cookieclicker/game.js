"use strict";

// ---------- Einstellungen ----------

const SAVE_KEY = "cookieClicker.save.v1";
const AUTOSAVE_INTERVAL = 10_000;
const COST_GROWTH = 1.15;
const ACHIEVEMENT_BONUS = 0.01;
const GOLDEN_DELAY = [60, 150];
const GOLDEN_LIFETIME = 13;
const COOKIE_ICON = "img/cookie.webp";

// ---------- Zahlen ----------

const UNITS = ["Mio.", "Mrd.", "Bio.", "Brd.", "Trio.", "Trd.", "Quadrio.", "Quadrd.", "Quintio.", "Quintd."];

function fmt(n, decimals = 0) {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1e6) return n.toLocaleString("de-DE", { maximumFractionDigits: decimals });
  const group = Math.floor(Math.log10(n) / 3) - 2;
  if (group >= UNITS.length) return n.toExponential(2).replace(".", ",");
  const value = n / 10 ** ((group + 2) * 3);
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${UNITS[group]}`;
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} Std. ${m} Min.`;
  if (m > 0) return `${m} Min. ${s} s`;
  return `${s} s`;
}

const rand = (min, max) => min + Math.random() * (max - min);

// ---------- Spielinhalte ----------

const BUILDINGS = [
  { id: "ausstechform", name: "Ausstechform", cost: 15, cps: 0.1, text: "Sticht in aller Ruhe Kekse aus." },
  { id: "nudelholz", name: "Omas Nudelholz", cost: 100, cps: 1, text: "Oma rollt den Teig, wie früher." },
  { id: "keksofen", name: "Blech-Keksofen", cost: 1100, cps: 8, text: "Ein ganzes Blech auf einmal." },
  { id: "stempelmaschine", name: "Keks-Stempel-Maschine", cost: 12_000, cps: 47, text: "Stempelt Muster im Akkord." },
  { id: "mischbatterie", name: "Schoko-Misch-Batterie", cost: 130_000, cps: 260, text: "Rührt Schokolade in riesigen Tanks." },
  { id: "tunnelofen", name: "Industrie-Tunnelofen", cost: 1.4e6, cps: 1400, text: "Ein Förderband, das nie stillsteht." },
  { id: "plantage", name: "Kakao-Plantage", cost: 2e7, cps: 7800, text: "Kakao direkt vom Baum." },
  { id: "labor", name: "Gentech-Krümel-Labor", cost: 3.3e8, cps: 44_000, text: "Züchtet Kekse in der Petrischale." },
  { id: "drucker", name: "Keks-Drucker 3D", cost: 5.1e9, cps: 260_000, text: "Druckt Kekse Schicht für Schicht." },
  { id: "schwerelos", name: "Schwerelosigkeits-Bäcker", cost: 7.5e10, cps: 1.6e6, text: "Backt im Orbit – nichts brennt an." },
  { id: "reaktor", name: "Quanten-Keks-Reaktor", cost: 1e12, cps: 1e7, text: "Kekse, die gleichzeitig gebacken sind und nicht." },
  { id: "synthesizer", name: "Anti-Materie-Schoko-Synthesizer", cost: 1.4e13, cps: 6.5e7, text: "Schokolade aus dem Nichts." },
  { id: "beschleuniger", name: "Keks-Teilchenbeschleuniger", cost: 1.7e14, cps: 4.3e8, text: "Schießt Krümel fast mit Lichtgeschwindigkeit." },
].map((b) => ({ ...b, icon: `img/${b.id}.webp` }));

// Jede Stufe verdoppelt die Produktion eines Gebäudes.
const TIERS = [
  { need: 1, price: 10, label: "I" },
  { need: 5, price: 50, label: "II" },
  { need: 25, price: 500, label: "III" },
  { need: 50, price: 50_000, label: "IV" },
  { need: 100, price: 5e6, label: "V" },
  { need: 150, price: 5e8, label: "VI" },
];

const CLICK_UPGRADES = [
  { id: "click-0", name: "Stärkerer Finger", cost: 100, clickMult: 2, desc: "Klicks bringen doppelt so viel." },
  { id: "click-1", name: "Flinke Hände", cost: 500, clickMult: 2, desc: "Klicks bringen doppelt so viel." },
  { id: "click-2", name: "Beidhändig backen", cost: 10_000, clickMult: 2, desc: "Klicks bringen doppelt so viel." },
  { id: "click-3", name: "Goldener Finger", cost: 100_000, cpsShare: 0.01, desc: "Jeder Klick bringt zusätzlich 1 % deiner Produktion pro Sekunde." },
  { id: "click-4", name: "Keks-Magnet", cost: 1e7, cpsShare: 0.01, desc: "Jeder Klick bringt zusätzlich 1 % deiner Produktion pro Sekunde." },
  { id: "click-5", name: "Krümel-Telekinese", cost: 1e9, cpsShare: 0.01, desc: "Jeder Klick bringt zusätzlich 1 % deiner Produktion pro Sekunde." },
  { id: "click-6", name: "Hand des Bäckers", cost: 1e11, cpsShare: 0.01, desc: "Jeder Klick bringt zusätzlich 1 % deiner Produktion pro Sekunde." },
  { id: "click-7", name: "Klick der Unendlichkeit", cost: 1e13, cpsShare: 0.01, desc: "Jeder Klick bringt zusätzlich 1 % deiner Produktion pro Sekunde." },
];

const UPGRADES = [
  ...CLICK_UPGRADES.map((u) => ({
    ...u,
    icon: COOKIE_ICON,
    label: "",
    isVisible: () => state.totalBaked >= u.cost * 0.4,
  })),
  {
    id: "lucky-0", name: "Glückskekse", cost: 77_777, icon: COOKIE_ICON, label: "★",
    desc: "Goldene Kekse erscheinen doppelt so oft.",
    isVisible: () => state.goldenClicks >= 1,
  },
  {
    id: "lucky-1", name: "Goldene Ausdauer", cost: 7.77e6, icon: COOKIE_ICON, label: "★★",
    desc: "Goldene Kekse bleiben doppelt so lange.",
    isVisible: () => state.goldenClicks >= 5,
  },
  ...BUILDINGS.flatMap((b) => TIERS.map((tier, i) => ({
    id: `${b.id}-${i}`,
    name: `${b.name} ${tier.label}`,
    cost: b.cost * tier.price,
    icon: b.icon,
    label: tier.label,
    desc: `${b.name} produziert doppelt so viel.`,
    isVisible: () => state.owned[b.id] >= tier.need,
  }))),
];

const UPGRADE_IDS = new Set(UPGRADES.map((u) => u.id));

const milestones = (list, make) => list.map(([n, name]) => ({ name, ...make(n) }));

const ACHIEVEMENTS = [
  ...milestones(
    [[1, "Erster Keks"], [1e3, "Hobbybäcker"], [1e5, "Konditormeister"], [1e7, "Keksfabrikant"],
      [1e9, "Keks-Imperium"], [1e12, "Krümelmonopol"], [1e15, "Keks-Universum"]],
    (n) => ({
      id: `baked-${n}`,
      desc: n === 1 ? "Backe deinen ersten Cookie." : `Backe insgesamt ${fmt(n)} Cookies.`,
      test: () => state.totalBaked >= n,
    }),
  ),
  ...milestones(
    [[100, "Klickfinger"], [1000, "Sehnenscheide"], [10_000, "Dauerklicker"]],
    (n) => ({ id: `clicks-${n}`, desc: `Klicke ${fmt(n)}-mal auf den Keks.`, test: () => state.clicks >= n }),
  ),
  ...milestones(
    [[10, "Läuft von selbst"], [1000, "Fließband"], [1e6, "Massenproduktion"], [1e9, "Keks-Tsunami"]],
    (n) => ({ id: `cps-${n}`, desc: `Backe ${fmt(n)} Cookies pro Sekunde.`, test: () => baseCps() >= n }),
  ),
  ...milestones(
    [[1, "Glückspilz"], [10, "Goldrausch"], [50, "Midas"]],
    (n) => ({
      id: `golden-${n}`,
      desc: n === 1 ? "Erwische einen goldenen Keks." : `Erwische ${n} goldene Kekse.`,
      test: () => state.goldenClicks >= n,
    }),
  ),
  ...BUILDINGS.map((b) => ({
    id: `own-${b.id}`,
    name: b.name,
    desc: `Besitze 1 × ${b.name}.`,
    test: () => state.owned[b.id] >= 1,
  })),
];

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

// ---------- Spielstand ----------

function freshState() {
  return {
    cookies: 0,
    totalBaked: 0,
    handmade: 0,
    clicks: 0,
    goldenClicks: 0,
    owned: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
    upgrades: new Set(),
    achievements: new Set(),
    startedAt: Date.now(),
    savedAt: Date.now(),
  };
}

function loadState() {
  const s = freshState();
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) return s;
    for (const key of ["cookies", "totalBaked", "handmade", "clicks", "goldenClicks", "startedAt", "savedAt"]) {
      if (Number.isFinite(data[key])) s[key] = data[key];
    }
    for (const b of BUILDINGS) {
      s.owned[b.id] = Math.max(0, Math.floor(Number(data.owned?.[b.id]) || 0));
    }
    s.upgrades = new Set((data.upgrades ?? []).filter((id) => UPGRADE_IDS.has(id)));
    s.achievements = new Set((data.achievements ?? []).filter((id) => ACHIEVEMENT_IDS.has(id)));
  } catch {
    // Kaputter oder fehlender Spielstand: mit einem neuen anfangen.
  }
  return s;
}

function saveState() {
  state.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      ...state,
      upgrades: [...state.upgrades],
      achievements: [...state.achievements],
    }));
    return true;
  } catch {
    return false;
  }
}

let state = loadState();
let buffs = [];
let buyAmount = 1;

// ---------- Produktion ----------

const has = (id) => state.upgrades.has(id);

function buildingCps(b) {
  let mult = 1 + state.achievements.size * ACHIEVEMENT_BONUS;
  TIERS.forEach((_, i) => {
    if (has(`${b.id}-${i}`)) mult *= 2;
  });
  return b.cps * mult;
}

const baseCps = () => BUILDINGS.reduce((sum, b) => sum + state.owned[b.id] * buildingCps(b), 0);

const buffFactor = (kind) => buffs.reduce((m, buff) => (buff.kind === kind ? m * buff.factor : m), 1);

const currentCps = () => baseCps() * buffFactor("cps");

function clickValue() {
  let mult = 1;
  let share = 0;
  for (const u of CLICK_UPGRADES) {
    if (!has(u.id)) continue;
    if (u.clickMult) mult *= u.clickMult;
    if (u.cpsShare) share += u.cpsShare;
  }
  return (mult + currentCps() * share) * buffFactor("click");
}

function buildingCost(b, amount = buyAmount) {
  const price = b.cost * COST_GROWTH ** state.owned[b.id];
  return Math.ceil(price * (COST_GROWTH ** amount - 1) / (COST_GROWTH - 1));
}

function earn(amount) {
  state.cookies += amount;
  state.totalBaked += amount;
}

function addBuff(id, name, kind, factor, seconds) {
  buffs = buffs.filter((buff) => buff.id !== id);
  buffs.push({ id, name, kind, factor, endsAt: Date.now() + seconds * 1000 });
}

// ---------- Oberfläche ----------

const els = {
  score: document.getElementById("score"),
  perSecond: document.getElementById("perSecond"),
  buffs: document.getElementById("buffs"),
  cookie: document.getElementById("cookieButton"),
  stats: document.getElementById("stats"),
  achievements: document.getElementById("achievements"),
  achievementCount: document.getElementById("achievementCount"),
  upgrades: document.getElementById("upgrades"),
  upgradeInfo: document.getElementById("upgradeInfo"),
  buildings: document.getElementById("buildings"),
  buyAmount: document.querySelector(".buy-amount"),
  toasts: document.getElementById("toasts"),
};

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function toast(title, text) {
  const el = document.createElement("div");
  el.className = "toast";
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.append(strong, text);
  els.toasts.append(el);
  while (els.toasts.children.length > 4) els.toasts.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

function floatText(text, x, y) {
  const el = document.createElement("span");
  el.className = "float-text";
  el.textContent = text;
  el.style.left = `${x + rand(-14, 14)}px`;
  el.style.top = `${y}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 900);
}

// Gebäude: Zeilen einmal anlegen, danach nur noch aktualisieren.
const buildingRows = BUILDINGS.map((b) => {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "building";
  row.innerHTML = `
    <img src="${b.icon}" alt="" draggable="false" />
    <span>
      <span class="name"></span>
      <span class="desc"></span>
      <span class="price"><img src="${COOKIE_ICON}" alt="" /><span></span></span>
    </span>
    <span class="owned"></span>`;
  row.addEventListener("click", () => buyBuilding(b));
  els.buildings.append(row);
  return {
    b,
    row,
    name: row.querySelector(".name"),
    desc: row.querySelector(".desc"),
    price: row.querySelector(".price span"),
    owned: row.querySelector(".owned"),
  };
});

function renderBuildings() {
  let mysteryShown = false;
  for (const { b, row, name, desc, price, owned } of buildingRows) {
    const count = state.owned[b.id];
    const revealed = count > 0 || b === BUILDINGS[0] || state.totalBaked >= b.cost * 0.5;
    const mystery = !revealed && !mysteryShown;
    if (mystery) mysteryShown = true;

    row.hidden = !revealed && !mystery;
    row.disabled = mystery;
    row.classList.toggle("mystery", mystery);
    if (row.hidden) continue;

    const cost = buildingCost(b);
    row.classList.toggle("unaffordable", state.cookies < cost);
    setText(price, buyAmount > 1 ? `${fmt(cost)} (×${buyAmount})` : fmt(cost));
    setText(owned, count > 0 ? String(count) : "");

    if (mystery) {
      setText(name, "???");
      setText(desc, "Noch unbekannt – back weiter!");
    } else {
      const each = buildingCps(b);
      const total = count > 0 ? ` · gesamt ${fmt(each * count, 1)}/s` : "";
      setText(name, b.name);
      setText(desc, `${b.text} ${fmt(each, 1)}/s je Stück${total}`);
    }
  }
}

function buyBuilding(b) {
  const cost = buildingCost(b);
  if (state.cookies < cost) return;
  state.cookies -= cost;
  state.owned[b.id] += buyAmount;
  render();
}

// Verbesserungen: Kacheln nur neu bauen, wenn sich die Auswahl ändert.
let upgradeKey = "";

const availableUpgrades = () => UPGRADES
  .filter((u) => !has(u.id) && u.isVisible())
  .sort((a, b) => a.cost - b.cost);

function renderUpgrades() {
  const available = availableUpgrades();
  const key = available.map((u) => u.id).join();
  if (key !== upgradeKey) {
    upgradeKey = key;
    els.upgradeInfo.hidden = available.length === 0;
    els.upgrades.replaceChildren(...available.map((u) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "upgrade";
      tile.dataset.id = u.id;
      tile.title = `${u.name}: ${u.desc}`;
      tile.innerHTML = `
        <img src="${u.icon}" alt="" draggable="false" />
        <span class="tier">${u.label}</span>
        <span class="price">${fmt(u.cost)}</span>`;
      tile.setAttribute("aria-label", `${u.name}, ${fmt(u.cost)} Cookies. ${u.desc}`);
      return tile;
    }));
  }
  for (const tile of els.upgrades.children) {
    const u = UPGRADES.find((x) => x.id === tile.dataset.id);
    tile.classList.toggle("unaffordable", state.cookies < u.cost);
  }
}

function showUpgradeInfo(u) {
  els.upgradeInfo.innerHTML =
    `<strong>${u.name}</strong> – ${u.desc} Preis: <img src="${COOKIE_ICON}" alt="" /> ${fmt(u.cost)}`;
}

function buyUpgrade(u) {
  if (has(u.id) || state.cookies < u.cost) return;
  state.cookies -= u.cost;
  state.upgrades.add(u.id);
  toast("Verbesserung gekauft", u.name);
  render();
}

const achievementItems = new Map(ACHIEVEMENTS.map((a) => {
  const li = document.createElement("li");
  const strong = document.createElement("strong");
  strong.textContent = a.name;
  li.append(strong, a.desc);
  els.achievements.append(li);
  return [a.id, li];
}));

function renderAchievements() {
  for (const [id, li] of achievementItems) li.classList.toggle("unlocked", state.achievements.has(id));
  setText(els.achievementCount, `(${state.achievements.size}/${ACHIEVEMENTS.length})`);
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.has(a.id) || !a.test()) continue;
    state.achievements.add(a.id);
    toast("Erfolg freigeschaltet", `${a.name} – +1 % Produktion`);
  }
}

function renderStats() {
  const buildings = BUILDINGS.reduce((sum, b) => sum + state.owned[b.id], 0);
  const rows = [
    ["Insgesamt gebacken", fmt(Math.floor(state.totalBaked))],
    ["Von Hand gebacken", fmt(Math.floor(state.handmade))],
    ["Klicks", fmt(state.clicks)],
    ["Pro Klick", fmt(clickValue(), 1)],
    ["Gebäude", fmt(buildings)],
    ["Verbesserungen", `${state.upgrades.size} / ${UPGRADES.length}`],
    ["Goldene Kekse", fmt(state.goldenClicks)],
    ["Bonus durch Erfolge", `+${Math.round(state.achievements.size * ACHIEVEMENT_BONUS * 100)} %`],
    ["Spielzeit", fmtDuration((Date.now() - state.startedAt) / 1000)],
  ];
  els.stats.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

function renderBuffs() {
  const now = Date.now();
  els.buffs.innerHTML = buffs
    .map((buff) => `<li>${buff.name} ×${buff.factor} · ${Math.ceil((buff.endsAt - now) / 1000)} s</li>`)
    .join("");
}

function renderScore() {
  const cookies = fmt(Math.floor(state.cookies));
  setText(els.score, `${cookies} ${Math.floor(state.cookies) === 1 ? "Cookie" : "Cookies"}`);
  setText(els.perSecond, `${fmt(currentCps(), 1)} pro Sekunde`);
  document.title = `${cookies} Cookies – Cookie Clicker`;
}

function render() {
  checkAchievements();
  renderScore();
  renderBuildings();
  renderUpgrades();
  renderAchievements();
  renderStats();
  renderBuffs();
}

// ---------- Goldener Keks ----------

let golden = null;
let goldenTimer = 0;
let nextGoldenAt = Date.now() + goldenDelay();

function goldenDelay() {
  const seconds = rand(...GOLDEN_DELAY);
  return (has("lucky-0") ? seconds / 2 : seconds) * 1000;
}

function spawnGolden() {
  const size = 84;
  golden = document.createElement("button");
  golden.type = "button";
  golden.className = "golden-cookie";
  golden.setAttribute("aria-label", "Goldener Keks");
  golden.innerHTML = `<img src="${COOKIE_ICON}" alt="" draggable="false" />`;
  golden.style.left = `${rand(16, Math.max(16, innerWidth - size - 16))}px`;
  golden.style.top = `${rand(80, Math.max(80, innerHeight - size - 16))}px`;
  golden.addEventListener("click", (event) => {
    claimGolden(event.clientX, event.clientY);
    removeGolden();
  });
  document.body.append(golden);
  const lifetime = GOLDEN_LIFETIME * (has("lucky-1") ? 2 : 1);
  goldenTimer = setTimeout(removeGolden, lifetime * 1000);
}

function removeGolden() {
  if (!golden) return;
  clearTimeout(goldenTimer);
  const el = golden;
  golden = null;
  el.disabled = true;
  el.classList.add("leaving");
  setTimeout(() => el.remove(), 600);
  nextGoldenAt = Date.now() + goldenDelay();
}

function claimGolden(x, y) {
  state.goldenClicks += 1;
  const roll = Math.random();
  if (roll < 0.45) {
    const gain = Math.min(state.cookies * 0.15, currentCps() * 900) + 13;
    earn(gain);
    floatText(`+${fmt(gain)}`, x, y);
    toast("Glückstreffer!", `+${fmt(gain)} Cookies`);
  } else if (roll < 0.85) {
    addBuff("frenzy", "Backrausch", "cps", 7, 77);
    toast("Backrausch!", "Produktion ×7 für 77 Sekunden.");
  } else {
    addBuff("click-frenzy", "Klickrausch", "click", 777, 13);
    toast("Klickrausch!", "Klicks ×777 für 13 Sekunden.");
  }
  render();
}

// ---------- Spielschleife ----------

let lastTick = Date.now();

function tick() {
  const now = Date.now();
  buffs = buffs.filter((buff) => buff.endsAt > now);
  earn(currentCps() * (now - lastTick) / 1000);
  lastTick = now;
  if (!golden && now >= nextGoldenAt) spawnGolden();
}

let lastFullRender = 0;

function frame() {
  tick();
  if (Date.now() - lastFullRender > 200) {
    render();
    lastFullRender = Date.now();
  } else {
    renderScore();
  }
  requestAnimationFrame(frame);
}

function saveNow() {
  tick();
  return saveState();
}

// ---------- Eingaben ----------

els.cookie.addEventListener("click", (event) => {
  const value = clickValue();
  earn(value);
  state.handmade += value;
  state.clicks += 1;

  // Tastatur-Klicks haben keine Mausposition: dann mittig über dem Keks.
  const rect = els.cookie.getBoundingClientRect();
  const x = event.detail ? event.clientX : rect.left + rect.width / 2;
  const y = event.detail ? event.clientY : rect.top + rect.height / 3;
  floatText(`+${fmt(value, 1)}`, x, y);
  renderScore();
});

els.upgrades.addEventListener("click", (event) => {
  const tile = event.target.closest(".upgrade");
  if (tile) buyUpgrade(UPGRADES.find((u) => u.id === tile.dataset.id));
});

for (const type of ["pointerover", "focusin"]) {
  els.upgrades.addEventListener(type, (event) => {
    const tile = event.target.closest(".upgrade");
    if (tile) showUpgradeInfo(UPGRADES.find((u) => u.id === tile.dataset.id));
  });
}

els.buyAmount.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  buyAmount = Number(button.dataset.amount);
  for (const b of els.buyAmount.children) b.setAttribute("aria-pressed", String(b === button));
  renderBuildings();
});

document.getElementById("saveButton").addEventListener("click", () => {
  toast(saveNow() ? "Gespeichert" : "Speichern fehlgeschlagen", "Dein Spielstand liegt in diesem Browser.");
});

document.getElementById("resetButton").addEventListener("click", () => {
  if (!confirm("Wirklich ganz von vorn anfangen? Dein Spielstand geht verloren.")) return;
  state = freshState();
  buffs = [];
  removeGolden();
  saveState();
  render();
  toast("Neues Spiel", "Viel Spaß beim Backen!");
});

setInterval(saveNow, AUTOSAVE_INTERVAL);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveNow();
});
window.addEventListener("pagehide", saveNow);

// ---------- Start ----------

const awaySeconds = (Date.now() - state.savedAt) / 1000;
const offlineGain = baseCps() * awaySeconds;
if (awaySeconds > 5 && offlineGain >= 1) {
  earn(offlineGain);
  toast("Willkommen zurück!", `In ${fmtDuration(awaySeconds)} hat deine Bäckerei ${fmt(offlineGain)} Cookies gebacken.`);
}

render();
requestAnimationFrame(frame);
