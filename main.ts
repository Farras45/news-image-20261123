// The World in a Day — Monday, 23 November 2026
// Renders a 1024x1024 front page with six verified stories, entirely in code.
// Node 22 standard library only: own PNG encoder, own 5x7 bitmap font.
// Output: entry.png in MAKEFUN_OUTPUT_DIR, or the current directory.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

type RGB = [number, number, number];

const W = 1024;
const H = 1024;

const PAPER: RGB = [253, 253, 247];
const INK: RGB = [18, 18, 18];
const GREY: RGB = [110, 110, 105];
const BODY: RGB = [60, 60, 55];
const RED: RGB = [192, 57, 43];
const WHITE: RGB = [255, 255, 255];
const YELLOW: RGB = [243, 156, 18];

const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) set(i, j, c);
  }
}

function hline(x: number, y: number, len: number, c: RGB): void {
  rect(x, y, len, 1, c);
}

function vline(x: number, y: number, len: number, c: RGB): void {
  rect(x, y, 1, len, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) set(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: RGB, t: number): void {
  for (let y = cy - r - t; y <= cy + r + t; y++) {
    for (let x = cx - r - t; x <= cx + r + t; x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (Math.abs(d - r) <= t / 2) set(x, y, c);
    }
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180;
    set(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), c);
  }
}

function edge(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  return (x - ax) * (by - ay) - (y - ay) * (bx - ax);
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const d = edge(x0, y0, x1, y1, x2, y2);
  if (d === 0) return;
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = edge(x1, y1, x2, y2, x, y);
      const w1 = edge(x2, y2, x0, y0, x, y);
      const w2 = edge(x0, y0, x1, y1, x, y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) set(x, y, c);
    }
  }
}

// 5x7 bitmap font: each glyph is 7 rows of 5 bits, top row first.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0e, 0x10, 0x13, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x15, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
};

const BLANK: number[] = [0, 0, 0, 0, 0, 0, 0];

function glyph(ch: string): number[] {
  return FONT[ch] ?? BLANK;
}

function textW(t: string, s: number): number {
  return t.length * 6 * s;
}

function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = glyph(ch);
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if ((g[r] >> (4 - col)) & 1) rect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function drawStr(t: string, x: number, y: number, s: number, c: RGB): void {
  for (let i = 0; i < t.length; i++) drawChar(t[i], x + i * 6 * s, y, s, c);
}

