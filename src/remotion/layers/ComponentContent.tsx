import React, { useCallback } from "react";
import { evaluateKeyframes } from "../../core/keyframes";
import type { ComponentClip } from "../../core/schema";
import { clearComponentError, compileCodeComponent, reportComponentError } from "../code/runtime";
import { getMotionComponent } from "../components/registry";
import { ClipBoxProvider, useRenderContext } from "../context";

type BoundaryProps = {
  resetKey: string;
  onError: (err: Error) => void;
  fallback: (err: Error) => React.ReactNode;
  children: React.ReactNode;
};

class ComponentErrorBoundary extends React.Component<BoundaryProps, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromProps(props: BoundaryProps, state: { error: Error | null; key: string }) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}

const ErrorBox: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      padding: 24,
      border: "3px dashed #f43f5e",
      background: "rgba(244, 63, 94, 0.12)",
      color: "#fecdd3",
      fontFamily: "ui-monospace, Menlo, monospace",
      fontSize: 22,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <strong style={{ color: "#fb7185" }}>{title}</strong>
    <span style={{ whiteSpace: "pre-wrap" }}>{message}</span>
  </div>
);

/**
 * Built-in cards, titles and data hold still once they've animated in; a slow 2% settle across the
 * clip keeps a held card alive (end cards and kinetic titles settle by themselves).
 */
const SETTLE_CATEGORIES = new Set(["text", "data", "brand", "social"]);
const OWN_SETTLE = new Set(["end-card", "kinetic-title"]);

export const ComponentContent: React.FC<{
  clip: ComponentClip;
  frame: number;
  box: { width: number; height: number };
}> = ({ clip, frame, box }) => {
  const { project, editor, resolveSrc } = useRenderContext();

  // Keyframed component props live under `props.<name>`.
  const props: Record<string, unknown> = {};
  let Component: React.ComponentType<Record<string, unknown>> | null = null;
  let resetKey = clip.component;
  let defaults: Record<string, unknown> = {};
  let assetProps: string[] = [];
  let settle = 1;

  if (clip.component.startsWith("code:")) {
    const def = project.components[clip.component.slice(5)];
    if (!def) {
      return editor ? <ErrorBox title="Missing component" message={clip.component} /> : null;
    }
    const compiled = compileCodeComponent(def.source);
    if (!compiled.ok) {
      return editor ? <ErrorBox title={`${def.name}: compile error`} message={compiled.error} /> : null;
    }
    Component = compiled.Component;
    resetKey = def.source;
    defaults = Object.fromEntries(Object.entries(def.propsSchema).map(([k, f]) => [k, f.default]));
    assetProps = Object.entries(def.propsSchema)
      .filter(([, f]) => f.type === "asset")
      .map(([k]) => k);
  } else {
    const def = getMotionComponent(clip.component);
    if (!def) return editor ? <ErrorBox title="Unknown component" message={clip.component} /> : null;
    Component = def.Component as React.ComponentType<Record<string, unknown>>;
    defaults = def.defaults as Record<string, unknown>;
    if (SETTLE_CATEGORIES.has(def.category) && !OWN_SETTLE.has(def.id)) settle = 1 + 0.02 * Math.min(1, frame / Math.max(1, clip.duration));
  }

  Object.assign(props, defaults, clip.props);
  if (clip.keyframes) {
    for (const [path, track] of Object.entries(clip.keyframes)) {
      if (!path.startsWith("props.") || track.length === 0) continue;
      const v = evaluateKeyframes(track, frame);
      if (v !== undefined) props[path.slice(6)] = v;
    }
  }
  // Code components get asset props as loadable URLs: an asset id in <Img src> loads nothing, in the
  // editor or the export. (Built-in components resolve ids themselves with useAssetSrc.)
  for (const key of assetProps) {
    const value = props[key];
    const asset = typeof value === "string" ? project.assets[value] : undefined;
    if (asset) props[key] = resolveSrc(asset.src);
  }

  return (
    <ComponentBoundary clip={clip} resetKey={`${resetKey}|${clip.id}`} editor={editor}>
      <ClipBoxProvider value={{ width: box.width, height: box.height, durationInFrames: clip.duration }}>
        {settle !== 1 ? (
          <div style={{ width: "100%", height: "100%", transform: `scale(${settle.toFixed(5)})` }}>
            <Component {...props} width={box.width} height={box.height} durationInFrames={clip.duration} />
          </div>
        ) : (
          <Component {...props} width={box.width} height={box.height} durationInFrames={clip.duration} />
        )}
      </ClipBoxProvider>
      <ClearOnSuccess clipId={clip.id} resetKey={resetKey} />
    </ComponentBoundary>
  );
};

/** Mounted only when the component rendered without throwing. */
const ClearOnSuccess: React.FC<{ clipId: string; resetKey: string }> = ({ clipId, resetKey }) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey re-runs the effect when the component's source changes
  React.useEffect(() => {
    clearComponentError(clipId);
  }, [clipId, resetKey]);
  return null;
};

const ComponentBoundary: React.FC<{
  clip: ComponentClip;
  resetKey: string;
  editor: boolean;
  children: React.ReactNode;
}> = ({ clip, resetKey, editor, children }) => {
  const onError = useCallback(
    (err: Error) => reportComponentError({ clipId: clip.id, componentId: clip.component, message: err.message, at: Date.now() }),
    [clip.id, clip.component],
  );
  return (
    <ComponentErrorBoundary
      resetKey={resetKey}
      onError={onError}
      fallback={(err) => (editor ? <ErrorBox title="Runtime error" message={err.message} /> : null)}
    >
      {children}
    </ComponentErrorBoundary>
  );
};
