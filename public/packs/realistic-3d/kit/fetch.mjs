// Downloads what the realistic-3d kit uses into REFRAMER_REAL3D_HOME (default ~/.reframer/real3d). Downloads need
// the user's yes: without --yes this only prints what would be downloaded, from where, and how big (exit 3).
//   node fetch.mjs makehuman [--yes]                        MPFB 2.0.18 (GPL add-on), MakeHuman system assets and
//                                                            the ARKit face units (CC0), about 327 MB
//   node fetch.mjs polyhaven <id>:<res>:<kind> ... [--yes]  Poly Haven assets (CC0); kind hdri | tex | model, res 1k..8k
//   e.g. node fetch.mjs polyhaven kloofendal_43d_clear_puresky:4k:hdri damp_beach_sand:2k:tex lambis_shell:2k:model
// Find Poly Haven ids at https://polyhaven.com (the id is the last part of an asset's URL).
import fs from "node:fs";
import path from "node:path";
import { MH, PH, parseArgs } from "./env.mjs";

const args = parseArgs(process.argv.slice(2));
const [what, ...specs] = args._;
const UA = { "user-agent": "reframer-realistic-3d-kit" };

const MAKEHUMAN = [
  {
    name: "add-on-mpfb-v2.0.18.zip",
    bytes: 45956992,
    licence: "GPL-3.0-or-later (installed into Blender, not bundled)",
    url: "https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip",
  },
  {
    name: "makehuman_system_assets_cc0.zip",
    bytes: 280737770,
    licence: "CC0",
    url: "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
  },
  { name: "faceunits01.zip", bytes: 257821, licence: "CC0", url: "https://files.makehumancommunity.org/functional/faceunits01.zip" },
];

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

const download = async (url, file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const part = `${file}.part`;
  fs.writeFileSync(part, Buffer.from(await r.arrayBuffer()));
  fs.renameSync(part, file);
  return fs.statSync(file).size;
};

/** The files of one Poly Haven asset: [{url, file, bytes}] (keeps the texture paths a .blend expects). */
const polyhavenFiles = async (spec) => {
  const [id, res = "2k", kind = "tex"] = spec.split(":");
  const r = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA });
  if (!r.ok) throw new Error(`Poly Haven has no asset "${id}" (${r.status})`);
  const f = await r.json();
  const base = path.join(PH, id);
  const out = [];
  const add = (e, name) => e && out.push({ url: e.url, bytes: e.size ?? 0, file: path.join(base, name ?? path.basename(new URL(e.url).pathname)) });
  if (kind === "hdri") add(f.hdri?.[res]?.hdr, `${id}_${res}.hdr`);
  else if (kind === "tex") for (const m of ["Diffuse", "nor_gl", "Rough", "Displacement", "AO"]) add(f[m]?.[res]?.jpg ?? f[m]?.[res]?.png);
  else {
    const b = f.blend?.[res]?.blend;
    if (!b) throw new Error(`"${id}" has no ${res} .blend (models need kind "model")`);
    add(b);
    for (const [rel, inc] of Object.entries(b.include ?? {})) add(inc, rel);
  }
  if (!out.length) throw new Error(`"${id}" has nothing at ${res} for kind ${kind}`);
  return out;
};

let plan;
if (what === "makehuman") {
  plan = MAKEHUMAN.map((m) => ({ ...m, file: path.join(MH, m.name) })).filter((m) => !fs.existsSync(m.file));
} else if (what === "polyhaven" && specs.length) {
  plan = [];
  for (const s of specs) for (const f of await polyhavenFiles(s)) if (!fs.existsSync(f.file)) plan.push({ ...f, licence: "CC0", name: path.relative(PH, f.file) });
} else {
  console.error("usage: node fetch.mjs makehuman [--yes] | node fetch.mjs polyhaven <id>:<res>:<kind> ... [--yes]");
  process.exit(2);
}

const total = plan.reduce((a, p) => a + (p.bytes || 0), 0);
if (!plan.length) {
  console.log(JSON.stringify({ ok: true, downloaded: [], note: "everything is already here" }));
  process.exit(0);
}
if (!args.yes) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        needsConsent: true,
        total: mb(total),
        files: plan.map((p) => ({ name: p.name, size: mb(p.bytes || 0), from: new URL(p.url).host, licence: p.licence })),
        hint: "Ask the user to approve these downloads, then run again with --yes",
      },
      null,
      2,
    ),
  );
  process.exit(3);
}
const done = [];
for (const p of plan) {
  console.error(`downloading ${p.name} (${mb(p.bytes || 0)})`);
  done.push({ name: p.name, size: mb(await download(p.url, p.file)) });
}
console.log(JSON.stringify({ ok: true, downloaded: done, total: mb(total) }, null, 2));
