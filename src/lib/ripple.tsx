import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import "./ripple.css";

type Ripple = {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
};

type RippleAPI = {
  drop: (x: number, y: number, opts?: { color?: string; size?: number }) => void;
};

const RippleContext = createContext<RippleAPI | null>(null);

let nextId = 1;

export function RippleProvider({ children }: { children: ReactNode }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const drop = useCallback<RippleAPI["drop"]>((x, y, opts) => {
    const id = nextId++;
    const ripple: Ripple = {
      id,
      x,
      y,
      color: opts?.color ?? "var(--water)",
      size: opts?.size ?? 480,
    };
    setRipples((prev) => [...prev, ripple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1200);
  }, []);

  return (
    <RippleContext.Provider value={{ drop }}>
      {children}
      <div className="ripple-host" aria-hidden>
        {ripples.map((r) => (
          <span
            key={r.id}
            className="ripple"
            style={{
              left: r.x,
              top: r.y,
              borderColor: r.color,
              ["--ripple-size" as string]: `${r.size}px`,
            }}
          />
        ))}
      </div>
    </RippleContext.Provider>
  );
}

export function useRipple(): RippleAPI {
  const ctx = useContext(RippleContext);
  if (!ctx) {
    return { drop: () => {} };
  }
  return ctx;
}

export function rippleAtElement(
  el: Element | null,
  drop: RippleAPI["drop"],
  opts?: { color?: string; size?: number },
) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  drop(rect.left + rect.width / 2, rect.top + rect.height / 2, opts);
}

// Auto-attach: re-export for one-line consumer convenience.
export function useRippleOnEvent(event: string, color?: string) {
  const { drop } = useRipple();
  useEffect(() => {
    function handler(e: Event) {
      const ev = e as CustomEvent<{ x: number; y: number }>;
      if (ev.detail) {
        drop(ev.detail.x, ev.detail.y, { color });
      }
    }
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [event, color, drop]);
}
