/**
 * Routing ueber den Hash: "#tetris" startet Tetris, "" zeigt den Hub.
 *
 * Spiele werden erst beim Anklicken geladen (dynamic import), und beim
 * Verlassen sauber gestoppt - sonst laufen zwei Loops gleichzeitig.
 */

import { run, type Running } from "../shell/loop";
import { Input } from "../shell/input";
import { markPlayed } from "../shell/achievements";
import { byId, loaders, playable, type GameEntry } from "./games";
import { renderHub } from "./hub";

export interface RouterTargets {
  hub: HTMLElement;
  stage: HTMLElement;
}

/** Hashes, die zu einem Abschnitt der Startseite gehoeren, nicht zu einem Spiel. */
const ANCHORS = new Set(["spiele", "erfolge", "ueber-mich"]);

let running: Running | null = null;
let input: Input | null = null;
let showing: "hub" | "stage" | null = null;

export function startRouter(targets: RouterTargets): void {
  const go = () => void route(targets);
  window.addEventListener("hashchange", go);
  go();
}

async function route(targets: RouterTargets) {
  stopCurrent();

  const id = location.hash.slice(1);

  // Sprungmarke auf der Startseite: Hub stehen lassen, der Browser scrollt selbst.
  if (ANCHORS.has(id) && showing === "hub") return;

  const game = id && !ANCHORS.has(id) ? byId(id) : undefined;

  if (!game) {
    showHub(targets);
    return;
  }

  if (game.status !== "ready") {
    // Noch nicht fertig: zurueck zur Karte, statt eine leere Buehne zu zeigen.
    showHub(targets);
    location.hash = "";
    return;
  }

  await openStage(targets, game);
}

function showHub(targets: RouterTargets) {
  targets.stage.hidden = true;
  targets.stage.innerHTML = "";
  targets.hub.hidden = false;
  document.body.classList.remove("is-playing");

  // Nur neu bauen, wenn wir wirklich von der Buehne kommen - sonst
  // springt bei jedem Ankerklick der Scrollstand.
  if (showing !== "hub") renderHub(targets.hub);
  showing = "hub";
}

async function openStage(targets: RouterTargets, game: GameEntry) {
  targets.hub.hidden = true;
  targets.stage.hidden = false;
  document.body.classList.add("is-playing");
  showing = "stage";

  targets.stage.innerHTML = `
    <div class="stage-bar">
      <a class="stage-back" href="#">← Hub</a>
      <span class="stage-title">${game.title}</span>
      <span class="stage-week">${game.week}</span>
    </div>
    <div class="stage-body"></div>
  `;
  const body = targets.stage.querySelector<HTMLElement>(".stage-body")!;

  markPlayed(game.id, playable().length);

  if (game.kind === "unity") {
    const frame = document.createElement("iframe");
    frame.className = "stage-frame";
    frame.title = game.title;
    frame.allow = "autoplay; fullscreen; gamepad";
    frame.src = `${import.meta.env.BASE_URL}games/${game.build}/index.html`;
    body.append(frame);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "stage-canvas";
  canvas.tabIndex = 0;
  body.append(canvas);
  canvas.focus();

  const load = loaders[game.id];
  if (!load) {
    body.innerHTML = `<p class="stage-missing">Dieses Spiel ist noch nicht eingebunden.</p>`;
    return;
  }

  const module = await load();
  // Der Hash kann sich waehrend des Ladens schon wieder geaendert haben.
  if (location.hash.slice(1) !== game.id) return;

  input = new Input(canvas);
  running = run(new module.default(), canvas);
}

function stopCurrent() {
  running?.stop();
  running = null;
  input?.dispose();
  input = null;
}
