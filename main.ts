// The World in a Day — Monday, 23 November 2026.
// A one-page newspaper image summing up six verified stories from that day.
// Node 22, standard library only. Deterministic: no clock, no randomness,
// no network. Draws entry.png (1024x1024) with its own PNG encoder
// (node:zlib) and its own 5x7 bitmap font.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

// ---------- palette ----------
const PAPER: RGB = [247, 241, 222];
const CARD: RGB = [255, 255, 255];
const INK: RGB = [26, 36, 51];
const NAVY: RGB = [20, 38, 63];
const GOLD: RGB = [201, 162, 39];
const GREY: RGB = [93, 109, 126];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const BLUE: RGB = [46, 134, 193];
const GREEN: RGB = [34, 153, 84];
const RED: RGB = [192, 57, 43];
const ORANGE: RGB = [211, 84, 0];
const YELLOW: RGB = [241, 196, 15];
const SAFFRON: RGB = [255, 153, 51];
const INDIA_GREEN: RGB = [19, 136, 8];
const CRIMSON: RGB = [220, 20, 60];
const SLATE: RGB = [93, 109, 126];
const DARKSLATE: RGB = [44, 62, 80];
const WOOD: RGB = [232, 201, 122];
const MAROON: RGB = [128, 0, 32];
const PURPLE: RGB = [125, 60, 152];
const TEAL: RGB = [20, 143, 119];
const ROCK: RGB = [169, 132, 103];
const ROCKDARK: RGB = [120, 90, 68];

// ---------- raster helpers ----------
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const pts: Array<[number, number]> = [[x0, y0], [x1, y1], [x2, y2]].sort((a, b) => a[1] - b[1]);
  const [ax, ay] = pts[0];
  const [bx, by] = pts[1];
  const [cx, cy] = pts[2];
  const lerp = (xa: number, ya: number, xb: number, yb: number, y: number): number =>
    yb === ya ? xa : xa + ((xb - xa) * (y - ya)) / (yb - ya);
  for (let y = ay; y <= cy; y++) {
    let xa: number;
    let xb: number;
    if (y < by) {
      xa = lerp(ax, ay, bx, by, y);
      xb = lerp(ax, ay, cx, cy, y);
    } else {
      xa = lerp(bx, by, cx, cy, y);
      xb = lerp(ax, ay, cx, cy, y);
    }
    const x0f = Math.min(xa, xb);
    const x1f = Math.max(xa, xb);
    fillRect(Math.round(x0f), y, Math.round(x1f) - Math.round(x0f) + 1, 1, c);
  }
}

function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const half = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    fillRect(x - half, y - half, t, t, c);
  }
}

// Five-pointed star, filled as a fan of triangles from its centre.
function star(cx: number, cy: number, rOuter: number, rInner: number, c: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i < 10; i++) {
    triangle(cx, cy, pts[i][0], pts[i][1], pts[(i + 1) % 10][0], pts[(i + 1) % 10][1], c);
  }
}

// ---------- 5x7 bitmap font ----------
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
};

