// App icon, drawn as a Remotion still so it can be regenerated at any size.
import { AbsoluteFill, Composition, registerRoot } from "remotion";

const Icon: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "transparent" }}>
    <div
      style={{
        width: 824,
        height: 824,
        borderRadius: 190,
        background: "radial-gradient(120% 120% at 30% 15%, #2a2d3a 0%, #17181d 55%, #101114 100%)",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 32 32" width={520} height={520} aria-hidden>
        <defs>
          <linearGradient id="play" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8ab4ff" />
            <stop offset="1" stopColor="#3f7cf0" />
          </linearGradient>
        </defs>
        <rect x="3" y="6" width="20" height="20" rx="5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
        <path d="M14 3h9a6 6 0 0 1 6 6v9" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10.5 12.5v7l6-3.5z" fill="url(#play)" />
      </svg>
    </div>
  </AbsoluteFill>
);

registerRoot(() => <Composition id="icon" component={Icon} width={1024} height={1024} fps={30} durationInFrames={1} />);
