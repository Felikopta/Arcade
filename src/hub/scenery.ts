/**
 * Die Kulisse des Hubs: ein Bergsee im Morgenlicht.
 *
 * Bewusst als Game ueber die Shell gebaut - der Hub ist damit der erste
 * echte Test von loop.ts. Berge, Spiegelung und Schilf werden einmal auf
 * eine Offscreen-Flaeche gezeichnet (die aendern sich nur bei Resize),
 * pro Frame bewegen sich nur Wasser, Wolken, Voegel und Enten.
 */

import type { Game } from "../shell/loop";
import { fitCanvas } from "../shell/loop";

const HORIZON = 0.6; // Wasserlinie, Anteil der Hoehe
const SLICE = 4; // Hoehe einer Spiegelungs-Scheibe in CSS-Pixeln

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
}

interface Bird {
  /** Platz in der Formation, relativ zum Anfuehrer */
  dx: number;
  dy: number;
  phase: number;
  flap: number;
}

/** Voegel ziehen in Keilen, nicht einzeln. Der Keil wandert, die Tiere halten Position. */
interface Flock {
  x: number;
  y: number;
  speed: number;
  scale: number;
  birds: Bird[];
}

type DuckMode = "paddle" | "dabble" | "preen";

interface Duck {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  scale: number;
  bob: number;
  mode: DuckMode;
  timer: number;
  female: boolean;
  wake: number;
}

/** Kleiner, schneller Zufall mit festem Samen: die Berge sehen immer gleich aus. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bergruecken per Mittelpunktverschiebung: wenige Zahlen, trotzdem organisch. */
function ridge(width: number, height: number, roughness: number, rand: () => number) {
  const points = new Float32Array(129);
  points[0] = height * (0.4 + rand() * 0.3);
  points[128] = height * (0.4 + rand() * 0.3);

  for (let step = 64; step >= 1; step >>= 1) {
    const amplitude = height * roughness * (step / 64);
    for (let i = step; i < 128; i += step * 2) {
      const left = points[i - step] ?? 0;
      const right = points[i + step] ?? 0;
      points[i] = (left + right) / 2 + (rand() - 0.5) * amplitude;
    }
  }

  return Array.from(points, (y, i) => ({
    x: (i / 128) * width,
    y: Math.max(height * 0.08, y),
  }));
}

export class LakeScene implements Game {
  private ctx!: CanvasRenderingContext2D;
  private backdrop: HTMLCanvasElement = document.createElement("canvas");
  private width = 0;
  private height = 0;
  private time = 0;

  private clouds: Cloud[] = [];
  private flocks: Flock[] = [];
  private ducks: Duck[] = [];

