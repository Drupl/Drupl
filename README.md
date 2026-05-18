# Drupl

> The open-source code editor that ripples.

Drupl is a cross-platform desktop code editor built with [Tauri](https://tauri.app), React and TypeScript. It pairs a friendly pixel-art identity (the droplet mascot) with a fast, lightweight editing surface powered by [CodeMirror 6](https://codemirror.net).

This is an early-stage project. Expect rough edges.

## Status

- ✅ Tauri 2 + React 19 + TypeScript + Vite scaffold
- ✅ Drupl design system (ocean palette, JetBrains Mono)
- ✅ Welcome screen with animated pixel mascot
- ✅ Editor view with CodeMirror 6 (JavaScript syntax highlighting)
- ⏳ File open / save via Tauri's `fs` + `dialog` plugins
- ⏳ Multi-language detection from file extension
- ⏳ Tabs / multi-file editing
- ⏳ File-tree sidebar
- ⏳ Theme switcher (ocean / sunset / forest / candy)

## Tech stack

| Layer            | Choice                              |
| ---------------- | ----------------------------------- |
| Desktop shell    | Tauri 2 (Rust)                      |
| UI framework     | React 19 + TypeScript               |
| Bundler / dev    | Vite 7                              |
| Editor engine    | CodeMirror 6 (`@uiw/react-codemirror`) |
| Typography       | JetBrains Mono (`@fontsource`)      |

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [Rust](https://rustup.rs/) (stable toolchain)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (preinstalled on Windows 10/11)
- Linux: see the [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/#linux)

## Getting started

```bash
git clone git@github.com:Drupl/Drupl.git
cd Drupl
npm install
npm run tauri dev
```

The first `tauri dev` run compiles the Rust toolchain dependencies and takes a few minutes. Subsequent runs are fast.

## Scripts

| Command                  | What it does                                        |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server (frontend only)           |
| `npm run build`          | Type-check and build the frontend                   |
| `npm run tauri dev`      | Run the desktop app in dev mode (with HMR)          |
| `npm run tauri build`    | Build a production desktop binary for your platform |

Cross-platform builds (e.g. Windows from macOS) are best done via GitHub Actions using [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action).

## Project layout

```
.
├── index.html              Vite entry HTML
├── src/                    React frontend
│   ├── App.tsx             Top-level view switcher (welcome ↔ editor)
│   ├── main.tsx            React mount point
│   ├── components/
│   │   ├── Mascot.tsx      Pixel-art droplet with blink animation
│   │   └── PixelGrid.tsx   Generic pixel-grid renderer
│   ├── views/
│   │   ├── WelcomeScreen.tsx
│   │   └── EditorScreen.tsx
│   └── styles/
│       └── tokens.css      Design tokens (palette, type)
├── src-tauri/              Rust side (Tauri shell + commands)
│   ├── src/                Rust source
│   ├── tauri.conf.json     App config (window, bundle, identifier)
│   └── Cargo.toml
└── reference/
    └── Drupl.html          Original landing-page bundle used as
                            visual reference for the mascot, palette,
                            and brand voice. Not loaded by the app.
```

## Design

The visual identity (droplet mascot, ocean palette, pixel-art chrome) is ported from the original Drupl landing-page bundle in `reference/Drupl.html`. The four palettes shipped there — `ocean`, `sunset`, `forest`, `candy` — are documented in `src/styles/tokens.css`; only `ocean` is wired up so far.

## License

MIT — see [LICENSE](./LICENSE).
