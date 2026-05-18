import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Mascot } from "../components/Mascot";
import "./EditorScreen.css";

type Props = {
  onBack: () => void;
};

const STARTER = `// welcome to drupl
// the open-source code editor that ripples

function ripple(stone) {
  return Array.from({ length: 5 }, (_, i) => ({
    radius: stone.radius + i * 12,
    alpha: 1 - i * 0.2,
  }));
}

const splash = ripple({ radius: 4 });
console.log(splash);
`;

export function EditorScreen({ onBack }: Props) {
  const [code, setCode] = useState(STARTER);

  return (
    <div className="editor">
      <header className="editor-header">
        <button className="editor-back" onClick={onBack} title="Back to welcome">
          ←
        </button>
        <div className="editor-brand">
          <Mascot pixel={3} />
          <span className="editor-brand-name">DRUPL</span>
        </div>
        <div className="editor-file">untitled.js</div>
        <div className="editor-spacer" />
        <div className="editor-lang">JavaScript</div>
      </header>

      <div className="editor-body">
        <CodeMirror
          value={code}
          onChange={setCode}
          theme={oneDark}
          extensions={[javascript({ jsx: true, typescript: true })]}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            tabSize: 2,
          }}
        />
      </div>

      <footer className="editor-status">
        <span>{code.split("\n").length} lines</span>
        <span>·</span>
        <span>{code.length} chars</span>
        <span className="editor-spacer" />
        <span>UTF-8</span>
        <span>·</span>
        <span>spaces: 2</span>
      </footer>
    </div>
  );
}
