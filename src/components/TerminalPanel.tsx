import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPanel.css";

type Props = {
  cwd?: string;
  visible: boolean;
};

type PtyDataEvent = { session_id: string; data: number[] };
type PtyExitEvent = { session_id: string };

const theme = {
  background: "#0b1226",
  foreground: "#e9f1ff",
  cursor: "#5cc9ff",
  cursorAccent: "#0b1226",
  selectionBackground: "rgba(92, 201, 255, 0.3)",
  black: "#0b1226",
  red: "#ff9bb3",
  green: "#a8f0c5",
  yellow: "#ffd86b",
  blue: "#5cc9ff",
  magenta: "#ff8ad1",
  cyan: "#7ee5e5",
  white: "#e9f1ff",
  brightBlack: "#3a4a75",
  brightRed: "#ff9bb3",
  brightGreen: "#a8f0c5",
  brightYellow: "#ffd86b",
  brightBlue: "#5cc9ff",
  brightMagenta: "#ff8ad1",
  brightCyan: "#7ee5e5",
  brightWhite: "#f5fbff",
};

function diag(term: Terminal, msg: string, color: "dim" | "err" | "ok" = "dim") {
  const code = color === "err" ? "31" : color === "ok" ? "32" : "2;37";
  term.writeln(`\x1b[${code}m[drupl] ${msg}\x1b[0m`);
}

export function TerminalPanel({ cwd, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    disposedRef.current = false;
    sessionIdRef.current = null;

    const term = new Terminal({
      theme,
      fontFamily:
        '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: false,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    diag(term, "starting pty…");

    term.onData((data) => {
      if (!sessionIdRef.current) return;
      invoke("pty_write", {
        session_id: sessionIdRef.current,
        data,
      }).catch((err) => {
        diag(term, `pty_write failed: ${String(err)}`, "err");
      });
    });

    term.onResize(({ cols, rows }) => {
      if (!sessionIdRef.current) return;
      invoke("pty_resize", {
        session_id: sessionIdRef.current,
        cols,
        rows,
      }).catch(() => {});
    });

    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    const buffered: PtyDataEvent[] = [];

    (async () => {
      try {
        unlistenData = await listen<PtyDataEvent>("pty-data", (event) => {
          if (sessionIdRef.current === null) {
            buffered.push(event.payload);
            return;
          }
          if (event.payload.session_id !== sessionIdRef.current) return;
          term.write(new Uint8Array(event.payload.data));
        });
        unlistenExit = await listen<PtyExitEvent>("pty-exit", (event) => {
          if (event.payload.session_id !== sessionIdRef.current) return;
          diag(term, "shell exited");
          sessionIdRef.current = null;
        });
      } catch (err) {
        diag(term, `could not attach listeners: ${String(err)}`, "err");
        return;
      }

      const { cols, rows } = term;
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionIdRef.current = sessionId;

      invoke("pty_spawn", { session_id: sessionId, cwd, cols, rows }).catch(
        (err) => {
          diag(term, `pty_spawn failed: ${String(err)}`, "err");
          sessionIdRef.current = null;
        },
      );

      for (const item of buffered) {
        if (item.session_id === sessionId) {
          term.write(new Uint8Array(item.data));
        }
      }
      buffered.length = 0;

      term.focus();
    })();

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    });
    ro.observe(containerRef.current);

    return () => {
      disposedRef.current = true;
      ro.disconnect();
      unlistenData?.();
      unlistenExit?.();
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid) {
        void invoke("pty_kill", { session_id: sid });
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [cwd]);

  // Refit + focus when this terminal becomes visible
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      try {
        fitRef.current?.fit();
        termRef.current?.focus();
      } catch {
        // ignore
      }
    }, 30);
    return () => window.clearTimeout(id);
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="terminal-surface"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
