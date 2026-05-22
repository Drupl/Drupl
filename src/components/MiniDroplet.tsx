import { PixelGrid } from "./PixelGrid";
import type { MascotTint } from "./Mascot";
import { TINTS } from "./Mascot";

// 10x13 tiny droplet — ported from reference/Drupl.html
const TINY = [
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

type Props = { pixel?: number; tint?: MascotTint };

export function MiniDroplet({ pixel = 4, tint }: Props) {
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
  return <PixelGrid data={TINY} pixel={pixel} palette={palette} />;
}
