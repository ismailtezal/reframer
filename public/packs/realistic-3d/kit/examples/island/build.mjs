// Builds the island example end to end into a work folder: the shirt print, the textures, the hero, the island,
// then preview stills of every shot (out: <work>/frames/preview-sheet.jpg).
//   node build.mjs [--work <dir>] [--print "REFRAMER"] [--no-preview]
// Needs setup.mjs --install done and these Poly Haven assets (fetch.mjs, after the user agreed):
//   kloofendal_43d_clear_puresky:4k:hdri damp_beach_sand:2k:tex coast_sand_01:2k:tex palm_tree_bark:2k:tex lambis_shell:2k:model
// Then render: node ../../render.mjs --blend <work>/island.blend --script shots.py --out <work>/frames
//              --profile final --workers 2 -- <work>/tex <PH>
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLENDER_SCRIPTS, HOME, PH, PROFILE, parseArgs, runBlender } from "../../env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, "..", "..");
const args = parseArgs(process.argv.slice(2));
const work = path.resolve(String(args.work ?? path.join(HOME, "work", "island")));
const print = String(args.print ?? "REFRAMER");
fs.mkdirSync(work, { recursive: true });

const NEEDS = ["kloofendal_43d_clear_puresky:4k:hdri", "damp_beach_sand:2k:tex", "coast_sand_01:2k:tex", "palm_tree_bark:2k:tex", "lambis_shell:2k:model"];
const missing = NEEDS.filter((s) => !fs.existsSync(path.join(PH, s.split(":")[0])));
if (missing.length) {
  console.error(`Missing Poly Haven assets. Ask the user, then: node ${path.join(KIT, "fetch.mjs")} polyhaven ${missing.join(" ")} --yes`);
  process.exit(3);
}
const node = (script, list) => {
  const r = spawnSync(process.execPath, [script, ...list], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`${path.basename(script)} exited ${r.status}`);
};
const blender = async (list, what) => {
  console.error(`-- ${what}`);
  const code = await runBlender(list, { env: { RF3D_BLENDER: BLENDER_SCRIPTS, RF3D_PRINT: print } });
  if (code !== 0) throw new Error(`${what} failed (exit ${code})`);
};

// 1. the t-shirt: MakeHuman's casual suit with the print
const clothes = path.join(PROFILE, "extensions", ".user", "user_default", "mpfb", "data", "clothes", "male_casualsuit04");
const diffuse = fs.existsSync(clothes) ? fs.readdirSync(clothes).find((f) => /diffuse.*\.png$/i.test(f)) : null;
if (!diffuse) throw new Error("male_casualsuit04 not found: run `node setup.mjs --install` first");
node(path.join(KIT, "garment-print.mjs"), ["--in", path.join(clothes, diffuse), "--out", path.join(work, "shirt.png"), "--text", print]);
// 2. phone and laptop screens, signs, sand-writing and footprint height maps
node(path.join(HERE, "textures.mjs"), [path.join(work, "tex"), "--sign", print]);
// 3. the hero
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "hero.json"), "utf8").replaceAll("{work}", work.replaceAll("\\", "/")));
fs.writeFileSync(path.join(work, "hero.json"), JSON.stringify(spec, null, 2));
await blender(["-b", "--python", path.join(BLENDER_SCRIPTS, "rf3d_human.py"), "--", path.join(work, "hero.json"), path.join(work, "hero.blend")], "hero");
// 4. the island around him
await blender(["-b", path.join(work, "hero.blend"), "--python", path.join(HERE, "island.py"), "--", PH, path.join(work, "island.blend")], "island");
// 5. preview stills of every shot
if (!args["no-preview"]) {
  node(path.join(KIT, "render.mjs"), [
    "--blend",
    path.join(work, "island.blend"),
    "--script",
    path.join(HERE, "shots.py"),
    "--out",
    path.join(work, "frames"),
    "--profile",
    "preview",
    "--",
    path.join(work, "tex"),
    PH,
  ]);
}
console.log(JSON.stringify({ ok: true, work, island: path.join(work, "island.blend"), sheet: path.join(work, "frames", "preview-sheet.jpg") }));
