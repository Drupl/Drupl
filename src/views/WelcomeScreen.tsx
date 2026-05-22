import { Mascot } from "../components/Mascot";
import "./WelcomeScreen.css";

type Props = {
  onNewProject: () => void;
  onOpenFolder: () => void;
  onOpenFile: () => void;
};

export function WelcomeScreen({ onNewProject, onOpenFolder, onOpenFile }: Props) {
  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="welcome-mascot">
          <Mascot pixel={12} />
        </div>
        <h1 className="welcome-title">Drupl</h1>
        <p className="welcome-tagline">the open-source code editor that ripples</p>

        <div className="welcome-actions">
          <button className="welcome-btn primary" onClick={onNewProject}>
            ▶ new project
          </button>
          <button className="welcome-btn" onClick={onOpenFolder}>
            ▸ open folder…
          </button>
          <button className="welcome-btn" onClick={onOpenFile}>
            ▸ open file…
          </button>
        </div>

        <div className="welcome-version">v0.1 · dev</div>
      </div>
    </main>
  );
}
