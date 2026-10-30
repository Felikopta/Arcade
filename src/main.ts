import "./style.css";

import { run } from "./shell/loop";
import { onUnlock, unlock } from "./shell/achievements";
import { LakeScene } from "./hub/scenery";
import { toast } from "./hub/hub";
import { startRouter } from "./hub/router";

const backdrop = document.querySelector<HTMLCanvasElement>("#scene")!;
const hub = document.querySelector<HTMLElement>("#hub")!;
const stage = document.querySelector<HTMLElement>("#stage")!;

// Genau einmal anmelden: jeder Erfolg, egal aus welchem Spiel, wird gemeldet.
onUnlock(toast);

// Die Kulisse laeuft ueber dieselbe Shell wie jedes Spiel.
const scene = new LakeScene(backdrop);
scene.onDuckPoke = () => void unlock("arcade.duck-whisperer");
run(scene, backdrop);

startRouter({ hub, stage });
