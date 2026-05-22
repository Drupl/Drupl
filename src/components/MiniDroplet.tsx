import { useEffect, useState } from "react";
import { PixelGrid } from "./PixelGrid";
import type { MascotTint } from "./Mascot";
import { TINTS } from "./Mascot";

// 10x13 tiny droplet — ported from reference/Drupl.html
const TINY_OPEN = [
  "    OO    ",
  "   OBBO   ",
  "  OHBBBO  ",
  " OHBBBBBO ",
  "OHBBBBBBBO",
  "OBBWWBWWBO",
  "OBBPWBPWBO",
  "OBBBBBBBBO",
  "OBBBMMMBBO",
  "OBBBBBBBBO",
  " OBBBBBBO ",
  "  OBBBBO  ",
  "   OOOO   ",
];

const TINY_BLINK = TINY_OPEN.map((row, i) => {
  if (i === 5) return "OBBOOBOOBO";
  if (i === 6) return "OBBBBBBBBO";
  return row;
});

type Props = { pixel?: number; tint?: MascotTint; blink?: boolean };

export function MiniDroplet({ pixel = 4, tint, blink }: Props) {
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (blink !== undefined) return;
    let tid: ReturnType<typeof setTimeout>;
    const tick = () => {
      setAuto(true);
      setTimeout(() => setAuto(false), 140);
      tid = setTimeout(tick, 2400 + Math.random() * 3000);
    };
    tid = setTimeout(tick, 1500 + Math.random() * 2000);
    return () => clearTimeout(tid);
  }, [blink]);

  const isBlinking = blink ?? auto;
  const t = tint ?? TINTS.splash;
  const palette: Record<string, string> = {
    " ": "transparent",
    ".": "transparent",
    O: t.outline,
    B: t.body,
    H: "rgba(255,255,255,0.85)",
    D: t.shadow,
    W: "#f5fbff",
    P: "#0a0f1f",
    M: t.outline,
  };
  return (
    <PixelGrid
      data={isBlinking ? TINY_BLINK : TINY_OPEN}
      pixel={pixel}
      palette={palette}
    />
  );
}
