# Claymation teaser: a pancake flips out of a pan onto a stack, butter drops, syrup oozes. Stop-motion at 15 fps.
# usage: blender -b --factory-startup --python clay_pancake.py -- <outdir> [start end step scale spp]
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import common as C
import styles as ST
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
START, END, STEP = (int(argv[1]), int(argv[2]), int(argv[3])) if len(argv) > 3 else (1, 150, 2)
SCALE = int(argv[4]) if len(argv) > 4 else 100
SPP = int(argv[5]) if len(argv) > 5 else 32
N = 150
random.seed(4)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = 1, N

# world: soft neutral studio light
w = bpy.data.worlds.new("Studio")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.95, 0.82, 0.76, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55


def blob(kind, name, loc, size, mat, bevel=0.0, seg=48, sub=1):
    if kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1.0, depth=2.0)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1.0)
    else:
        bpy.ops.mesh.primitive_cube_add(size=2.0)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.location = loc
    if bevel:
        b = o.modifiers.new("Round", "BEVEL")
        b.width = bevel
        b.segments = 6
        b.limit_method = "NONE"
    if sub:
        s = o.modifiers.new("Smooth", "SUBSURF")
        s.levels = s.render_levels = sub
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


peach = ST.clay_solid("ClayPeach", (0.96, 0.58, 0.5), 0.75, 0.0, 0.18)
mint = ST.clay_solid("ClayMint", (0.42, 0.78, 0.68), 0.7, 0.0, 0.25)
white = ST.clay_solid("ClayPlate", (0.95, 0.94, 0.9), 0.35, 0.0, 0.12)
cake = ST.clay_solid("ClayPancake", (0.86, 0.5, 0.17), 0.6, 0.08, 0.5)
cake_top = ST.clay_solid("ClayPancakeTop", (0.62, 0.3, 0.08), 0.55, 0.05, 0.55)
butter = ST.clay_solid("ClayButter", (1.0, 0.86, 0.32), 0.45, 0.1, 0.25)
syrup = ST.clay_solid("ClaySyrup", (0.42, 0.13, 0.02), 0.08, 0.15, 0.08)
pan_m = ST.clay_solid("ClayPan", (0.04, 0.04, 0.045), 0.35, 0.0, 0.2)
berry = ST.clay_solid("ClayBerry", (0.75, 0.04, 0.12), 0.35, 0.1, 0.3)
leafm = ST.clay_solid("ClayMintLeaf", (0.1, 0.5, 0.12), 0.5, 0.0, 0.3)

# sweep backdrop (floor curving into a wall)
bpy.ops.mesh.primitive_plane_add(size=1)
sweep = bpy.context.active_object
sweep.name = "Sweep"
me = sweep.data
import bmesh
bm = bmesh.new()
cols, rows = 40, 40
verts = []
for j in range(rows + 1):
    t = j / rows
    if t < 0.55:
        y, z = -1.2 + t / 0.55 * 1.4, 0.0
    else:
        a = (t - 0.55) / 0.45 * math.pi / 2
        y, z = 0.2 + 0.6 * math.sin(a), 0.6 * (1 - math.cos(a)) + max(0, (t - 0.95)) * 6
    row = []
    for i in range(cols + 1):
        row.append(bm.verts.new((-1.2 + 2.4 * i / cols, y, z)))
    verts.append(row)
for j in range(rows):
    for i in range(cols):
        bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
sweep.data.materials.append(peach)
table = blob("cyl", "Mat", (0, -0.08, 0.004), (0.34, 0.34, 0.004), mint, 0.003, 64, 0)

# plate + stack
blob("cyl", "Plate", (0, -0.08, 0.016), (0.17, 0.17, 0.008), white, 0.006, 64)
stack = []
z = 0.03
for k in range(4):
    p = blob("cyl", f"Cake{k}", (random.uniform(-0.006, 0.006), -0.08 + random.uniform(-0.006, 0.006), z + 0.011),
             (0.105 + random.uniform(-0.004, 0.004), 0.105, 0.011), cake, 0.009, 48)
    p.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), random.uniform(0, 3))
    stack.append(p)
    z += 0.022
top_z = z
# pan on the left with the flying pancake
pan = blob("cyl", "Pan", (-0.21, -0.25, 0.03), (0.11, 0.11, 0.012), pan_m, 0.01, 48)
handle = blob("cube", "PanHandle", (-0.37, -0.31, 0.04), (0.08, 0.016, 0.01), pan_m, 0.008, 8)
handle.rotation_euler = (0, 0, math.radians(18))
pan.rotation_euler = (0, math.radians(-8), 0)
fly = blob("cyl", "FlyCake", (-0.21, -0.25, 0.05), (0.1, 0.1, 0.011), cake_top, 0.009, 48)
land = Vector((0.0, -0.08, top_z + 0.011))
start = Vector((-0.21, -0.25, 0.05))
f0, f1 = 14, 50
for f in range(1, N + 1):
    if f <= f0:
        pos, rot, sq = start, 0.0, 1.0
        pan.rotation_euler.y = math.radians(-8 - 10 * C.ss(f0 - 6, f0, f))
    elif f <= f1:
        t = (f - f0) / (f1 - f0)
        pos = start.lerp(land, t) + Vector((0, 0, 0.42 * 4 * t * (1 - t)))
        rot = 2 * math.pi * C.ss(0, 1, t)
        sq = 1.0
    else:
        pos, rot = land, 2 * math.pi
        k = f - f1
        sq = {0: 0.55, 1: 0.55, 2: 1.15, 3: 1.15, 4: 0.95, 5: 0.95}.get(k, 1.0)
    fly.location = pos
    fly.rotation_euler = (rot, 0, 0)
    fly.scale = (1 + (1 - sq) * 0.35, 1 + (1 - sq) * 0.35, sq)
    for path in ("location", "rotation_euler", "scale"):
        fly.keyframe_insert(path, frame=f)
    pan.keyframe_insert("rotation_euler", frame=f)
