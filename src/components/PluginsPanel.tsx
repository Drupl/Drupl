import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./PluginsPanel.css";

type Plugin = {
  id: string;
  name: string;
  source: string;
};

type Props = {
  onClose: () => void;
  activeContent?: string;
  onApplyResult?: (text: string) => void;
};

export function PluginsPanel({ onClose, activeContent, onApplyResult }: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await invoke<Plugin[]>("plugin_list");
      setPlugins(list);
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleLoad() {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Load Drupl plugin (.wasm)",
        filters: [{ name: "WebAssembly", extensions: ["wasm"] }],
      });
      if (!selected || typeof selected !== "string") return;
      await invoke<Plugin>("plugin_load", { path: selected });
      await refresh();
    } catch (err) {
      setError(`load failed: ${String(err)}`);
    }
  }

  async function handleUnload(id: string) {
    try {
      await invoke("plugin_unload", { id });
      await refresh();
    } catch (err) {
      setError(`unload failed: ${String(err)}`);
    }
  }

  async function handleApply(id: string) {
    if (activeContent === undefined || !onApplyResult) {
      setError("no active buffer to apply to");
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const result = await invoke<string>("plugin_transform", {
        id,
        input: activeContent,
      });
      onApplyResult(result);
      onClose();
    } catch (err) {
      setError(`apply failed: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  const filtered = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.source.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="plugins-overlay" onClick={onClose}>
      <div className="plugins-modal" onClick={(e) => e.stopPropagation()}>
        <header className="plugins-header">
          <span className="plugins-title">▸ plugins</span>
          <span className="plugins-sub">wasm sandbox · v0 abi</span>
          <div className="plugins-spacer" />
          <button className="plugins-load" onClick={handleLoad} title="Load a .wasm plugin">
            + load .wasm
          </button>
          <button className="plugins-close" onClick={onClose} title="Close">
            ×
          </button>
        </header>

        <div className="plugins-search">
          <input
            type="text"
            placeholder="search plugins…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <div className="plugins-error">{error}</div>}

        <ul className="plugins-list">
          {filtered.map((p) => {
            const isBundled = p.source === "bundled";
            return (
              <li key={p.id} className="plugin-item">
                <div className="plugin-info">
                  <div className="plugin-name">
                    {p.name}
                    <span className="plugin-author">
                      · {isBundled ? "bundled" : "loaded"}
                    </span>
                  </div>
                  <div className="plugin-desc" title={p.source}>
                    {isBundled
                      ? "uppercase the active buffer (sample plugin)"
                      : p.source}
                  </div>
                </div>
                <button
                  className="plugin-apply"
                  onClick={() => handleApply(p.id)}
                  disabled={busy !== null || activeContent === undefined}
                >
                  {busy === p.id ? "…" : "▶ apply"}
                </button>
                {!isBundled && (
                  <button
                    className="plugin-toggle"
                    onClick={() => handleUnload(p.id)}
                    title="Unload plugin"
                  >
                    unload
                  </button>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="plugin-empty">
              {plugins.length === 0
                ? "no plugins loaded yet — try “+ load .wasm”"
                : `no plugins match “${query}”`}
            </li>
          )}
        </ul>

        <footer className="plugins-footer">
          plugin abi v0 — exports: <code>memory</code>, <code>alloc(size)</code>, <code>transform(ptr, len) → i64</code>
        </footer>
      </div>
    </div>
  );
}
