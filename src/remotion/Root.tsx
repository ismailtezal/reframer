import { Composition } from "remotion";
import { createProject } from "../core/defaults";
import { getCompositionMetadata, ProjectComposition, type ProjectCompositionProps } from "./ProjectComposition";

/**
 * Entry used by the server-side renderer (`@remotion/bundler`). The editor
 * renders `ProjectComposition` directly through `@remotion/player`.
 */
export const RemotionRoot: React.FC = () => (
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
);
