import { useEffect, useState } from "react";
import { PixelGrid } from "./PixelGrid";

// 20x22 pixel droplet — ported from reference/Drupl.html
// O outline, B body, H highlight, W eye-white, P pupil, M mouth, C cheek, D shadow
const MASCOT_OPEN = [
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

const MASCOT_BLINK = MASCOT_OPEN.map((row, i) => {
  if (i === 8) return " OBBOOBBBBBBBBOOBBO ";
  if (i === 9) return " OBBBBBBBBBBBBBBBBO ";
  return row;
});

export type MascotTint = {
  body: string;
  shadow: string;
  outline: string;
};

export const TINTS = {
  splash: { body: "#5cc9ff", shadow: "#2a6fbf", outline: "#163a78" },
  sunny: { body: "#ffd86b", shadow: "#c49a3a", outline: "#5c3f10" },
  fern: { body: "#a8f0c5", shadow: "#3e9e6c", outline: "#114a2a" },
  poppy: { body: "#ff9bb3", shadow: "#c44868", outline: "#5e1a31" },
} as const;

function paletteFor(tint?: MascotTint): Record<string, string> {
  const t = tint ?? TINTS.splash;
  return {
    " ": "transparent",
    ".": "transparent",
    O: t.outline,
    B: t.body,
    H: "rgba(255,255,255,0.85)",
    D: t.shadow,
    W: "#f5fbff",
    P: "#0a0f1f",
    M: t.outline,
    C: "var(--pink)",
  };
}

type Props = { pixel?: number; tint?: MascotTint; blink?: boolean };

export function Mascot({ pixel = 10, tint, blink }: Props) {
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (blink !== undefined) return;
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      setAuto(true);
      setTimeout(() => setAuto(false), 140);
      tid = setTimeout(tick, 2200 + Math.random() * 2400);
    };
    tid = setTimeout(tick, 1800);
    return () => clearTimeout(tid);
  }, [blink]);

  const isBlinking = blink ?? auto;
  return (
    <PixelGrid
      data={isBlinking ? MASCOT_BLINK : MASCOT_OPEN}
      pixel={pixel}
      palette={paletteFor(tint)}
    />
  );
}
