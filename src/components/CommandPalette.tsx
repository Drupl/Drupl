import { useEffect, useRef, useState } from "react";
import "./CommandPalette.css";

export type Command = {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

type Props = {
  commands: Command[];
  onClose: () => void;
};

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\s+/).filter(Boolean);
}

function score(cmd: Command, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const haystack = `${cmd.label} ${cmd.group ?? ""}`.toLowerCase();
  for (const t of tokens) {
    if (!haystack.includes(t)) return 0;
  }
  // Bonus for matches at word boundaries
  let bonus = 0;
  for (const t of tokens) {
    if (cmd.label.toLowerCase().startsWith(t)) bonus += 3;
    else if (cmd.label.toLowerCase().includes(` ${t}`)) bonus += 1;
  }
  return 10 + bonus;
}

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const tokens = tokenize(query);
  const filtered = commands
    .map((c) => ({ cmd: c, s: score(c, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.cmd);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function execute(cmd: Command) {
    if (cmd.disabled) return;
    onClose();
    void cmd.run();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) execute(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <input
          className="cmd-input"
          placeholder="type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />
        <ul className="cmd-list" ref={listRef}>
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className={`cmd-item ${selected === i ? "selected" : ""} ${cmd.disabled ? "disabled" : ""}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => execute(cmd)}
            >
              <span className="cmd-label">{cmd.label}</span>
              {cmd.group && <span className="cmd-group">{cmd.group}</span>}
              {cmd.hint && <span className="cmd-hint">{cmd.hint}</span>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="cmd-empty">no commands match “{query}”</li>
          )}
        </ul>
        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
