import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./ContextMenu.css";

export type ContextMenuItem =
  | {
      type?: "item";
      label: string;
      hint?: string;
      disabled?: boolean;
      danger?: boolean;
      onSelect: () => void;
    }
  | { type: "separator" };

type MenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
} | null;

type Ctx = {
  show: (e: React.MouseEvent | MouseEvent, items: ContextMenuItem[]) => void;
};

const ContextMenuContext = createContext<Ctx | null>(null);

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  defaultItems?: () => ContextMenuItem[];
};

export function ContextMenuProvider({ children, defaultItems }: ProviderProps) {
  const [menu, setMenu] = useState<MenuState>(null);
  const handledRef = useRef(false);

  const show = useCallback(
    (e: React.MouseEvent | MouseEvent, items: ContextMenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      handledRef.current = true;
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [],
  );

  // Suppress native browser context menu app-wide; fall back to defaultItems
  // when no nested handler claimed the event.
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if (handledRef.current) {
        handledRef.current = false;
        return;
      }
      e.preventDefault();
      const items = defaultItems?.() ?? [];
      if (items.length === 0) {
        setMenu(null);
        return;
      }
      setMenu({ x: e.clientX, y: e.clientY, items });
    }
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [defaultItems]);

  return (
    <ContextMenuContext.Provider value={{ show }}>
      {children}
      {menu && (
        <ContextMenuPopup
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </ContextMenuContext.Provider>
  );
}

type PopupProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

function ContextMenuPopup({ x, y, items, onClose }: PopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [focusIdx, setFocusIdx] = useState(-1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (nx + rect.width + 4 > vw) nx = Math.max(4, vw - rect.width - 4);
    if (ny + rect.height + 4 > vh) ny = Math.max(4, vh - rect.height - 4);
    setPos({ x: nx, y: ny });
  }, [x, y, items]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => nextSelectable(items, i, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => nextSelectable(items, i, -1));
      } else if (e.key === "Enter") {
        const it = items[focusIdx];
        if (it && it.type !== "separator" && !it.disabled) {
          e.preventDefault();
          it.onSelect();
          onClose();
        }
      }
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [items, focusIdx, onClose]);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      {items.map((it, i) => {
        if (it.type === "separator") {
          return <div key={i} className="ctx-sep" role="separator" />;
        }
        const disabled = !!it.disabled;
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={disabled}
            className={`ctx-item${it.danger ? " danger" : ""}${focusIdx === i ? " focus" : ""}`}
            onMouseEnter={() => setFocusIdx(i)}
            onClick={() => {
              if (disabled) return;
              it.onSelect();
              onClose();
            }}
          >
            <span className="ctx-label">{it.label}</span>
            {it.hint && <span className="ctx-hint">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function nextSelectable(items: ContextMenuItem[], from: number, dir: 1 | -1): number {
  const n = items.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + dir * step + n) % n;
    const it = items[idx];
    if (it.type !== "separator" && !it.disabled) return idx;
  }
  return from;
}
