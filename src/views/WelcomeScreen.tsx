import { Mascot } from "../components/Mascot";
import "./WelcomeScreen.css";

type Props = {
  onLaunch: () => void;
};

export function WelcomeScreen({ onLaunch }: Props) {
  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="welcome-mascot">
          <Mascot pixel={12} />
        </div>
        <h1 className="welcome-title">Drupl</h1>
        <p className="welcome-tagline">the open-source code editor that ripples</p>
        <button className="welcome-launch" onClick={onLaunch}>
          ▶ launch editor
        </button>
        <div className="welcome-version">v0.1 · dev</div>
      </div>
    </main>
  );
}
