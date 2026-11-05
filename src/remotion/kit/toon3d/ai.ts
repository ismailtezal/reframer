import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type AIFace, drawAIFace, Screen } from "./screens";
import { toon } from "./toon";

/**
 * The AI: a friendly desktop terminal with a glowing face. A soft lavender rounded body, a recessed screen (HDR, so
 * the bloom picks up its eyes), a little neck and foot, and an antenna with a glowing bulb. Its pose (bob, tilt,
 * bow, squash) is set per frame; its face is a Screen redrawn from an AIFace state.
 */
export class AITerminal {
  readonly group = new THREE.Group();
  readonly pivot = new THREE.Group();
  readonly screen: Screen;
  readonly screenMat: THREE.MeshBasicMaterial;
  readonly bulbMat: THREE.MeshBasicMaterial;
  private bodyMat: THREE.MeshLambertMaterial;

  constructor(body = "#e7e1fb", accent = "#8b6cf0") {
    this.screen = new Screen(640, 460);
    this.bodyMat = toon({ color: body });
    const accentMat = toon({ color: accent });
    const darkMat = toon({ color: "#2b2440" });
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false });
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#6ff6ff").multiplyScalar(3), toneMapped: false });

    // foot + neck stay put; the pivot (head) moves
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.035, 0.24, 2, 0.015), accentMat);
    foot.position.y = 0.0175;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 16), accentMat);
    neck.position.y = 0.09;
    this.group.add(foot, neck);
    this.pivot.position.y = 0.14;
    this.group.add(this.pivot);

    const shell = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.46, 0.42, 5, 0.07), this.bodyMat);
    shell.position.set(0, 0.23, 0);
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.38, 0.02, 3, 0.03), darkMat);
    bezel.position.set(0, 0.235, 0.205);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.345), this.screenMat);
    screen.position.set(0, 0.235, 0.2165);
    // little side "ears" (speaker grills) and the antenna
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20), accentMat);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(s * 0.31, 0.25, 0);
      this.pivot.add(ear);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), darkMat);
    ant.position.set(0.12, 0.53, -0.04);
    ant.rotation.z = -0.25;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), this.bulbMat);
    bulb.position.set(0.14, 0.61, -0.04);
    this.pivot.add(shell, bezel, screen, ant, bulb);
    for (const m of [foot, neck, shell, bezel, ant]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  }

  /** Pose: bob (m), tilt (rad, sideways), bow (rad, forward), squash (scale y), screen brightness. */
  pose(o: { bob?: number; tilt?: number; bow?: number; squash?: number; glow?: number; bulb?: THREE.ColorRepresentation }) {
    this.pivot.position.y = 0.14 + (o.bob ?? 0);
    this.pivot.rotation.set(o.bow ?? 0, 0, o.tilt ?? 0);
    const sq = o.squash ?? 1;
    this.pivot.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.screenMat.color.setScalar((o.glow ?? 1.6) * 1.15);
    if (o.bulb) this.bulbMat.color.set(o.bulb).multiplyScalar(3);
  }

  face(f: AIFace) {
    this.screen.draw(JSON.stringify(f), (g, w, h) => drawAIFace(g, w, h, f));
  }
}
