import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  messages: string;
  sentColor: string;
  sentTextColor: string;
  receivedColor: string;
  receivedTextColor: string;
  fontFamily: string;
  /** px at 1080p */
  fontSize: number;
  /** Seconds before the first message. */
  startDelay: number;
  /** Seconds between messages. */
  gap: number;
  /** Seconds of typing dots before each received message (0 = none). */
  typing: number;
  tails: boolean;
  exit: boolean;
};

type Msg = { key: string; text: string; sent: boolean; at: number; typingAt: number | null; tail: boolean; groupStart: boolean };

const EMOJI_FONT = "Noto Color Emoji";
const EMOJI = /\p{Extended_Pictographic}/u;

/** One message per line; lines starting with ">" are sent, everything else is received. Times in 30 fps frames. */
const schedule = (p: Props): Msg[] => {
  const parsed = p.messages
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith(">") ? { text: line.slice(1).trim(), sent: true } : { text: line.replace(/^</, "").trim(), sent: false },
    )
    .filter((m) => m.text.length > 0);
  let cursor = p.startDelay * 30;
  return parsed.map((m, i) => {
    let typingAt: number | null = null;
    if (!m.sent && p.typing > 0) {
      typingAt = cursor;
      cursor += p.typing * 30;
    }
    const at = cursor;
    cursor += p.gap * 30;
    const next = parsed[i + 1];
    const prev = parsed[i - 1];
    return {
      ...m,
      key: `${i}-${m.text}`,
      at,
      typingAt,
      tail: !next || next.sent !== m.sent,
      groupStart: !prev || prev.sent !== m.sent,
    };
  });
};

/**
 * Grid row whose height is `h` (0..1) of its content: the 0fr→1fr trick, so new
 * messages push the conversation up smoothly without measuring the DOM.
 */
