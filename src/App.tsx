import { useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";
import { WelcomeScreen } from "./views/WelcomeScreen";
import { EditorScreen } from "./views/EditorScreen";
import { RippleProvider } from "./lib/ripple";

type View = "welcome" | "editor";

export type OpenedFile = { name: string; path: string; content: string };

export type FolderEntry = { name: string; path: string; isDir: boolean };

export type OpenedFolder = {
  name: string;
  path: string;
  entries: FolderEntry[];
};

const SKIP_NAMES = new Set([
  ".DS_Store",
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "target",
  "dist",
  ".next",
  ".cache",
]);

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || "untitled";
}

function App() {
  const [view, setView] = useState<View>("welcome");
  const [openedFile, setOpenedFile] = useState<OpenedFile | undefined>();
  const [openedFolder, setOpenedFolder] = useState<OpenedFolder | undefined>();
  const [droppedFiles, setDroppedFiles] = useState<OpenedFile[]>([]);
  const [newFileTick, setNewFileTick] = useState(0);
  const handlersRef = useRef<{
    onNew: () => void;
    onNewFile: () => void;
    onOpenFile: () => Promise<void>;
    onOpenFolder: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const u = listen<string>("menu", (event) => {
      const h = handlersRef.current;
      if (!h) return;
      switch (event.payload) {
        case "new_file":
          h.onNewFile();
          break;
        case "new_project":
          h.onNew();
          break;
        case "open_file":
          void h.onOpenFile();
          break;
        case "open_folder":
          void h.onOpenFolder();
          break;
      }
    });
    return () => {
      u.then((f) => f());
    };
  }, []);

  useEffect(() => {
    console.log("[drop] attaching webview drag-drop listener");
    const u = getCurrentWebview().onDragDropEvent(async (event) => {
      console.log("[drop] webview event:", event.payload.type, event.payload);
      if (event.payload.type !== "drop") return;
      const paths = event.payload.paths;
      const files: OpenedFile[] = [];
      for (const path of paths) {
        try {
          const content = await readTextFile(path);
          files.push({ name: basename(path), path, content });
        } catch (err) {
          console.error("Failed to read dropped file:", path, err);
        }
      }
      if (files.length === 0) return;
      setOpenedFolder(undefined);
      setView("editor");
      setDroppedFiles(files);
    });
    return () => {
      u.then((f) => f());
    };
  }, []);

  // Fallback: also catch HTML5 drag-drop in case Tauri's native intercept misses
  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      console.log(
        "[drop] html5 event, files=",
        e.dataTransfer?.files.length,
        "items=",
        e.dataTransfer?.items.length,
      );
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  async function handleOpenFile() {
    let selected: string | string[] | null = null;
    try {
      selected = await open({
        multiple: false,
        directory: false,
        title: "Open file in Drupl",
      });
    } catch (err) {
      console.error("Dialog failed:", err);
      alert(`Could not open file dialog:\n${String(err)}`);
      return;
    }
    if (!selected || typeof selected !== "string") return;
    try {
      const content = await readTextFile(selected);
      setOpenedFolder(undefined);
      setOpenedFile({ name: basename(selected), path: selected, content });
      setView("editor");
    } catch (err) {
      console.error("Failed to read file:", err);
      alert(`Could not read file:\n${selected}\n\n${String(err)}`);
    }
  }

  async function handleOpenFolder() {
    let selected: string | string[] | null = null;
    try {
      selected = await open({
        multiple: false,
        directory: true,
        title: "Open folder in Drupl",
      });
    } catch (err) {
      console.error("Dialog failed:", err);
      alert(`Could not open folder dialog:\n${String(err)}`);
      return;
    }
    if (!selected || typeof selected !== "string") return;
    try {
      const raw = await readDir(selected);
      const entries: FolderEntry[] = await Promise.all(
        raw
          .filter((e) => !SKIP_NAMES.has(e.name))
          .map(async (e) => ({
            name: e.name,
            path: await join(selected as string, e.name),
            isDir: e.isDirectory,
          })),
      );
      entries.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setOpenedFile(undefined);
      setOpenedFolder({
        name: basename(selected),
        path: selected,
        entries,
      });
      setView("editor");
    } catch (err) {
      console.error("Failed to read folder:", err);
      alert(`Could not read folder:\n${selected}\n\n${String(err)}`);
    }
  }

  function handleNewProject() {
    setOpenedFile(undefined);
    setOpenedFolder(undefined);
    setView("editor");
  }

  function handleNewFile() {
    setView("editor");
    setNewFileTick((t) => t + 1);
  }

  handlersRef.current = {
    onNew: handleNewProject,
    onNewFile: handleNewFile,
    onOpenFile: handleOpenFile,
    onOpenFolder: handleOpenFolder,
  };

  function handleBack() {
    setView("welcome");
  }

  async function loadFile(path: string): Promise<string> {
    return readTextFile(path);
  }

  async function saveFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content);
  }

  async function saveFileAs(
    defaultName: string,
    content: string,
  ): Promise<string | null> {
    const selected = await save({
      defaultPath: defaultName,
      title: "Save file",
    });
    if (!selected || typeof selected !== "string") return null;
    await writeTextFile(selected, content);
    return selected;
  }

  async function loadDir(path: string): Promise<FolderEntry[]> {
    const raw = await readDir(path);
    const entries: FolderEntry[] = await Promise.all(
      raw
        .filter((e) => !SKIP_NAMES.has(e.name))
        .map(async (e) => ({
          name: e.name,
          path: await join(path, e.name),
          isDir: e.isDirectory,
        })),
    );
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries;
  }

  return (
    <RippleProvider>
      {view === "welcome" ? (
        <WelcomeScreen
          onNewProject={handleNewProject}
          onOpenFolder={handleOpenFolder}
          onOpenFile={handleOpenFile}
        />
      ) : (
        <EditorScreen
          onBack={handleBack}
          initialFile={openedFile}
          initialFolder={openedFolder}
          loadFile={loadFile}
          loadDir={loadDir}
          saveFile={saveFile}
          saveFileAs={saveFileAs}
          onNewProject={handleNewProject}
          onNewFile={handleNewFile}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          droppedFiles={droppedFiles}
          newFileTick={newFileTick}
          onConsumedDropped={() => setDroppedFiles([])}
        />
      )}
    </RippleProvider>
  );
}

export default App;
