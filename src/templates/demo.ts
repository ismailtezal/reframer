import { createComponentClip, createProject, createShapeClip, createTextClip } from "../core/defaults";
import { insertClip } from "../core/ops";
import type { Project } from "../core/schema";

/** A small showcase project used by the dev playground and tests. */
export const createDemoProject = (): Project => {
  const project = createProject({ name: "Reframer demo", width: 1920, height: 1080, fps: 30 });
  const s = { ...project.settings };
  const [overlay, main] = project.tracks;
  const fps = s.fps;

  insertClip(
    project,
    createComponentClip(s, {
      trackId: main.id,
      start: 0,
      duration: fps * 9,
      component: "gradient-mesh",
      name: "Backdrop",
      props: { speed: 0.5 },
    }),
    "exact",
  );
  insertClip(
    project,
    createComponentClip(s, {
      trackId: overlay.id,
      start: 0,
      duration: fps * 3.5,
      component: "kinetic-title",
      name: "Hero title",
      props: { text: "Edit videos with\n*any AI* you like", eyebrow: "Introducing Reframer", fontSize: 128 },
    }),
    "exact",
  );
  const counterClip = createComponentClip(s, {
    trackId: overlay.id,
    start: Math.round(fps * 3.5),
    duration: fps * 2.5,
    component: "counter",
    name: "Stat",
    props: { to: 40, suffix: "+", label: "AI models supported", fontSize: 240 },
    transform: { x: s.width / 2, y: s.height / 2, width: s.width * 0.7, height: s.height * 0.6 },
  });
  counterClip.transitionIn = { type: "blur", duration: 10 };
  insertClip(project, counterClip, "exact");

  const closing = createTextClip(s, {
    trackId: overlay.id,
    start: fps * 6,
    duration: fps * 3,
    text: "Watch it work. Grab the controls anytime.",
    style: { fontSize: 76, fontFamily: "Inter Tight", fontWeight: 600, letterSpacing: -0.03 },
  });
  closing.textAnimation = { type: "rise-blur", unit: "word", stagger: 3, duration: 20 };
  closing.animations = { out: { type: "fade", duration: 12 } };
  closing.transitionIn = { type: "push", duration: 14, direction: "up" };
  insertClip(project, closing, "exact");

  const line = createShapeClip(s, {
    trackId: overlay.id,
    start: Math.round(fps * 6.6),
    duration: Math.round(fps * 2.4),
    shape: "line",
    stroke: "#A78BFA",
    strokeWidth: 8,
    transform: { x: s.width / 2, y: s.height / 2 + 90, width: 520, height: 40 },
  });
  line.drawProgress = 1;
  line.keyframes = {
    drawProgress: [
      { frame: 0, value: 0, easing: "smooth" },
      { frame: 24, value: 1 },
    ],
  };
  line.animations = undefined;
  insertClip(project, line, "auto-track");

  return project;
};