function wrap(t: string, maxW: number, s: number): string[] {
  const words = t.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textW(test, s) <= maxW || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPara(t: string, x: number, y: number, s: number, c: RGB, maxW: number, lh: number): number {
  const lines = wrap(t, maxW, s);
  lines.forEach((ln, i) => drawStr(ln, x, y + i * lh, s, c));
  return y + lines.length * lh;
}

type Story = {
  num: string;
  tag: string;
  head: string;
  body: string;
  accent: RGB;
  tint: RGB;
  icon: string;
};

const STORIES: Story[] = [
  {
    num: "1",
    tag: "CLIMATE",
    head: "COP31 COLLAPSES, NO DEAL",
    body: "Climate talks in Antalya end with no agreement as negotiators walk away.",
    accent: [31, 78, 121],
    tint: [220, 233, 245],
    icon: "globe",
  },
  {
    num: "2",
    tag: "DISASTER",
    head: "CIKANDE FIRE TOLL RISES",
    body: "Seven dead and 50 missing after the candy factory blaze.",
    accent: [192, 57, 43],
    tint: [253, 232, 224],
    icon: "flame",
  },
  {
    num: "3",
    tag: "DIPLOMACY",
    head: "NEPAL PM MEETS MODI",
    body: "Balendra Shah holds bilateral talks with Modi in New Delhi.",
    accent: [30, 132, 73],
    tint: [223, 242, 227],
    icon: "flags",
  },
  {
    num: "4",
    tag: "CRIME",
    head: "'EL CHAPO ISIDRO' SEIZED",
    body: "FBI most-wanted fugitive seized in Sinaloa.",
    accent: [108, 52, 131],
    tint: [239, 227, 245],
    icon: "cuffs",
  },
  {
    num: "5",
    tag: "ENERGY",
    head: "25 TANKERS HIT IN HORMUZ",
    body: "Twenty-five tankers struck in the vital shipping lane.",
    accent: [17, 122, 101],
    tint: [221, 240, 235],
    icon: "ship",
  },
  {
    num: "6",
    tag: "SPACE",
    head: "BEPICOLOMBO AT MERCURY",
    body: "Probe enters orbit after an eight-year journey.",
    accent: [26, 82, 118],
    tint: [221, 232, 240],
    icon: "planet",
  },
];

function drawIcon(cx: number, cy: number, kind: string, c: RGB): void {
  if (kind === "globe") {
    ring(cx, cy, 26, c, 3);
    rect(cx - 26, cy - 1, 53, 3, c);
    ellipse(cx, cy, 12, 26, c);
    ellipse(cx, cy, 26, 10, c);
  } else if (kind === "flame") {
    tri(cx, cy - 30, cx - 20, cy + 20, cx + 20, cy + 20, c);
    tri(cx, cy - 12, cx - 9, cy + 18, cx + 9, cy + 18, YELLOW);
  } else if (kind === "flags") {
    vline(cx - 14, cy - 26, 52, c);
    vline(cx + 14, cy - 26, 52, c);
    rect(cx - 14, cy - 26, 24, 15, [30, 132, 73]);
    rect(cx + 14, cy - 26, 24, 15, YELLOW);
  } else if (kind === "cuffs") {
    ring(cx - 20, cy, 13, c, 3);
    ring(cx + 20, cy, 13, c, 3);
    rect(cx - 8, cy - 3, 16, 6, c);
    disc(cx - 20, cy, 4, c);
    disc(cx + 20, cy, 4, c);
  } else if (kind === "ship") {
    rect(cx - 18, cy - 30, 36, 13, c);
    rect(cx - 8, cy - 40, 18, 10, c);
    rect(cx - 30, cy - 14, 60, 8, c);
    tri(cx - 30, cy - 6, cx + 30, cy - 6, cx + 18, cy + 20, c);
    tri(cx - 30, cy - 6, cx - 18, cy + 20, cx + 18, cy + 20, c);
    hline(cx - 34, cy + 28, 68, GREY);
    hline(cx - 24, cy + 34, 48, GREY);
  } else if (kind === "planet") {
    disc(cx, cy, 20, c);
    ellipse(cx, cy, 34, 12, GREY);
    disc(cx + 30, cy - 6, 4, RED);
  }
}

// Masthead
rect(0, 0, W, 128, INK);
const TITLE = "THE WORLD IN A DAY";
drawStr(TITLE, Math.round((W - textW(TITLE, 5)) / 2), 26, 5, WHITE);
const DATE = "MONDAY, 23 NOVEMBER 2026";
drawStr(DATE, Math.round((W - textW(DATE, 2)) / 2), 84, 2, [205, 205, 195]);
rect(0, 128, W, 5, RED);

// Story grid: 2 columns x 3 rows
const GX = 24;
const GY = 148;
const CW = 476;
const CH = 266;
const CGX = 24;
const CGY = 12;

STORIES.forEach((st, i) => {
  const bx = GX + (i % 2) * (CW + CGX);
  const by = GY + Math.floor(i / 2) * (CH + CGY);
  rect(bx, by, CW, CH, WHITE);
  rect(bx, by, CW, 2, INK);
  rect(bx, by + CH - 2, CW, 2, INK);
  rect(bx, by, 2, CH, INK);
  rect(bx + CW - 2, by, 2, CH, INK);
  rect(bx + 2, by + 2, CW - 4, 86, st.tint);
  drawIcon(bx + 58, by + 45, st.icon, st.accent);
  drawStr(st.num, bx + CW - 46, by + 16, 4, st.accent);
  rect(bx + 2, by + 88, CW - 4, 4, st.accent);
  drawStr(st.tag, bx + 16, by + 106, 2, st.accent);
  let y = drawPara(st.head, bx + 16, by + 128, 3, INK, CW - 32, 27);
  y += 8;
  drawPara(st.body, bx + 16, y, 2, BODY, CW - 32, 19);
});

// Footer
rect(24, 984, 976, 2, GREY);
const FOOT = "SIX VERIFIED STORIES FROM MONDAY 23 NOVEMBER 2026 - RENDERED ENTIRELY BY CODE";
drawStr(FOOT, Math.round((W - textW(FOOT, 2)) / 2), 996, 2, GREY);

// Minimal PNG encoder (RGB, 8-bit, filter 0 per row)
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  Buffer.from(px.buffer, px.byteOffset + y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || process.cwd();
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, png);
console.log(`wrote ${outPath} ${W}x${H} (${png.length} bytes)`);
