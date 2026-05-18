import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";

function App() {
  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <h1
        style={{
          margin: 0,
          letterSpacing: 4,
          color: "var(--water)",
          fontFamily: "var(--font-mono)",
        }}
      >
        DRUPL
      </h1>
      <p style={{ margin: 0, color: "var(--fg-muted)" }}>
        the open-source code editor that ripples — coming soon
      </p>
    </main>
  );
}

export default App;
