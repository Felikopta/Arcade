/**
 * Baut die Startseite: Kopf, Spielkarten, Erfolge, Ueber-mich.
 * Alles als DOM, kein Framework - und nichts davon blockiert die Szene.
 */

import { GAMES, type GameEntry } from "./games";
import { getScore } from "../shell/save";
import { ACHIEVEMENTS, isUnlocked, playedGames, progress, unlock } from "../shell/achievements";

const STATUS_LABEL: Record<GameEntry["status"], string> = {
  ready: "spielbar",
  next: "diese Woche",
  soon: "kommt",
};

/**
 * Pflichtangabe. Fuer eine kleine private Website verlangt das oesterreichische
 * Mediengesetz (§ 25 Abs 5) Name und Wohnort des Medieninhabers - mehr nicht,
 * solange nichts verkauft und keine Werbung geschaltet wird.
 */
const IMPRESSUM = "Walter Huchl, Graz";

export function renderHub(root: HTMLElement): void {
  // Vor dem Aufbau, damit der Zaehler im Kopf diesen Erfolg schon mitzaehlt.
  unlock("arcade.first-visit");

  root.innerHTML = "";
  root.append(header(), gameGrid(), achievementPanel(), footer());
}

// ------------------------------------------------------------------- Kopf

function header(): HTMLElement {
  const el = document.createElement("header");
  el.className = "hub-header";
  el.innerHTML = `
    <h1>FELIX<span class="dot">·</span>ARCADE</h1>
    <a class="scroll-hint" href="#spiele"><span aria-hidden="true">↓</span> Zu den Spielen</a>
  `;
  return el;
}

// ------------------------------------------------------------------ Karten

function gameGrid(): HTMLElement {
  const section = document.createElement("section");
  section.className = "grid";
  section.id = "spiele";
  section.setAttribute("aria-label", "Spiele");

  const played = new Set(playedGames());
  for (const game of GAMES) section.append(card(game, played.has(game.id)));

  return section;
}

function card(game: GameEntry, wasPlayed: boolean): HTMLElement {
  const locked = game.status !== "ready";
  const el = document.createElement(locked ? "div" : "a") as HTMLAnchorElement;

  el.className = `card card-${game.status}`;
  el.style.setProperty("--accent", game.accent);

  if (!locked) {
    el.href = `#${game.id}`;
    el.setAttribute("aria-label", `${game.title} spielen`);
  }

  const score = getScore(game.id);
  const scoreLine = locked
    ? `<span class="card-when">${game.week} · ${game.dates}</span>`
    : `<span class="card-score">Highscore: ${score.toLocaleString("de-AT")}</span>`;

  el.innerHTML = `
    <div class="card-top">
      <span class="card-week">${game.week}</span>
      <span class="card-status">${STATUS_LABEL[game.status]}</span>
    </div>
    <h2 class="card-title">${game.title}</h2>
    <p class="card-tagline">${game.tagline}</p>
    <p class="card-tech">${game.tech}</p>
    <div class="card-foot">
      ${scoreLine}
      <span class="card-action" aria-hidden="true">${locked ? "···" : "▶"}</span>
    </div>
    ${wasPlayed ? '<span class="card-played" title="schon gespielt">✓</span>' : ""}
  `;
  return el;
}

// ------------------------------------------------------------------ Erfolge

function achievementPanel(): HTMLElement {
  const { done, total } = progress();

  const el = document.createElement("section");
  el.className = "panel";
  el.innerHTML = `
    <details${done > 0 ? "" : ""}>
      <summary>
        <span class="panel-title">Erfolge</span>
        <span class="panel-count">${done} / ${total}</span>
      </summary>
      <ul class="achievements">
        ${ACHIEVEMENTS.map(achievementRow).join("")}
      </ul>
    </details>
  `;
  return el;
}

function achievementRow(a: (typeof ACHIEVEMENTS)[number]): string {
  const got = isUnlocked(a.id);
  const hidden = a.secret && !got;
  return `
    <li class="achievement${got ? " is-unlocked" : ""}">
      <span class="achievement-mark">${got ? "★" : hidden ? "?" : "☆"}</span>
      <span>
        <strong>${hidden ? "Geheimer Erfolg" : a.title}</strong>
        <em>${hidden ? "Finde ihn selbst." : a.hint}</em>
      </span>
    </li>
  `;
}

// ------------------------------------------------------------- Pflichtteil

function footer(): HTMLElement {
  const el = document.createElement("footer");
  el.className = "hub-footer";
  el.innerHTML = `
    <span>Impressum: ${IMPRESSUM} · Private Hobbyseite, keine Werbung, kein Verkauf.</span>
    <span>Keine Cookies, kein Tracking. Spielstände bleiben in deinem Browser.</span>
  `;
  return el;
}

// -------------------------------------------------------------------- Toast

let toastTimer = 0;

export function toast(achievement: { title: string; hint: string }): void {
  let el = document.querySelector<HTMLElement>(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }

  el.innerHTML = `
    <span class="toast-mark">★</span>
    <span><strong>${achievement.title}</strong><em>${achievement.hint}</em></span>
  `;

  // Neustart der Animation erzwingen, falls der naechste Erfolg sofort kommt.
  el.classList.remove("is-visible");
  void el.offsetWidth;
  el.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove("is-visible"), 4200);
}
