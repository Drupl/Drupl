import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { listen } from "@tauri-apps/api/event";
import { druplOcean } from "../themes/druplOcean";
import { langForFilename, languageLabel } from "../lib/language";
import { TerminalDock } from "../components/TerminalDock";
import { PluginsPanel } from "../components/PluginsPanel";
import { CommandPalette, type Command } from "../components/CommandPalette";
import { MiniDroplet } from "../components/MiniDroplet";
import { TINTS } from "../components/Mascot";
import { useContextMenu, type ContextMenuItem } from "../components/ContextMenu";
import { useRipple } from "../lib/ripple";
import { useTreeSitter } from "../lib/useTreeSitter";
import { EditorView } from "@codemirror/view";
import type { TsSymbol } from "../lib/tree-sitter";
import type { OpenedFile, OpenedFolder, FolderEntry } from "../App";
import "./EditorScreen.css";

type Props = {
  onBack: () => void;
  initialFile?: OpenedFile;
  initialFolder?: OpenedFolder;
  loadFile: (path: string) => Promise<string>;
  loadDir: (path: string) => Promise<FolderEntry[]>;
  saveFile: (path: string, content: string) => Promise<void>;
  saveFileAs: (defaultName: string, content: string) => Promise<string | null>;
  onNewProject: () => void;
  onNewFile: () => void;
  onOpenFile: () => Promise<void>;
  onOpenFolder: () => Promise<void>;
  droppedFiles: OpenedFile[];
  newFileTick: number;
  onConsumedDropped: () => void;
};

const MASCOT_TSX = `// the droplet who watches you work
import { useTime, useBlink } from "drupl/pixel"

export function Mascot() {
  const blink = useBlink("2-3s")
  return <Droplet blink={blink} />
}

// crew: lin · mira · sam · ren
// last ripple: 4s ago
`;

const APP_TSX = `// drupl app entry
import { Mascot } from "./Mascot"
import { palette } from "./palette.json"

export function App() {
  return (
    <Workspace palette={palette}>
      <Mascot />
    </Workspace>
  )
}
`;

const PALETTE_JSON = `{
  "ocean":  ["#5cc9ff", "#2a6fbf", "#163a78"],
  "sunset": ["#ff8a5b", "#c54a2a", "#7a2818"],
  "forest": ["#7ee5a3", "#2f8a4d", "#14512a"],
  "candy":  ["#ff8ad1", "#c44896", "#741f55"]
}
`;

type FileBuffer = {
  name: string;
  path: string | null;
  content: string;
  originalContent: string;
  iconColor: string;
};

type Pane = { activeIdx: number };

const DEMO_FILES: FileBuffer[] = [
  { name: "App.tsx", path: null, content: APP_TSX, originalContent: APP_TSX, iconColor: "#8a9bc5" },
  { name: "Mascot.tsx", path: null, content: MASCOT_TSX, originalContent: MASCOT_TSX, iconColor: "#5cc9ff" },
  { name: "palette.json", path: null, content: PALETTE_JSON, originalContent: PALETTE_JSON, iconColor: "#ffd86b" },
];

const CREW = [
  { name: "splash", role: "the original droplet", tint: TINTS.splash },
  { name: "sunny", role: "compiler whisperer", tint: TINTS.sunny },
  { name: "fern", role: "plugins & wasm", tint: TINTS.fern },
  { name: "poppy", role: "palette & playgrounds", tint: TINTS.poppy },
];

function iconColorFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return "#5cc9ff";
    case "json":
      return "#ffd86b";
    case "css":
    case "html":
      return "#ff9bb3";
    case "md":
    case "py":
      return "#a8f0c5";
    case "rs":
      return "#ffd86b";
    default:
      return "#8a9bc5";
  }
}

function kindMarker(kind: TsSymbol["kind"]): string {
  switch (kind) {
    case "function":
      return "ƒ";
    case "method":
      return "·";
    case "class":
      return "◇";
    case "struct":
      return "▢";
    case "enum":
      return "Σ";
    case "trait":
      return "≈";
    case "interface":
      return "◇";
    case "type":
      return "τ";
    case "impl":
      return "▶";
  }
}