  private parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private readonly reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Wird gerufen, wenn jemand eine Ente erwischt. */
  onDuckPoke: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  init(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.resize();

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointer, { passive: true });
    window.addEventListener("pointerdown", this.handlePoke);
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("pointermove", this.handlePointer);
    window.removeEventListener("pointerdown", this.handlePoke);
  }

  private handleResize = () => this.resize();

  private handlePointer = (e: PointerEvent) => {
    // Die Berge folgen der Maus ein Stueck weit - sehr dezent.
    this.parallax.targetX = (e.clientX / window.innerWidth - 0.5) * 18;
    this.parallax.targetY = (e.clientY / window.innerHeight - 0.5) * 8;
  };

  private handlePoke = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea")) return;

    for (const duck of this.ducks) {
      const size = 26 * duck.scale;
      if (Math.abs(e.clientX - duck.x) < size && Math.abs(e.clientY - duck.y) < size) {
        duck.mode = "dabble";
        duck.timer = 1.6;
        this.onDuckPoke?.();
        return;
      }
    }
  };

  private resize() {
    const size = fitCanvas(this.canvas, this.ctx);
    if (size.width === this.width && size.height === this.height) return;

    this.width = size.width;
    this.height = size.height;
    this.paintBackdrop();
    this.populate();
  }

  // ---------------------------------------------------------------- Aufbau

  private populate() {
    const rand = mulberry32(99);
    const waterTop = this.height * HORIZON;

    this.clouds = Array.from({ length: 6 }, () => ({
      x: rand() * this.width,
      y: this.height * (0.08 + rand() * 0.3),
      scale: 0.6 + rand() * 1.1,
      speed: 2 + rand() * 4,
      alpha: 0.07 + rand() * 0.13,
    }));

    this.flocks = Array.from({ length: 3 }, () => {
      const size = 5 + Math.floor(rand() * 5);
      return {
        x: rand() * this.width,
        y: this.height * (0.1 + rand() * 0.4),
        speed: 10 + rand() * 16,
        scale: 0.55 + rand() * 0.6,
        birds: Array.from({ length: size }, (_, i) => {
          // i = 0 ist der Anfuehrer, danach abwechselnd links und rechts zurueck.
          const rank = Math.ceil(i / 2);
          const side = i % 2 === 0 ? -1 : 1;
          return {
            dx: -rank * (15 + rand() * 5),
            dy: side * rank * (7 + rand() * 3),
            phase: rand() * Math.PI * 2,
            flap: 6 + rand() * 3,
          };
        }),
      };
    });

    const duckCount = this.width < 700 ? 3 : 5;
    this.ducks = Array.from({ length: duckCount }, (_, i) => ({
      x: this.width * (0.12 + rand() * 0.76),
      y: waterTop + (this.height - waterTop) * (0.25 + (i / duckCount) * 0.6) + rand() * 20,
      dir: rand() > 0.5 ? 1 : -1,
      speed: 4 + rand() * 7,
      scale: 0.75 + rand() * 0.5,
      bob: rand() * Math.PI * 2,
      mode: "paddle" as DuckMode,
      timer: 2 + rand() * 6,
      female: i % 2 === 1,
      wake: 0,
    }));
  }

  /** Himmel, Sonne, Bergketten, Spiegelung, Schilf - alles einmalig. */
  private paintBackdrop() {
    const w = this.width;
    const h = this.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.backdrop.width = Math.max(1, Math.round(w * dpr));
    this.backdrop.height = Math.max(1, Math.round(h * dpr));
    const b = this.backdrop.getContext("2d");
    if (!b) return;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    const waterTop = h * HORIZON;

    // Himmel
    const sky = b.createLinearGradient(0, 0, 0, waterTop);
    sky.addColorStop(0, "#101a30");
    sky.addColorStop(0.4, "#283c60");
    sky.addColorStop(0.72, "#5d6f8d");
    sky.addColorStop(0.9, "#c08a73");
    sky.addColorStop(1, "#f0b98a");
    b.fillStyle = sky;
    b.fillRect(0, 0, w, waterTop);

    const sunX = w * 0.72;
    const sunY = waterTop - h * 0.26;

    // Bergketten: hinten hell und diesig, vorne dunkel
    // haze = die Farbe am Fuss der Kette. Dunst macht den Abstand sichtbar,
    // ohne dass man eine zweite Kette zeichnen muesste.
    const layers = [
      { color: "#93a3ba", haze: "#d2a88a", roughness: 0.5, offset: 0.0, snow: true, seed: 7 },
      { color: "#5f7498", haze: "#9c8291", roughness: 0.62, offset: 0.06, snow: true, seed: 21 },
      { color: "#394c74", haze: "#53597c", roughness: 0.72, offset: 0.13, snow: false, seed: 42 },
      { color: "#1d2a45", haze: "#2a3250", roughness: 0.85, offset: 0.2, snow: false, seed: 64 },
    ];

    const reflections: Array<{ path: Path2D; color: string }> = [];

    for (const [index, layer] of layers.entries()) {
      // Die Sonne steht zwischen den Ketten: vor dem fernen Dunst,
      // hinter den dunklen Graten im Vordergrund.
      if (index === 2) {
        const glow = b.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.42);
        glow.addColorStop(0, "rgba(255, 226, 180, 0.85)");
        glow.addColorStop(0.22, "rgba(250, 186, 132, 0.34)");
        glow.addColorStop(1, "rgba(246, 176, 124, 0)");
        b.fillStyle = glow;
        b.fillRect(0, 0, w, waterTop);

        b.fillStyle = "#fff0d2";
        b.beginPath();
        b.arc(sunX, sunY, h * 0.03, 0, Math.PI * 2);
        b.fill();
      }

      const rand = mulberry32(layer.seed);
      const peaks = ridge(w, h * 0.42, layer.roughness, rand);
      const baseY = waterTop - h * layer.offset;

      const path = new Path2D();
      path.moveTo(0, waterTop);
      for (const p of peaks) path.lineTo(p.x, baseY - (h * 0.42 - p.y));
      path.lineTo(w, waterTop);
      path.closePath();

      const face = b.createLinearGradient(0, baseY - h * 0.42, 0, waterTop);
      face.addColorStop(0, layer.color);
      face.addColorStop(1, layer.haze);
      b.fillStyle = face;
      b.fill(path);

      if (layer.snow) {
        // Schnee liegt nur auf dem obersten Stueck jedes Gipfels.
        b.save();
        b.clip(path);
        b.fillStyle = "rgba(226, 236, 245, 0.85)";
        for (let i = 1; i < peaks.length - 1; i++) {
          const prev = peaks[i - 1]!;
          const cur = peaks[i]!;
          const next = peaks[i + 1]!;
          const yCur = baseY - (h * 0.42 - cur.y);
          if (cur.y < prev.y && cur.y < next.y && yCur < baseY - h * 0.18) {
            const cap = h * 0.035;
            b.beginPath();
            b.moveTo(cur.x - cap * 0.9, yCur + cap);
            b.lineTo(cur.x, yCur - 2);
            b.lineTo(cur.x + cap * 0.9, yCur + cap);
            b.quadraticCurveTo(cur.x, yCur + cap * 0.45, cur.x - cap * 0.9, yCur + cap);
            b.fill();
          }
        }
        b.restore();
      }

      // dieselbe Silhouette gespiegelt, fuer das Wasser
      const mirrored = new Path2D();
      mirrored.addPath(path, new DOMMatrix().translate(0, 2 * waterTop).scale(1, -1));
      reflections.push({ path: mirrored, color: layer.color });
    }

    // Morgendunst, der sich zwischen den Ketten sammelt.
    const mist = b.createLinearGradient(0, waterTop - h * 0.22, 0, waterTop);
    mist.addColorStop(0, "rgba(236, 178, 136, 0)");
    mist.addColorStop(0.65, "rgba(236, 178, 136, 0.14)");
    mist.addColorStop(1, "rgba(248, 206, 166, 0.3)");
    b.fillStyle = mist;
    b.fillRect(0, waterTop - h * 0.22, w, h * 0.22);

    // Wasser
    const water = b.createLinearGradient(0, waterTop, 0, h);
    water.addColorStop(0, "#44597c");
    water.addColorStop(0.35, "#2a3d5c");
    water.addColorStop(1, "#131f33");
    b.fillStyle = water;
    b.fillRect(0, waterTop, w, h - waterTop);

    // Spiegelung: gedaempft, und nach unten ausblendend
    b.save();
    b.beginPath();
    b.rect(0, waterTop, w, h - waterTop);
    b.clip();
    b.globalAlpha = 0.42;
    for (const r of reflections) {
      b.fillStyle = r.color;
      b.fill(r.path);
    }
    b.globalAlpha = 1;

    const fade = b.createLinearGradient(0, waterTop, 0, h);
    fade.addColorStop(0, "rgba(19, 31, 51, 0)");
    fade.addColorStop(1, "rgba(19, 31, 51, 0.92)");
    b.fillStyle = fade;
    b.fillRect(0, waterTop, w, h - waterTop);

    // Sonnenstrasse auf dem Wasser
    const road = b.createLinearGradient(0, waterTop, 0, h);
    road.addColorStop(0, "rgba(255, 206, 150, 0.26)");
    road.addColorStop(0.45, "rgba(255, 206, 150, 0.1)");
    road.addColorStop(1, "rgba(255, 206, 150, 0)");
    b.fillStyle = road;
    b.beginPath();
    b.moveTo(sunX - w * 0.018, waterTop);
    b.lineTo(sunX + w * 0.018, waterTop);
    b.lineTo(sunX + w * 0.11, h);
    b.lineTo(sunX - w * 0.11, h);
    b.closePath();
    b.fill();
    b.restore();

    // Duenner heller Strich auf der Wasserlinie
    b.fillStyle = "rgba(255, 220, 180, 0.35)";
    b.fillRect(0, waterTop - 1, w, 1.5);

    this.paintReeds(b, w, h);
  }

  /** Schilf am unteren Rand, links dichter als rechts. */
  private paintReeds(b: CanvasRenderingContext2D, w: number, h: number) {
    const rand = mulberry32(3);
    b.strokeStyle = "rgba(12, 22, 18, 0.8)";
    b.lineCap = "round";

    const stalks = Math.round(w / 26);
    for (let i = 0; i < stalks; i++) {
      const edge = rand();
      const x = edge < 0.65 ? rand() * w * 0.3 : w - rand() * w * 0.22;
      const len = h * (0.08 + rand() * 0.16);
      const lean = (rand() - 0.5) * 30;

      b.lineWidth = 1 + rand() * 1.8;
      b.beginPath();
      b.moveTo(x, h + 4);
      b.quadraticCurveTo(x + lean * 0.4, h - len * 0.6, x + lean, h - len);
      b.stroke();

      if (rand() > 0.72) {
        // Rohrkolben
        b.fillStyle = "rgba(42, 28, 18, 0.9)";
        b.beginPath();
        b.ellipse(x + lean, h - len - 5, 2.4, 8, (lean / 30) * 0.3, 0, Math.PI * 2);
        b.fill();
      }
    }
  }

  // --------------------------------------------------------------- Bewegung

  update(dt: number): void {
    this.time += dt;

    this.parallax.x += (this.parallax.targetX - this.parallax.x) * dt * 2.4;
    this.parallax.y += (this.parallax.targetY - this.parallax.y) * dt * 2.4;

    if (this.reduced) return;

    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x - 220 * cloud.scale > this.width) cloud.x = -220 * cloud.scale;
    }

    for (const flock of this.flocks) {
      flock.x += flock.speed * dt;
      for (const bird of flock.birds) bird.phase += bird.flap * dt;

      if (flock.x - 160 > this.width) {
        flock.x = -160;
        flock.y = this.height * (0.1 + Math.random() * 0.4);
      }
    }

    const waterTop = this.height * HORIZON;
    for (const duck of this.ducks) {
      duck.bob += dt * 1.6;
      duck.timer -= dt;

      if (duck.timer <= 0) {
        // Enten gruendeln, putzen sich, und schwimmen dann weiter.
        if (duck.mode === "paddle") {
          duck.mode = Math.random() > 0.45 ? "dabble" : "preen";
          duck.timer = 1.2 + Math.random() * 1.6;
        } else {
          duck.mode = "paddle";
          duck.timer = 3 + Math.random() * 7;
          if (Math.random() > 0.6) duck.dir = duck.dir === 1 ? -1 : 1;
        }
      }

      if (duck.mode === "paddle") {
        duck.x += duck.speed * duck.dir * dt;
        duck.wake = Math.min(1, duck.wake + dt * 1.5);
      } else {
        duck.wake = Math.max(0, duck.wake - dt * 0.8);
      }

      // Am Ufer umdrehen, nicht verschwinden.
      const margin = 40 * duck.scale;
      if (duck.x < margin) {
        duck.x = margin;
        duck.dir = 1;
      } else if (duck.x > this.width - margin) {
        duck.x = this.width - margin;
        duck.dir = -1;
      }

      // Weiter unten = naeher dran = groesser. Der zweite Faktor haelt die
      // Enten auf schmalen Schirmen im Verhaeltnis zu den Bergen.
      const depth = (duck.y - waterTop) / Math.max(1, this.height - waterTop);
      const room = Math.min(1, 0.6 + this.width / 2000);
      duck.scale = (0.85 + depth * 1.15) * room;
    }
  }

  // ---------------------------------------------------------------- Zeichnen

  render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const waterTop = h * HORIZON;

    ctx.clearRect(0, 0, w, h);

    // Himmel + Berge, leicht mit der Maus verschoben
    ctx.save();
    ctx.translate(this.parallax.x * 0.4, this.parallax.y * 0.3);
    ctx.drawImage(this.backdrop, -8, -6, w + 16, waterTop + 12, -8, -6, w + 16, waterTop + 12);
    ctx.restore();

    this.drawClouds(ctx);
    this.drawBirds(ctx);
    this.drawWater(ctx, waterTop);

    for (const duck of [...this.ducks].sort((a, b) => a.y - b.y)) {
      this.drawDuck(ctx, duck);
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D) {
    for (const cloud of this.clouds) {
      const x = cloud.x + this.parallax.x * 0.8;
      const rx = 130 * cloud.scale;
      const ry = 11 * cloud.scale;

      // Weiche Kante per Verlauf: harte Ellipsen sehen nach Aufkleber aus.
      const soft = ctx.createRadialGradient(x, cloud.y, 0, x, cloud.y, rx);
      soft.addColorStop(0, "rgba(246, 223, 200, 1)");
      soft.addColorStop(0.5, "rgba(236, 206, 186, 0.55)");
      soft.addColorStop(1, "rgba(226, 192, 175, 0)");

      ctx.save();
      ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.ellipse(x, cloud.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 55 * cloud.scale, cloud.y + 9 * cloud.scale, rx * 0.6, ry * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBirds(ctx: CanvasRenderingContext2D) {
    // Hell statt schwarz: der Himmel ist hier oben dunkel, eine
    // Silhouette waere unsichtbar.
    ctx.strokeStyle = "rgba(226, 212, 196, 0.42)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const flock of this.flocks) {
      const s = flock.scale * 3.6;
      ctx.lineWidth = Math.max(0.9, flock.scale * 1.2);

      for (const bird of flock.birds) {
        const x = flock.x + bird.dx * flock.scale + this.parallax.x * 1.2;
        const y = flock.y + bird.dy * flock.scale + this.parallax.y * 0.6;
        // Fluegelschlag: die Spitzen gehen hoch und runter, die Mitte bleibt.
        const wing = Math.sin(bird.phase);

        ctx.beginPath();
        ctx.moveTo(x - s * 1.4, y - wing * s * 0.8);
        ctx.quadraticCurveTo(x - s * 0.5, y - wing * s * 0.2, x, y);
        ctx.quadraticCurveTo(x + s * 0.5, y - wing * s * 0.2, x + s * 1.4, y - wing * s * 0.8);
        ctx.stroke();
      }
    }
  }

  /** Wasser in Scheiben: jede verschoben, das ergibt die Wellenbewegung der Spiegelung. */
  private drawWater(ctx: CanvasRenderingContext2D, waterTop: number) {
    const w = this.width;
    const h = this.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (let y = waterTop; y < h; y += SLICE) {
      const depth = (y - waterTop) / (h - waterTop);
      const amplitude = 1.5 + depth * 9;
      const offset = this.reduced
        ? 0
        : Math.sin(this.time * 1.1 + depth * 11) * amplitude +
          Math.sin(this.time * 0.47 + depth * 23) * amplitude * 0.4;

      ctx.drawImage(
        this.backdrop,
        0,
        y * dpr,
        w * dpr,
        SLICE * dpr,
        offset,
        y,
        w,
        SLICE + 0.5,
      );
    }

    // Glitzern auf der Sonnenstrasse
    if (this.reduced) return;
    const sunX = w * 0.72;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 228, 185, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const y = waterTop + 6 + t * (h - waterTop - 6);
      const spread = w * (0.03 + t * 0.14);
      const wobble = Math.sin(this.time * 2.1 + i * 1.7);
      const x = sunX + wobble * spread;
      const len = 4 + Math.abs(Math.cos(this.time * 1.6 + i)) * 14 * (0.4 + t);
      ctx.globalAlpha = 0.18 + Math.abs(wobble) * 0.3 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.lineTo(x + len / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDuck(ctx: CanvasRenderingContext2D, duck: Duck) {
    const s = duck.scale;
    const bob = Math.sin(duck.bob) * 1.6 * s;
    const x = duck.x;
    const y = duck.y + bob;

    const dabble = duck.mode === "dabble" ? 1 : 0;
    const preen = duck.mode === "preen" ? Math.sin(duck.bob * 3) * 0.5 + 0.5 : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(duck.dir * s, s);

    // Kielwasser
    if (duck.wake > 0.02) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      for (const sign of [-1, 1]) {
        // Nach hinten ausbleichen, sonst sehen die Linien aus wie Fuehler.
        const tail = ctx.createLinearGradient(-11, 0, -34, 0);
        tail.addColorStop(0, `rgba(222, 236, 250, ${duck.wake * 0.32})`);
        tail.addColorStop(1, "rgba(222, 236, 250, 0)");
        ctx.strokeStyle = tail;
        ctx.beginPath();
        ctx.moveTo(-11, 3);
        ctx.quadraticCurveTo(-22, 3 + sign * 3, -34, 3 + sign * 7);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Schatten auf dem Wasser
    ctx.fillStyle = "rgba(9, 16, 28, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 15, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyColor = duck.female ? "#7c5a3c" : "#6a5f52";
    const headColor = duck.female ? "#8d6a46" : "#1f6b4a";

    if (dabble) {
      // Kopf unter Wasser, Schwanz in die Luft.
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, 1, 13, 9, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#efe4d4";
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.lineTo(17, -17);
      ctx.lineTo(13, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    // Koerper
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fluegeldecke
    ctx.fillStyle = duck.female ? "#6b4c32" : "#574d42";
    ctx.beginPath();
    ctx.ellipse(-2, -1, 9, 5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Schwanz
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-21, -7);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();

    // Hals + Kopf (beim Putzen dreht sich der Kopf nach hinten)
    const headX = 9 - preen * 13;
    const headY = -9 + preen * 7;

    ctx.strokeStyle = headColor;
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(headX, headY + 2);
    ctx.stroke();

    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 5, 0, Math.PI * 2);
    ctx.fill();

    if (!duck.female) {
      // weisser Halsring
      ctx.strokeStyle = "rgba(240, 240, 235, 0.9)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(headX - 1.5, headY + 4.5, 3.2, -0.4, Math.PI + 0.4);
      ctx.stroke();
    }

    // Schnabel
    ctx.fillStyle = duck.female ? "#9c7a3f" : "#e0a33c";
    ctx.beginPath();
    ctx.moveTo(headX + 3.5, headY - 0.5);
    ctx.lineTo(headX + 11 - preen * 8, headY + 1.5);
    ctx.lineTo(headX + 3.5, headY + 3);
    ctx.closePath();
    ctx.fill();

    // Auge
    ctx.fillStyle = "#10151c";
    ctx.beginPath();
    ctx.arc(headX + 1.8, headY - 1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
