import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";
import { WelcomeScreen } from "./views/WelcomeScreen";

function App() {
  return (
    <WelcomeScreen onLaunch={() => alert("editor coming soon")} />
  );
}

export default App;