function bufferFromFile(f: OpenedFile): FileBuffer {
  return {
    name: f.name,
    path: f.path,
    content: f.content,
    originalContent: f.content,
    iconColor: iconColorFor(f.name),
  };
}

type RenderedNode = { entry: FolderEntry; depth: number };

function flattenTree(
  roots: FolderEntry[],
  depth: number,
  expanded: Set<string>,
  childrenMap: Record<string, FolderEntry[]>,
): RenderedNode[] {
  const out: RenderedNode[] = [];
  for (const entry of roots) {
    out.push({ entry, depth });
    if (entry.isDir && expanded.has(entry.path)) {
      const children = childrenMap[entry.path];
      if (children) out.push(...flattenTree(children, depth + 1, expanded, childrenMap));
    }
  }
  return out;
}

export function EditorScreen({
  onBack,
  initialFile,
  initialFolder,
  loadFile,
  loadDir,
  saveFile,
  saveFileAs,
  onNewProject,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  droppedFiles,
  newFileTick,
  onConsumedDropped,
}: Props) {
  const [buffers, setBuffers] = useState<FileBuffer[]>(() => {
    if (initialFile) return [bufferFromFile(initialFile)];
    if (initialFolder) return [];
    return DEMO_FILES;
  });
  const [panes, setPanes] = useState<Pane[]>(() => {
    if (initialFile) return [{ activeIdx: 0 }];
    if (initialFolder) return [{ activeIdx: -1 }];
    return [{ activeIdx: 1 }]; // Mascot.tsx demo
  });
  const [focusedPaneIdx, setFocusedPaneIdx] = useState(0);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, FolderEntry[]>>({});
  const { drop: dropRipple } = useRipple();
  const { show: showContextMenu } = useContextMenu();

  function rippleFromEvent(
    e: React.MouseEvent | undefined,
    fallback?: { x: number; y: number },
    color = "var(--water)",
  ) {
    if (e) {
      dropRipple(e.clientX, e.clientY, { color });
    } else if (fallback) {
      dropRipple(fallback.x, fallback.y, { color });
    } else {
      dropRipple(window.innerWidth / 2, window.innerHeight / 2, { color });
    }
  }

  const focusedPane = panes[focusedPaneIdx] ?? panes[0];
  const activeIdx = focusedPane?.activeIdx ?? -1;
  const active = activeIdx >= 0 ? buffers[activeIdx] : undefined;

  function setActiveOfFocused(idx: number) {
    setPanes((prev) =>
      prev.map((p, i) => (i === focusedPaneIdx ? { activeIdx: idx } : p)),
    );
  }

  function splitRight() {
    if (panes.length >= 2) return;
    setPanes((prev) => [...prev, { activeIdx: prev[focusedPaneIdx].activeIdx }]);
    setFocusedPaneIdx(1);
  }

  function closePane(idx: number) {
    if (panes.length <= 1) return;
    setPanes((prev) => prev.filter((_, i) => i !== idx));
    setFocusedPaneIdx(0);
  }

  async function toggleFolder(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    if (!childrenMap[path]) {
      try {
        const children = await loadDir(path);
        setChildrenMap((prev) => ({ ...prev, [path]: children }));
      } catch (err) {
        console.error("Failed to read directory:", err);
        alert(`Could not read directory:\n${path}\n\n${String(err)}`);
      }
    }
  }

  const menuHandlersRef = useRef<{
    save: () => Promise<void>;
    saveAs: () => Promise<void>;
    splitRight: () => void;
  } | null>(null);

  useEffect(() => {
    const u = listen<string>("menu", (event) => {
      handleMenuPayload(event.payload);
    });
    function onWinMenu(e: Event) {
      const ce = e as CustomEvent<string>;
      handleMenuPayload(ce.detail);
    }
    function handleMenuPayload(payload: string) {
      const h = menuHandlersRef.current;
      switch (payload) {
        case "save":
          if (h) void h.save();
          break;
        case "save_as":
          if (h) void h.saveAs();
          break;
        case "toggle_terminal":
          setTerminalOpen((v) => !v);
          break;
        case "command_palette":
          setPaletteOpen(true);
          break;
        case "split_right":
          if (h) h.splitRight();
          break;
      }
    }
    window.addEventListener("drupl:menu", onWinMenu);
    return () => {
      u.then((f) => f());
      window.removeEventListener("drupl:menu", onWinMenu);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        if (panes.length >= 2) closePane(1);
        else splitRight();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!initialFile) return;
    setBuffers([bufferFromFile(initialFile)]);
    setPanes([{ activeIdx: 0 }]);
    setFocusedPaneIdx(0);
  }, [initialFile?.path, initialFile?.name]);

  useEffect(() => {
    if (!initialFolder) return;
    setBuffers([]);
    setPanes([{ activeIdx: -1 }]);
    setFocusedPaneIdx(0);
  }, [initialFolder?.path]);

  // Drop incoming files (from drag-drop) as new tabs in focused pane
  useEffect(() => {
    if (droppedFiles.length === 0) return;
    setBuffers((prev) => {
      const next = [...prev];
      let lastIdx = -1;
      for (const f of droppedFiles) {
        const existing = next.findIndex((b) => b.path === f.path);
        if (existing >= 0) {
          lastIdx = existing;
        } else {
          next.push(bufferFromFile(f));
          lastIdx = next.length - 1;
        }
      }
      if (lastIdx >= 0) {
        setPanes((prevPanes) =>
          prevPanes.map((p, i) =>
            i === focusedPaneIdx ? { activeIdx: lastIdx } : p,
          ),
        );
      }
      return next;
    });
    onConsumedDropped();
  }, [droppedFiles]);

  // New File: add untitled buffer
  const untitledCounterRef = useRef(0);
  useEffect(() => {
    if (newFileTick === 0) return;
    untitledCounterRef.current += 1;
    const n = untitledCounterRef.current;
    const name = `untitled-${n}.txt`;
    const newBuf: FileBuffer = {
      name,
      path: null,
      content: "",
      originalContent: "",
      iconColor: iconColorFor(name),
    };
    setBuffers((prev) => {
      const next = [...prev, newBuf];
      setPanes((prevPanes) =>
        prevPanes.map((p, i) =>
          i === focusedPaneIdx ? { activeIdx: next.length - 1 } : p,
        ),
      );
      return next;
    });
  }, [newFileTick]);

  function updatePaneContent(paneIdx: number, value: string) {
    const bufIdx = panes[paneIdx]?.activeIdx;
    if (bufIdx == null || bufIdx < 0) return;
    setBuffers((prev) =>
      prev.map((f, i) => (i === bufIdx ? { ...f, content: value } : f)),
    );
  }

  async function handleSave() {
    if (activeIdx < 0) return;
    const buf = buffers[activeIdx];
    if (!buf) return;
    if (!buf.path) {
      await handleSaveAs();
      return;
    }
    try {
      await saveFile(buf.path, buf.content);
      setBuffers((prev) =>
        prev.map((f, i) =>
          i === activeIdx ? { ...f, originalContent: f.content } : f,
        ),
      );
      rippleFromEvent(undefined, undefined, "var(--mint)");
    } catch (err) {
      console.error("save failed:", err);
      alert(`Could not save file:\n${buf.path}\n\n${String(err)}`);
    }
  }

  async function handleSaveAs() {
    if (activeIdx < 0) return;
    const buf = buffers[activeIdx];
    if (!buf) return;
    try {
      const newPath = await saveFileAs(buf.name, buf.content);
      if (!newPath) return;
      const newName = newPath.split(/[\\/]/).pop() || buf.name;
      setBuffers((prev) =>
        prev.map((f, i) =>
          i === activeIdx
            ? {
                ...f,
                path: newPath,
                name: newName,
                originalContent: f.content,
                iconColor: iconColorFor(newName),
              }
            : f,
        ),
      );
    } catch (err) {
      console.error("save as failed:", err);
      alert(`Could not save file:\n${String(err)}`);
    }
  }

  const activeIsDirty =
    active !== undefined && active.content !== active.originalContent;

  const tsInfo = useTreeSitter(active?.name ?? "", active?.content ?? "");
  const paneViewsRef = useRef<Map<number, EditorView>>(new Map());

  function jumpToSymbol(sym: TsSymbol) {
    const view = paneViewsRef.current.get(focusedPaneIdx);
    if (!view) return;
    const line = view.state.doc.line(Math.min(sym.line + 1, view.state.doc.lines));
    view.dispatch({
      selection: { anchor: line.from, head: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }

  menuHandlersRef.current = {
    save: handleSave,
    saveAs: handleSaveAs,
    splitRight,
  };

  async function openFromFolder(entry: FolderEntry) {
    if (entry.isDir) {
      void toggleFolder(entry.path);
      return;
    }
    const existing = buffers.findIndex((b) => b.path === entry.path);
    if (existing >= 0) {
      setActiveOfFocused(existing);
      return;
    }
    try {
      const content = await loadFile(entry.path);
      setBuffers((prev) => {
        const next = [
          ...prev,
          {
            name: entry.name,
            path: entry.path,
            content,
            originalContent: content,
            iconColor: iconColorFor(entry.name),
          },
        ];
        setPanes((prevPanes) =>
          prevPanes.map((p, i) =>
            i === focusedPaneIdx ? { activeIdx: next.length - 1 } : p,
          ),
        );
        return next;
      });
    } catch (err) {
      console.error("Failed to read file:", err);
      alert(`Could not read file:\n${entry.path}\n\n${String(err)}`);
    }
  }

  function closeTabByIdx(idx: number) {
    setBuffers((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPanes((prevPanes) =>
        prevPanes.map((p) => {
          if (p.activeIdx === idx) {
            return { activeIdx: next.length === 0 ? -1 : Math.max(0, idx - 1) };
          } else if (p.activeIdx > idx) {
            return { activeIdx: p.activeIdx - 1 };
          }
          return p;
        }),
      );
      return next;
    });
  }

  function closeOthers(keepIdx: number) {
    setBuffers((prev) => {
      const keep = prev[keepIdx];
      if (!keep) return prev;
      const next = [keep];
      setPanes((prevPanes) => prevPanes.map(() => ({ activeIdx: 0 })));
      return next;
    });
  }

  function closeAllTabs() {
    setBuffers([]);
    setPanes((prevPanes) => prevPanes.map(() => ({ activeIdx: -1 })));
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("clipboard write failed:", err);
    }
  }

  function tabContextItems(idx: number): ContextMenuItem[] {
    const buf = buffers[idx];
    const hasOthers = buffers.length > 1;
    return [
      {
        label: "Close",
        hint: "⌘W",
        onSelect: () => closeTabByIdx(idx),
      },
      {
        label: "Close Others",
        disabled: !hasOthers,
        onSelect: () => closeOthers(idx),
      },
      {
        label: "Close All",
        disabled: buffers.length === 0,
        danger: true,
        onSelect: closeAllTabs,
      },
      { type: "separator" },
      {
        label: "Copy Path",
        disabled: !buf?.path,
        onSelect: () => buf?.path && void copyToClipboard(buf.path),
      },
      {
        label: "Copy File Name",
        disabled: !buf,
        onSelect: () => buf && void copyToClipboard(buf.name),
      },
      { type: "separator" },
      {
        label: panes.length >= 2 ? "Close Split" : "Split Right",
        hint: "⌘\\",
        onSelect: () => (panes.length >= 2 ? closePane(1) : splitRight()),
      },
    ];
  }

  function treeContextItems(entry: FolderEntry): ContextMenuItem[] {
    return [
      {
        label: entry.isDir ? (expanded.has(entry.path) ? "Collapse" : "Expand") : "Open",
        onSelect: () => void openFromFolder(entry),
      },
      { type: "separator" },
      {
        label: "Copy Path",
        onSelect: () => void copyToClipboard(entry.path),
      },
      {
        label: "Copy Name",
        onSelect: () => void copyToClipboard(entry.name),
      },
    ];
  }

  function closeTab(idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    setBuffers((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPanes((prevPanes) =>
        prevPanes.map((p) => {
          if (p.activeIdx === idx) {
            return {
              activeIdx: next.length === 0 ? -1 : Math.max(0, idx - 1),
            };
          } else if (p.activeIdx > idx) {
            return { activeIdx: p.activeIdx - 1 };
          }
          return p;
        }),
      );
      return next;
    });
  }

  const mode: "folder" | "file" | "demo" =
    initialFolder ? "folder" : initialFile ? "file" : "demo";

  return (
    <div className="editor">
      <aside className="editor-sidebar">
        <button className="editor-back" onClick={onBack} title="Back to welcome">
          ← drupl
        </button>

        <div className="editor-section-head">Explorer</div>
        <ul className="editor-tree">
          {mode === "folder" && initialFolder && (
            <>
              <li className="tree-folder" title={initialFolder.path}>
                <span className="tree-icon tree-icon-folder" />
                <span>{initialFolder.name}/</span>
              </li>
              {flattenTree(initialFolder.entries, 1, expanded, childrenMap).map(
                ({ entry, depth }) => (
                  <li
                    key={entry.path}
                    className={`tree-file ${active?.path === entry.path ? "active" : ""} ${entry.isDir ? "is-dir" : ""}`}
                    onClick={() => openFromFolder(entry)}
                    onContextMenu={(e) => showContextMenu(e, treeContextItems(entry))}
                    title={entry.path}
                    style={{ paddingLeft: 10 + depth * 12 }}
                  >
                    <span
                      className={`tree-icon ${entry.isDir ? "tree-icon-folder" : "tree-icon-file"}`}
                      style={
                        entry.isDir
                          ? undefined
                          : { backgroundColor: iconColorFor(entry.name) }
                      }
                    />
                    <span>
                      {entry.isDir
                        ? `${expanded.has(entry.path) ? "▾" : "▸"} ${entry.name}/`
                        : entry.name}
                    </span>
                  </li>
                ),
              )}
            </>
          )}

          {mode === "file" && (
            <>
              {buffers.map((f, i) => (
                <li
                  key={(f.path || f.name) + i}
                  className={`tree-file ${activeIdx === i ? "active" : ""} tree-top`}
                  onClick={() => setActiveOfFocused(i)}
                  title={f.path ?? f.name}
                >
                  <span
                    className="tree-icon tree-icon-file"
                    style={{ backgroundColor: f.iconColor }}
                  />
                  <span>{f.name}</span>
                </li>
              ))}
            </>
          )}

          {mode === "demo" && (
            <>
              <li className="tree-folder">
                <span className="tree-icon tree-icon-folder" />
                <span>src/</span>
              </li>
              {buffers.map((f, i) => (
                <li
                  key={f.name + i}
                  className={`tree-file ${activeIdx === i ? "active" : ""}`}
                  onClick={() => setActiveOfFocused(i)}
                >
                  <span
                    className="tree-icon tree-icon-file"
                    style={{ backgroundColor: f.iconColor }}
                  />
                  <span>{f.name}</span>
                </li>
              ))}
              <li className="tree-folder tree-top">
                <span className="tree-icon tree-icon-folder" />
                <span>public/</span>
              </li>
              <li className="tree-file tree-top">
                <span
                  className="tree-icon tree-icon-file"
                  style={{ backgroundColor: "#8a9bc5" }}
                />
                <span>README.md</span>
              </li>
              <li className="tree-file">
                <span
                  className="tree-icon tree-icon-file"
                  style={{ backgroundColor: "#8a9bc5" }}
                />
                <span>drupl.toml</span>
              </li>
            </>
          )}
        </ul>

        {tsInfo && tsInfo.symbols.length > 0 && (
          <>
            <div className="editor-section-head symbols-head">
              Symbols · {tsInfo.symbols.length}
            </div>
            <ul className="editor-symbols">
              {tsInfo.symbols.map((s, i) => (
                <li
                  key={`${s.name}-${s.line}-${i}`}
                  className="symbol-item"
                  style={{ paddingLeft: 14 + s.depth * 10 }}
                  onClick={() => jumpToSymbol(s)}
                  title={`${s.kind} · line ${s.line + 1}`}
                >
                  <span className={`symbol-kind kind-${s.kind}`}>
                    {kindMarker(s.kind)}
                  </span>
                  <span className="symbol-name">{s.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="editor-section-head crew-head">Crew online</div>
        <ul className="editor-crew">
          {CREW.map((c) => (
            <li key={c.name} title={c.role}>
              <span className="crew-droplet">
                <MiniDroplet pixel={3} tint={c.tint} />
              </span>
              <span className="crew-name">{c.name}</span>
              <span className="crew-role">{c.role}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="editor-main">
        <div className="editor-tabs">
          {buffers.map((f, i) => {
            const dirty = f.content !== f.originalContent;
            return (
              <button
                key={(f.path || f.name) + i}
                className={`editor-tab ${activeIdx === i ? "active" : ""}`}
                onClick={(e) => {
                  if (activeIdx !== i) rippleFromEvent(e, undefined, "var(--water)");
                  setActiveOfFocused(i);
                }}
                onContextMenu={(e) => showContextMenu(e, tabContextItems(i))}
                title={f.path ?? f.name}
              >
                {dirty && <span className="editor-tab-dirty">●</span>}
                {f.name.toUpperCase()}
                <span className="editor-tab-close" onClick={(e) => closeTab(i, e)}>
                  ×
                </span>
              </button>
            );
          })}
          <div className="editor-tabs-spacer" />
          {active && (
            <div className="editor-tabs-meta" title={active.path ?? "unsaved"}>
              {languageLabel(active.name)}
              {tsInfo && (
                <span
                  className="editor-tabs-ts"
                  title={`tree-sitter parsed in ${tsInfo.parseMs.toFixed(1)}ms`}
                >
                  · ts {tsInfo.nodeCount}
                </span>
              )}
            </div>
          )}
          <button
            className="editor-action"
            onClick={() => (panes.length >= 2 ? closePane(1) : splitRight())}
            title={panes.length >= 2 ? "Close split (⌘\\)" : "Split right (⌘\\)"}
          >
            {panes.length >= 2 ? "⊟ unsplit" : "⊞ split"}
          </button>
          <button
            className="editor-action"
            onClick={() => setPluginsOpen(true)}
            title="Plugins"
          >
            ⊕ plugins
          </button>
          <button
            className={`editor-terminal-toggle ${terminalOpen ? "active" : ""}`}
            onClick={() => setTerminalOpen((v) => !v)}
            title="Toggle terminal (⌘`)"
          >
            ▸ term
          </button>
        </div>

        <div className={`editor-split ${terminalOpen ? "with-terminal" : ""}`}>
          <div
            className="editor-panes"
            style={{
              gridTemplateColumns: `repeat(${panes.length}, minmax(0, 1fr))`,
            }}
          >
            {panes.map((pane, paneIdx) => {
              const buf =
                pane.activeIdx >= 0 ? buffers[pane.activeIdx] : undefined;
              const isFocused = focusedPaneIdx === paneIdx;
              return (
                <div
                  key={paneIdx}
                  className={`editor-pane ${isFocused ? "focused" : ""}`}
                  onMouseDown={() => setFocusedPaneIdx(paneIdx)}
                >
                  {panes.length > 1 && (
                    <div className="pane-header">
                      <span className="pane-title">
                        {buf ? buf.name : "—"}
                      </span>
                      <button
                        className="pane-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          closePane(paneIdx);
                        }}
                        title="Close split"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="pane-body">
                    {buf ? (
                      <CodeMirror
                        value={buf.content}
                        onChange={(v) => updatePaneContent(paneIdx, v)}
                        extensions={langForFilename(buf.name)}
                        theme={druplOcean}
                        height="100%"
                        onCreateEditor={(view) => {
                          paneViewsRef.current.set(paneIdx, view);
                        }}
                        basicSetup={{
                          lineNumbers: true,
                          highlightActiveLine: true,
                          highlightActiveLineGutter: true,
                          foldGutter: false,
                          bracketMatching: true,
                          closeBrackets: true,
                          autocompletion: true,
                          tabSize: 2,
                          indentOnInput: true,
                        }}
                      />
                    ) : (
                      <div className="editor-empty">
                        <p>no file selected</p>
                        <p className="hint">
                          click a file in the sidebar to start editing
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {terminalOpen && (
            <TerminalDock
              cwd={initialFolder?.path}
              onClose={() => setTerminalOpen(false)}
            />
          )}
        </div>

        <footer className="editor-statusbar">
          <span className="status-path" title={active?.path ?? undefined}>
            {active ? active.path ?? `${active.name} · new file` : "no file open"}
          </span>
          <span className="status-spacer" />
          {tsInfo && (
            <span className="status-chip">
              {tsInfo.symbols.length} symbols · {tsInfo.nodeCount} nodes
            </span>
          )}
          {active && (
            <span
              className={`status-save ${activeIsDirty ? "dirty" : "clean"}`}
            >
              {activeIsDirty
                ? "● unsaved changes"
                : active.path
                  ? "✓ saved"
                  : "✓ no changes"}
            </span>
          )}
        </footer>
      </main>

      {pluginsOpen && (
        <PluginsPanel
          onClose={() => setPluginsOpen(false)}
          activeContent={active?.content}
          onApplyResult={(text) => {
            if (activeIdx < 0) return;
            setBuffers((prev) =>
              prev.map((f, i) =>
                i === activeIdx ? { ...f, content: text } : f,
              ),
            );
            dropRipple(window.innerWidth / 2, window.innerHeight / 2, {
              color: "var(--mint)",
            });
          }}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          commands={buildCommands({
            active,
            activeIdx,
            activeIsDirty,
            terminalOpen,
            paneCount: panes.length,
            onNewFile,
            onNewProject,
            onOpenFile,
            onOpenFolder,
            onSave: handleSave,
            onSaveAs: handleSaveAs,
            onCloseTab: () =>
              activeIdx >= 0 &&
              closeTab(activeIdx, {
                stopPropagation: () => {},
              } as React.MouseEvent),
            onToggleTerminal: () => setTerminalOpen((v) => !v),
            onOpenPlugins: () => setPluginsOpen(true),
            onSplitRight: splitRight,
            onCloseSplit: () => closePane(focusedPaneIdx),
            onBack,
          })}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}

type BuildCommandArgs = {
  active: FileBuffer | undefined;
  activeIdx: number;
  activeIsDirty: boolean;
  terminalOpen: boolean;
  paneCount: number;
  onNewFile: () => void;
  onNewProject: () => void;
  onOpenFile: () => Promise<void>;
  onOpenFolder: () => Promise<void>;
  onSave: () => Promise<void>;
  onSaveAs: () => Promise<void>;
  onCloseTab: () => void;
  onToggleTerminal: () => void;
  onOpenPlugins: () => void;
  onSplitRight: () => void;
  onCloseSplit: () => void;
  onBack: () => void;
};

function buildCommands(a: BuildCommandArgs): Command[] {
  const cmds: Command[] = [
    {
      id: "new-file",
      label: "New File",
      group: "file",
      hint: "⌘N",
      run: a.onNewFile,
    },
    {
      id: "new-project",
      label: "New Project",
      group: "file",
      hint: "⌘⇧N",
      run: a.onNewProject,
    },
    {
      id: "open-file",
      label: "Open File…",
      group: "file",
      hint: "⌘O",
      run: a.onOpenFile,
    },
    {
      id: "open-folder",
      label: "Open Folder…",
      group: "file",
      hint: "⌘⇧O",
      run: a.onOpenFolder,
    },
    {
      id: "save",
      label: "Save",
      group: "file",
      hint: "⌘S",
      disabled: !a.active,
      run: a.onSave,
    },
    {
      id: "save-as",
      label: "Save As…",
      group: "file",
      hint: "⌘⇧S",
      disabled: !a.active,
      run: a.onSaveAs,
    },
    {
      id: "close-tab",
      label: "Close Tab",
      group: "file",
      hint: "⌘W",
      disabled: a.activeIdx < 0,
      run: a.onCloseTab,
    },
    {
      id: "split-right",
      label: "Split Right",
      group: "view",
      hint: "⌘\\",
      disabled: a.paneCount >= 2,
      run: a.onSplitRight,
    },
    {
      id: "close-split",
      label: "Close Split",
      group: "view",
      disabled: a.paneCount <= 1,
      run: a.onCloseSplit,
    },
    {
      id: "toggle-terminal",
      label: a.terminalOpen ? "Hide Terminal" : "Show Terminal",
      group: "view",
      hint: "⌘`",
      run: a.onToggleTerminal,
    },
    {
      id: "open-plugins",
      label: "Open Plugins",
      group: "view",
      run: a.onOpenPlugins,
    },
    {
      id: "back-welcome",
      label: "Back to Welcome",
      group: "view",
      run: a.onBack,
    },
  ];
  return cmds;
}