function text(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let col = 0; col < 5; col++) {
          if (row[col] === "#") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function textCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  text(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// ---------- PNG encoder ----------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePNG(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(buf.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const comp = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", comp), pngChunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------- stories: six verified Monday 23 November 2026 stories ----------
// 1. COP31 collapses in Antalya — no deal after two days of overtime; longest COP ever,
//    first major breakdown since COP15 (CNN, 22 Nov; AFP fallout 23 Nov 02:00).
// 2. Cikande candy factory fire, Indonesia — toll rises: 7 dead, 50 missing
//    (Jagran Josh school assembly news, 23 Nov; up from 3 dead, 36 missing on 22 Nov).
// 3. Nepal PM Balendra Shah holds bilateral talks with PM Modi in New Delhi, 23 Nov
//    (Observer Voice / Daily Jagran, 23 Nov; state visit 22-23 Nov).
// 4. "El Chapo Isidro" captured — FBI top-10 most wanted Fausto Isidro Meza Flores
//    seized in Guasave, Sinaloa; 11 killed in the raid (WSJ / AP, 21-22 Nov; still
//    leading the 23 Nov news cycle).
// 5. Strait of Hormuz tankers hit — at least 25 tankers struck in and around the
//    strait in seven days; UKMTO reports two more struck Saturday (23 Nov briefing).
// 6. BepiColombo orbits Mercury — ESA/JAXA probe enters orbit after an 8-year trip;
//    thruster glitch reported on entry (Reuters / Nature, 21-22 Nov).
type Story = { accent: RGB; lines: string[]; sub: string[]; pic: string };
const STORIES: Story[] = [
  { accent: RED, lines: ["COP31 COLLAPSES", "NO DEAL IN ANTALYA"], sub: ["LONGEST COP EVER ENDS", "FOSSIL FUEL SPLIT"], pic: "globe" },
  { accent: ORANGE, lines: ["CIKANDE FIRE TOLL", "RISES TO 7 DEAD"], sub: ["50 STILL MISSING", "INDONESIA"], pic: "factory" },
  { accent: BLUE, lines: ["NEPAL PM MEETS MODI", "TALKS IN NEW DELHI"], sub: ["STATE VISIT, DAY 2"], pic: "flags" },
  { accent: MAROON, lines: ["EL CHAPO ISIDRO", "CAPTURED"], sub: ["FBI MOST-WANTED SEIZED", "11 KILLED IN RAID"], pic: "badge" },
  { accent: TEAL, lines: ["HORMUZ TANKERS HIT", "25 STRUCK IN A WEEK"], sub: ["GULF OIL FLOW FALLS"], pic: "tanker" },
  { accent: PURPLE, lines: ["BEPICOLOMBO ORBITS", "MERCURY"], sub: ["8-YEAR TRIP ENDS", "THRUSTER GLITCH NOTED"], pic: "planet" },
];

// ---------- pictograms (drawn, no copied art) ----------
function pic(kind: string, cx: number, cy: number): void {
  if (kind === "globe") {
    circle(cx, cy, 46, BLUE);
    circle(cx - 14, cy - 10, 12, GREEN);
    fillRect(cx + 6, cy + 8, 22, 10, GREEN);
    circle(cx + 18, cy - 18, 9, GREEN);
    line(cx - 41, cy - 20, cx + 41, cy - 20, 3, WHITE);
    line(cx - 45, cy + 2, cx + 45, cy + 2, 3, WHITE);
    line(cx - 38, cy + 22, cx + 38, cy + 22, 3, WHITE);
    circle(cx + 34, cy + 30, 16, INK);
    circle(cx + 34, cy + 30, 13, WHITE);
    line(cx + 34, cy + 30, cx + 34, cy + 19, 3, INK);
    line(cx + 34, cy + 30, cx + 42, cy + 34, 3, INK);
    circle(cx + 34, cy + 30, 2, INK);
  } else if (kind === "factory") {
    fillRect(cx - 58, cy + 6, 96, 46, SLATE);
    triangle(cx - 58, cy + 6, cx - 34, cy - 18, cx - 10, cy + 6, SLATE);
    triangle(cx - 10, cy + 6, cx + 14, cy - 18, cx + 38, cy + 6, SLATE);
    fillRect(cx + 44, cy - 34, 14, 86, DARKSLATE);
    circle(cx + 51, cy - 42, 9, GREY);
    circle(cx + 56, cy - 56, 6, GREY);
    circle(cx + 46, cy - 66, 4, GREY);
    triangle(cx - 44, cy - 2, cx - 30, cy - 34, cx - 16, cy - 2, ORANGE);
    triangle(cx - 14, cy - 2, cx - 2, cy - 44, cx + 10, cy - 2, RED);
    triangle(cx + 12, cy - 2, cx + 24, cy - 28, cx + 36, cy - 2, YELLOW);
    fillRect(cx - 48, cy + 20, 14, 14, YELLOW);
    fillRect(cx - 20, cy + 20, 14, 14, YELLOW);
    fillRect(cx + 8, cy + 20, 14, 14, YELLOW);
  } else if (kind === "flags") {
    line(cx - 44, cy - 52, cx - 44, cy + 52, 4, INK);
    line(cx + 36, cy - 52, cx + 36, cy + 52, 4, INK);
    triangle(cx - 44, cy - 52, cx - 44, cy - 30, cx - 6, cy - 41, CRIMSON);
    triangle(cx - 44, cy - 30, cx - 44, cy - 8, cx - 6, cy - 19, CRIMSON);
    fillRect(cx - 40, cy - 52, 4, 4, GOLD);
    fillRect(cx + 36, cy - 52, 52, 12, SAFFRON);
    fillRect(cx + 36, cy - 40, 52, 12, WHITE);
    fillRect(cx + 36, cy - 28, 52, 12, INDIA_GREEN);
    circle(cx + 62, cy - 34, 5, NAVY);
  } else if (kind === "badge") {
    circle(cx, cy, 46, GOLD);
    circle(cx, cy, 38, MAROON);
    star(cx, cy, 30, 13, GOLD);
    circle(cx, cy, 6, MAROON);
  } else if (kind === "tanker") {
    fillRect(cx - 58, cy + 8, 100, 26, DARKSLATE);
    triangle(cx + 42, cy + 8, cx + 66, cy + 8, cx + 42, cy + 34, DARKSLATE);
    fillRect(cx + 22, cy - 24, 26, 32, WHITE);
    fillRect(cx + 27, cy - 19, 7, 7, INK);
    fillRect(cx + 37, cy - 19, 7, 7, INK);
    line(cx + 35, cy - 24, cx + 35, cy - 34, 2, INK);
    circle(cx + 35, cy - 37, 3, RED);
    fillRect(cx - 44, cy - 16, 12, 24, SLATE);
    circle(cx - 38, cy - 24, 8, GREY);
    circle(cx - 32, cy - 36, 6, GREY);
    circle(cx - 42, cy - 44, 4, GREY);
    fillRect(cx - 30, cy + 8, 12, 10, YELLOW);
    fillRect(cx - 10, cy + 8, 12, 10, YELLOW);
    fillRect(cx + 10, cy + 8, 12, 10, YELLOW);
    line(cx - 64, cy + 44, cx - 30, cy + 44, 3, BLUE);
    line(cx - 16, cy + 48, cx + 18, cy + 48, 3, BLUE);
    line(cx + 30, cy + 44, cx + 64, cy + 44, 3, BLUE);
  } else if (kind === "planet") {
    circle(cx, cy, 46, ROCK);
    circle(cx - 16, cy - 12, 10, ROCKDARK);
    circle(cx + 12, cy + 8, 13, ROCKDARK);
    circle(cx + 18, cy - 20, 7, ROCKDARK);
    circle(cx - 4, cy + 20, 6, ROCKDARK);
    circle(cx + 30, cy - 2, 5, ROCKDARK);
    fillRect(cx + 44, cy - 38, 20, 20, NAVY);
    fillRect(cx + 26, cy - 32, 18, 6, GOLD);
    fillRect(cx + 64, cy - 32, 18, 6, GOLD);
    line(cx + 54, cy - 38, cx + 54, cy - 52, 3, INK);
    circle(cx + 54, cy - 55, 4, RED);
  }
}

// ---------- layout ----------
function drawPanel(x: number, y: number, w: number, h: number, s: Story, n: number): void {
  fillRect(x, y, w, h, CARD);
  fillRect(x, y, w, 12, s.accent);
  for (let i = 0; i < 3; i++) {
    line(x, y + i, x + w - 1, y + i, 1, INK);
    line(x, y + h - 1 - i, x + w - 1, y + h - 1 - i, 1, INK);
    line(x + i, y, x + i, y + h - 1, 1, INK);
    line(x + w - 1 - i, y, x + w - 1 - i, y + h - 1, 1, INK);
  }
  circle(x + 26, y + 32, 14, s.accent);
  text(x + 26 - 3, y + 32 - 7, String(n), 2, WHITE);
  pic(s.pic, x + Math.floor(w / 2), y + 72);
  let ty = y + 136;
  for (const ln of s.lines) {
    textCentered(x + Math.floor(w / 2), ty, ln, 3, INK);
    ty += 27;
  }
  ty = y + 196;
  for (const ln of s.sub) {
    textCentered(x + Math.floor(w / 2), ty, ln, 2, GREY);
    ty += 18;
  }
}

function draw(): void {
  fillRect(0, 0, W, H, PAPER);
  fillRect(0, 0, W, 138, NAVY);
  textCentered(512, 26, "THE WORLD IN A DAY", 6, WHITE);
  textCentered(512, 86, "MONDAY, 23 NOVEMBER 2026", 3, GOLD);
  fillRect(0, 138, W, 6, GOLD);
  const xs = [16, 520];
  const ys = [160, 436, 712];
  let n = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      drawPanel(xs[c], ys[r], 488, 260, STORIES[n], n + 1);
      n++;
    }
  }
  textCentered(512, 992, "SIX STORIES - MONDAY, 23 NOVEMBER 2026 - DRAWN BY AN AI AGENT", 2, INK);
}

function main(): void {
  draw();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} ${png.length} bytes sha256 ${sha}`);
}

main();
