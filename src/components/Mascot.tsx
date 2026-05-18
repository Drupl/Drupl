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

const PALETTE: Record<string, string> = {
  " ": "transparent",
  ".": "transparent",
  O: "var(--outline)",
  B: "var(--water)",
  H: "rgba(255,255,255,0.85)",
  D: "var(--water-dk)",
  W: "#f5fbff",
  P: "#0a0f1f",
  M: "var(--water-dp)",
  C: "var(--pink)",
};

type Props = { pixel?: number };

export function Mascot({ pixel = 10 }: Props) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
      tid = setTimeout(tick, 2200 + Math.random() * 2400);
    };
    tid = setTimeout(tick, 1800);
    return () => clearTimeout(tid);
  }, []);

  return <PixelGrid data={blink ? MASCOT_BLINK : MASCOT_OPEN} pixel={pixel} palette={PALETTE} />;
}
