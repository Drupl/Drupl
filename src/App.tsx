import { useState } from "react";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";
import { WelcomeScreen } from "./views/WelcomeScreen";
import { EditorScreen } from "./views/EditorScreen";

type View = "welcome" | "editor";

function App() {
  const [view, setView] = useState<View>("welcome");

  return view === "welcome" ? (
    <WelcomeScreen onLaunch={() => setView("editor")} />
  ) : (
    <EditorScreen onBack={() => setView("welcome")} />
  );
}

export default App;
