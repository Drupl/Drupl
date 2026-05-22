import { useState } from "react";
import { TerminalPanel } from "./TerminalPanel";
import "./TerminalDock.css";

type Props = {
  cwd?: string;
  onClose: () => void;
};

type Term = { id: string };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TerminalDock({ cwd, onClose }: Props) {
  const [terms, setTerms] = useState<Term[]>(() => [{ id: newId() }]);
  const [activeId, setActiveId] = useState<string>(() => terms[0].id);

  function addTerminal() {
    const id = newId();
    setTerms((prev) => [...prev, { id }]);
    setActiveId(id);
  }

  function closeTerminal(id: string) {
    setTerms((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        onClose();
        return prev;
      }
      if (activeId === id) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  }

  return (
    <div className="terminal-dock">
      <div className="terminal-dock-tabs">
        {terms.map((t, i) => (
          <button
            key={t.id}
            className={`terminal-tab ${activeId === t.id ? "active" : ""}`}
            onClick={() => setActiveId(t.id)}
          >
            <span className="terminal-tab-label">▸ term {i + 1}</span>
            <span
              className="terminal-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(t.id);
              }}
              title="Close terminal"
            >
              ×
            </span>
          </button>
        ))}
        <button
          className="terminal-dock-add"
          onClick={addTerminal}
          title="New terminal"
        >
          +
        </button>
        <div className="terminal-dock-spacer" />
        <button
          className="terminal-dock-close"
          onClick={onClose}
          title="Close terminal panel (⌘`)"
        >
          ×
        </button>
      </div>
      <div className="terminal-dock-body">
        {terms.map((t) => (
          <TerminalPanel key={t.id} cwd={cwd} visible={t.id === activeId} />
        ))}
      </div>
    </div>
  );
}
