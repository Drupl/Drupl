// Generates a 1024x1024 PNG icon for Drupl from the in-app pixel-mascot data.
// Output: /tmp/drupl-icon-source.png — feed to `npx @tauri-apps/cli icon` next.
//
// macOS does NOT auto-round app icons (unlike iOS) — the rounded squircle
// must be baked into the PNG. We mask the navy backdrop with a rounded
// rectangle and leave the outside transparent.

import fs from "node:fs";
import { PNG } from "pngjs";

const MASCOT = [
  "         OO         ",
  "        OBBO        ",
  "       OHBBBO       ",
  "      OHHBBBBO      ",
  "     OHBBBBBBBO     ",
  "    OHBBBBBBBBBO    ",
  "   OHBBBBBBBBBBBO   ",
  "  OHBBBBBBBBBBBBBO  ",
  " OBBWWBBBBBBBBWWBBO ",
  " OBBPWBBBBBBBBPWBBO ",
  " OBBBBBBBBBBBBBBBBO ",
  " OBBBBBBBBBBBBBBBBO ",
  "OBBCBBBBBBBBBBBBCBBO",
  "OBBCBBBMBBBBBBMBBCBO",
  "OBBBBBBBMMMMMMBBBBBO",
  "OBBBBBBBBBBBBBBBBBBO",
  " OBBBBBBBBBBBBBBBBO ",
  " OBBBBBBBBBBBBBDDBO ",
  "  OBBBBBBBBBBBBDDO  ",
  "   OBBBBBBBBBBBBO   ",
  "    OBBBBBBBBBBO    ",
  "     OOOOOOOOOO     ",
];

const PALETTE = {
  O: [22, 58, 120, 255],
  B: [92, 201, 255, 255],
  H: [232, 245, 255, 220],
  W: [245, 251, 255, 255],
  P: [10, 15, 31, 255],
  M: [22, 58, 120, 255],
  C: [255, 155, 179, 255],
  D: [42, 111, 191, 255],
};

const BG = [11, 18, 38, 255];

const SIZE = 1024;
const COLS = 20;
const ROWS = 22;

// Apple's macOS icon template: 1024×1024 canvas with an 824×824 squircle
// centered inside (100px transparent padding on each side). This places
// Drupl at the same visual scale as every other dock icon.
const PADDING = 100;
const SQUIRCLE_LEFT = PADDING;
const SQUIRCLE_TOP = PADDING;
const SQUIRCLE_RIGHT = SIZE - PADDING;
const SQUIRCLE_BOTTOM = SIZE - PADDING;
const SQUIRCLE_W = SQUIRCLE_RIGHT - SQUIRCLE_LEFT;
const RADIUS = Math.round(SQUIRCLE_W * 0.225);

const CELL = 28; // 28*20 = 560, 28*22 = 616 — droplet inside squircle with inner pad
const SPRITE_W = COLS * CELL;
const SPRITE_H = ROWS * CELL;
const OFFSET_X = Math.floor((SIZE - SPRITE_W) / 2);
const OFFSET_Y = Math.floor((SIZE - SPRITE_H) / 2);

const png = new PNG({ width: SIZE, height: SIZE });

function cornerCoverage(x, y) {
  // Returns alpha multiplier in [0, 1] for a rounded rectangle whose body
  // spans [SQUIRCLE_LEFT, SQUIRCLE_RIGHT) × [SQUIRCLE_TOP, SQUIRCLE_BOTTOM).
  if (x < SQUIRCLE_LEFT || x >= SQUIRCLE_RIGHT) return 0;
  if (y < SQUIRCLE_TOP || y >= SQUIRCLE_BOTTOM) return 0;

  const minX = SQUIRCLE_LEFT + RADIUS;
  const maxX = SQUIRCLE_RIGHT - RADIUS;
  const minY = SQUIRCLE_TOP + RADIUS;
  const maxY = SQUIRCLE_BOTTOM - RADIUS;

  if (x >= minX && x < maxX) return 1;
  if (y >= minY && y < maxY) return 1;

  let cx, cy;
  if (x < minX && y < minY) {
    cx = minX;
    cy = minY;
  } else if (x >= maxX && y < minY) {
    cx = maxX;
    cy = minY;
  } else if (x < minX && y >= maxY) {
    cx = minX;
    cy = maxY;
  } else {
    cx = maxX;
    cy = maxY;
  }
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= RADIUS - 0.5) return 1;
  if (dist >= RADIUS + 0.5) return 0;
  return RADIUS + 0.5 - dist;
}

// Fill background with rounded-rect mask
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cov = cornerCoverage(x, y);
    const i = (y * SIZE + x) * 4;
    if (cov <= 0) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
    } else {
      png.data[i] = BG[0];
      png.data[i + 1] = BG[1];
      png.data[i + 2] = BG[2];
      png.data[i + 3] = Math.round(255 * cov);
    }
  }
}

function blend(dst, src) {
  const a = src[3] / 255;
  return [
    Math.round(src[0] * a + dst[0] * (1 - a)),
    Math.round(src[1] * a + dst[1] * (1 - a)),
    Math.round(src[2] * a + dst[2] * (1 - a)),
    255,
  ];
}

for (let row = 0; row < ROWS; row++) {
  const line = MASCOT[row];
  for (let col = 0; col < COLS; col++) {
    const ch = line[col];
    if (ch === " " || ch === ".") continue;
    const color = PALETTE[ch];
    if (!color) continue;
    const xStart = OFFSET_X + col * CELL;
    const yStart = OFFSET_Y + row * CELL;
    for (let dy = 0; dy < CELL; dy++) {
      for (let dx = 0; dx < CELL; dx++) {
        const x = xStart + dx;
        const y = yStart + dy;
        const cov = cornerCoverage(x, y);
        if (cov <= 0) continue;
        const i = (y * SIZE + x) * 4;
        const dst = [
          png.data[i],
          png.data[i + 1],
          png.data[i + 2],
          png.data[i + 3],
        ];
        const out = color[3] < 255 ? blend(dst, color) : color;
        png.data[i] = out[0];
        png.data[i + 1] = out[1];
        png.data[i + 2] = out[2];
        png.data[i + 3] = Math.round(255 * cov);
      }
    }
  }
}

const outPath = "/tmp/drupl-icon-source.png";
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log(`wrote ${outPath} (${SIZE}×${SIZE}, radius ${RADIUS})`);