# butter drops at 70
bt = blob("cube", "Butter", (0.01, -0.075, top_z + 0.6), (0.026, 0.026, 0.018), butter, 0.008, 8)
bz = top_z + 0.022 + 0.018
for f in range(1, N + 1):
    if f < 62:
        z_ = top_z + 0.6
        s = 1.0
    elif f <= 74:
        t = (f - 62) / 12
        z_ = top_z + 0.6 - (0.6 - (bz - top_z)) * t * t
        s = 1.0
    else:
        z_ = bz
        k = f - 74
        s = {0: 0.6, 1: 0.6, 2: 1.12, 3: 1.12}.get(k, 1.0)
    bt.location.z = z_ - (1 - s) * 0.009
    bt.scale = (1 + (1 - s) * 0.4, 1 + (1 - s) * 0.4, s)
    bt.rotation_euler = (0, 0, math.radians(25))
    bt.keyframe_insert("location", frame=f)
    bt.keyframe_insert("scale", frame=f)
    bt.keyframe_insert("rotation_euler", frame=f)
# syrup: a glossy cap that spreads, then drips slide down the sides
cap = blob("sphere", "SyrupCap", (0.0, -0.08, top_z + 0.024), (0.08, 0.08, 0.012), syrup, 0, 48)
for f, s in ((1, 0.001), (84, 0.001), (100, 0.75), (118, 1.05), (N, 1.12)):
    cap.scale = (s, s, max(s, 0.001))
    cap.keyframe_insert("scale", frame=f)
for d, ang in enumerate((0.4, 2.3, 4.1)):
    x, y = 0.1 * math.cos(ang), -0.08 + 0.1 * math.sin(ang)
    dr = blob("sphere", f"Drip{d}", (x, y, top_z + 0.012), (0.012, 0.012, 0.02), syrup, 0, 24)
    for f, zz, ss_ in ((1, top_z + 0.012, 0.001), (104 + d * 4, top_z + 0.012, 0.001), (118 + d * 4, top_z - 0.02, 1.0), (N, top_z - 0.045 - d * 0.01, 1.25)):
        dr.location.z = zz
        dr.scale = (ss_, ss_, ss_ * 1.6)
        dr.keyframe_insert("location", frame=f)
        dr.keyframe_insert("scale", frame=f)
# garnish: berries + mint leaf near the plate
for k, (x, y) in enumerate(((0.14, -0.2), (0.17, -0.15), (0.12, -0.24))):
    blob("sphere", f"Berry{k}", (x, y, 0.027), (0.018, 0.018, 0.018), berry, 0, 24)
lf = blob("sphere", "Leaf", (0.15, -0.18, 0.05), (0.03, 0.012, 0.004), leafm, 0, 24)
lf.rotation_euler = (0.3, 0.2, 0.8)

# lumpy hand-made surfaces that "boil" every two frames
tex = bpy.data.textures.new("ClayLumps", "CLOUDS")
tex.noise_scale = 0.02
hand = bpy.data.objects.new("ClayHand", None)
sc.collection.objects.link(hand)
for f in range(1, N + 2, 2):
    hand.location = (random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))
    hand.keyframe_insert("location", frame=f)
for o in bpy.data.objects:
    if o.type == "MESH" and o.name not in ("Sweep", "Mat"):
        md = o.modifiers.new("Lumps", "DISPLACE")
        md.texture = tex
        md.texture_coords = "OBJECT"
        md.texture_coords_object = hand
        md.strength = 0.0025
        md.mid_level = 0.5

# lights: warm key, cool fill, rim
def area(name, loc, target, energy, size, col):
    L = bpy.data.lights.new(name, "AREA")
    L.energy, L.size, L.color = energy, size, col
    o = bpy.data.objects.new(name, L)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


area("Key", (-0.9, -0.9, 1.0), (0, -0.08, 0.1), 140, 0.9, (1.0, 0.9, 0.78))
area("Fill", (0.9, -0.7, 0.5), (0, -0.08, 0.1), 45, 1.2, (0.8, 0.88, 1.0))
area("Rim", (0.3, 0.6, 0.9), (0, -0.08, 0.15), 60, 0.6, (1.0, 0.95, 0.9))

cam = C.camera("Cam", 50)
tgt = Vector((-0.015, -0.1, 0.13))
for f, pos in ((1, (0.12, -0.82, 0.37)), (N, (0.08, -0.68, 0.33))):
    cam.location = pos
    C.look_at(cam, tgt)
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
C.ease_keys(cam)
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = (Vector((0.2, -0.74, 0.34)) - Vector((0, -0.08, 0.1))).length
cam.data.dof.aperture_fstop = 2.8
# stop-motion camera nudges
jit = bpy.data.objects.new("CamJitter", None)
sc.collection.objects.link(jit)
for f in range(1, N + 2, 2):
    jit.location = (random.uniform(-0.0008, 0.0008), random.uniform(-0.0008, 0.0008), random.uniform(-0.0006, 0.0006))
    jit.keyframe_insert("location", frame=f)
for o in (jit, hand):
    for fc in C.action_fcurves(o):
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"
c = cam.constraints.new("CHILD_OF")
c.target = jit
c.inverse_matrix = jit.matrix_world.inverted()

C.setup_render(1080 * SCALE // 100, 1920 * SCALE // 100, SPP, motion_blur=False)
sc.view_settings.exposure = -1.25
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.denoising_use_gpu = True
os.makedirs(OUT, exist_ok=True)
C.render_frames(OUT, START, END, STEP, "clay")
print("DONE clay")
