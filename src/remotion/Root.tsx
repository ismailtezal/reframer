import { Composition } from "remotion";
import { createProject } from "../core/defaults";
import { getCompositionMetadata, ProjectComposition, type ProjectCompositionProps } from "./ProjectComposition";

/** The WebGL renderer the render browser got, e.g. "ANGLE (NVIDIA, … Direct3D11 …)". */
const webglRenderer = () => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "none";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return "none";
  }
};

const Empty: React.FC<{ renderer?: string }> = () => null;

/**
 * Entry used by the server-side renderer (`@remotion/bundler`). The editor
 * renders `ProjectComposition` directly through `@remotion/player`.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="reframer"
      component={ProjectComposition}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ project: createProject({ name: "Preview" }), editor: false } satisfies ProjectCompositionProps}
      calculateMetadata={({ props }) => getCompositionMetadata(props.project)}
    />
    {/* Capability probe for exports: is WebGL hardware accelerated in the render browser? */}
    <Composition
      id="gpu-probe"
      component={Empty}
      durationInFrames={1}
      fps={30}
      width={16}
      height={16}
      defaultProps={{}}
      calculateMetadata={() => ({ props: { renderer: webglRenderer() } })}
    />
  </>
);