const Row: React.FC<{ h: number; children: React.ReactNode }> = ({ h, children }) =>
  h <= 0 ? null : (
    <div style={{ display: "grid", gridTemplateRows: `${Math.min(1, h).toFixed(4)}fr` }}>
      <div
        style={{
          minHeight: 0,
          overflow: h < 1 ? "hidden" : "visible",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {children}
      </div>
    </div>
  );

/** iMessage-style tail, drawn for a received bubble (mirrored for sent). Units: 40 per em. */
const Tail: React.FC<{ color: string; sent: boolean }> = ({ color, sent }) => (
  <svg
    width="0.75em"
    height="0.9em"
    viewBox="0 0 30 36"
    style={{
      position: "absolute",
      bottom: 0,
      [sent ? "right" : "left"]: "-0.3em",
      display: "block",
      transform: sent ? "scaleX(-1)" : undefined,
    }}
  >
    <path d="M12 1C12 17 9 28 1 35.5C8 36.5 15 35 19.5 32C21.5 34.6 24.5 36 29 36L29 1Z" fill={color} />
  </svg>
);

const ChatBubbles: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const msgs = schedule(p);
  const hasEmoji = msgs.some((m) => EMOJI.test(m.text));
  useFonts([{ family: p.fontFamily, weight: 400 }, ...(hasEmoji ? [{ family: EMOJI_FONT, weight: 400 }] : [])]);
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const fs = p.fontSize * unit;
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  const font = hasEmoji ? `${fontStack(p.fontFamily)}, "${EMOJI_FONT}"` : fontStack(p.fontFamily);

  const bubble = (sent: boolean, tail: boolean): React.CSSProperties => ({
    position: "relative",
    alignSelf: sent ? "flex-end" : "flex-start",
    maxWidth: "min(78%, 17em)",
    boxSizing: "border-box",
    padding: "0.42em 0.68em",
    borderRadius: "1.05em",
    [sent ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: tail && p.tails ? "0.32em" : "1.05em",
    backgroundColor: sent ? p.sentColor : p.receivedColor,
    color: sent ? p.sentTextColor : p.receivedTextColor,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 26 * fs,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          overflow: "hidden",
          boxSizing: "border-box",
          padding: `0 ${0.4 * fs}px`,
          fontFamily: font,
          fontSize: fs,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          // Older messages fade out as they scroll off the top.
          maskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
          opacity: 1 - e,
          transform: `translateY(${-e * 20 * unit}px)`,
        }}
      >
        {msgs.flatMap((m) => {
          const space = m.groupStart ? "0.5em" : "0.12em";
          const pop = progress(t, m.at, 16, "playful");
          const typingIn = m.typingAt === null ? 0 : progress(t, m.typingAt, 14, "playful");
          const typingOut = progress(t, m.at - 1, 6, "smooth");
          const typingRow = m.typingAt === null ? 0 : progress(t, m.typingAt, 8, "smooth") * (1 - progress(t, m.at - 1, 8, "smooth"));
          const origin = m.sent ? "100% 100%" : "0% 100%";
          return [
            <Row key={m.key} h={progress(t, m.at - 1, 10, "smooth")}>
              <div style={{ paddingTop: space, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    ...bubble(m.sent, m.tail),
                    opacity: Math.min(1, pop * 3),
                    transformOrigin: origin,
                    transform: `translateY(${((1 - Math.min(1, pop)) * 0.3).toFixed(4)}em) scale(${lerp(0.84, 1, pop).toFixed(4)})`,
                  }}
                >
                  {m.text}
                  {m.tail && p.tails ? <Tail color={m.sent ? p.sentColor : p.receivedColor} sent={m.sent} /> : null}
                </div>
              </div>
            </Row>,
            <Row key={`${m.key}-typing`} h={typingRow}>
              <div style={{ paddingTop: space, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    ...bubble(false, true),
                    display: "flex",
                    gap: "0.2em",
                    padding: "0.67em 0.62em",
                    opacity: Math.min(1, typingIn * 3) * (1 - typingOut),
                    transformOrigin: "0% 100%",
                    transform: `scale(${(lerp(0.84, 1, typingIn) - 0.2 * typingOut).toFixed(4)})`,
                  }}
                >
                  {[0, 1, 2].map((i) => {
                    // Dots pulse in sequence, like the other person is typing.
                    const phase = ((((t - (m.typingAt ?? 0)) / 26 - i * 0.18) % 1) + 1) % 1;
                    const v = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
                    return (
                      <div
                        key={`d${i}`}
                        style={{
                          width: "0.36em",
                          height: "0.36em",
                          borderRadius: "50%",
                          backgroundColor: p.receivedTextColor,
                          opacity: 0.3 + 0.55 * v,
                          transform: `translateY(${(-0.08 * v).toFixed(4)}em)`,
                        }}
                      />
                    );
                  })}
                  {p.tails ? <Tail color={p.receivedColor} sent={false} /> : null}
                </div>
              </div>
            </Row>,
          ];
        })}
      </div>
    </div>
  );
};

export const chatBubbles = defineMotionComponent<Props>({
  id: "chat-bubbles",
  name: "Chat bubbles",
  category: "social",
  description:
    "Messaging-app conversation: bubbles appear one by one (received ones after typing dots) and push the thread up. One message per line; start a line with > for messages you send (right, blue), other lines are received (left, gray). Use for story-driven shorts, testimonials and UX demos.",
  schema: {
    messages: {
      type: "text",
      label: "Messages",
      default: "Did the export finish?\n> Just now. Sending it over\nWait, you cut all of this today?\n> The AI drafted it. I just tweaked",
      description: "One per line; prefix > for sent messages",
    },
    sentColor: { type: "color", label: "Sent bubble", default: "#0A84FF" },
    sentTextColor: { type: "color", label: "Sent text", default: "#FFFFFF" },
    receivedColor: { type: "color", label: "Received bubble", default: "#2C2C2E" },
    receivedTextColor: { type: "color", label: "Received text", default: "#FFFFFF" },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    fontSize: { type: "number", label: "Size", default: 40, min: 20, max: 120, step: 1, description: "px at 1080p" },
    startDelay: { type: "number", label: "Start (s)", default: 0.3, min: 0, max: 10, step: 0.05 },
    gap: { type: "number", label: "Gap (s)", default: 0.75, min: 0.1, max: 5, step: 0.05 },
    typing: { type: "number", label: "Typing (s)", default: 0.8, min: 0, max: 5, step: 0.05 },
    tails: { type: "boolean", label: "Tails", default: true },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    messages: "Did the export finish?\n> Just now. Sending it over\nWait, you cut all of this today?\n> The AI drafted it. I just tweaked",
    sentColor: "#0A84FF",
    sentTextColor: "#FFFFFF",
    receivedColor: "#2C2C2E",
    receivedTextColor: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 40,
    startDelay: 0.3,
    gap: 0.75,
    typing: 0.8,
    tails: true,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.86, height: 0.8 },
  Component: ChatBubbles,
  tags: ["chat", "messages", "imessage", "conversation", "texting", "social"],
});
