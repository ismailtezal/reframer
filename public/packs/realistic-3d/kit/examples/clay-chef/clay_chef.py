# Claymation teaser "Kil Şef": a tiny clay chef flips a pancake, it vanishes up, he waits, it lands on his face.
# Stop-motion at 15 fps (render every 2nd frame), hand-made lumps that boil, soft studio light.
# usage: blender -b --factory-startup --python clay_chef.py -- <outdir> [start end step scale spp]
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import common as C
import styles as ST
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
START, END, STEP = (int(argv[1]), int(argv[2]), int(argv[3])) if len(argv) > 3 else (1, 180, 2)
SCALE = int(argv[4]) if len(argv) > 4 else 100
SPP = int(argv[5]) if len(argv) > 5 else 32
N = 180
random.seed(4)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = 1, N
w = bpy.data.worlds.new("Studio")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.95, 0.85, 0.78, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45


def blob(kind, name, loc, size, mat, parent=None, bevel=0.0, seg=40, sub=1):
    if kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1.0, depth=2.0)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1.0)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.35, major_segments=seg, minor_segments=16)
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
        b.segments = 5
        b.limit_method = "NONE"
    if sub:
        s = o.modifiers.new("Smooth", "SUBSURF")
        s.levels = s.render_levels = sub
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


M = ST.clay_solid
wall = M("Wall", (0.98, 0.62, 0.42), 0.8, 0.0, 0.2)
counter = M("Counter", (0.35, 0.72, 0.68), 0.7, 0.0, 0.3)
tile = M("Tile", (0.97, 0.93, 0.85), 0.5, 0.0, 0.15)
white = M("ChefWhite", (0.96, 0.95, 0.92), 0.5, 0.05, 0.3)
skin = M("Skin", (0.95, 0.62, 0.45), 0.5, 0.15, 0.4)
black = M("Black", (0.015, 0.012, 0.012), 0.35, 0.0, 0.25)
pants = M("Pants", (0.12, 0.12, 0.16), 0.6, 0.0, 0.4)
red = M("Scarf", (0.85, 0.08, 0.1), 0.55, 0.05, 0.4)
pupil = M("Pupil", (0.01, 0.01, 0.012), 0.2, 0.0, 0.05)
cheek = M("Cheek", (0.98, 0.45, 0.42), 0.5, 0.1, 0.2)
cake = M("Pancake", (0.86, 0.5, 0.17), 0.6, 0.08, 0.5)
pan_m = M("Pan", (0.05, 0.05, 0.06), 0.3, 0.0, 0.2)
stove_m = M("Stove", (0.92, 0.92, 0.95), 0.4, 0.0, 0.2)
flame = M("Flame", (1.0, 0.45, 0.05), 0.4, 0.0, 0.1)
flame.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.45, 0.05, 1)
flame.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 4.0

# set: back wall with tiles, counter top, small stove
blob("cube", "Wall", (0, 0.35, 0.6), (1.6, 0.02, 0.8), wall, sub=0)
for i in range(-6, 7):
    for j in range(0, 6):
        blob("cube", f"Tile{i}_{j}", (i * 0.105, 0.325, 0.1 + j * 0.105), (0.048, 0.006, 0.048), tile, bevel=0.01, sub=0)
blob("cube", "Counter", (0, 0.0, -0.02), (1.6, 0.4, 0.04), counter, bevel=0.01, sub=0)
blob("cube", "Stove", (-0.17, -0.2, 0.035), (0.11, 0.09, 0.035), stove_m, bevel=0.012)
blob("torus", "Burner", (-0.17, -0.2, 0.072), (0.05, 0.05, 0.02), black)
for k in range(8):
    a = k / 8 * 2 * math.pi
    fl = blob("sphere", f"Flame{k}", (-0.17 + 0.045 * math.cos(a), -0.2 + 0.045 * math.sin(a), 0.082), (0.008, 0.008, 0.016), flame, sub=0)

# the chef (~0.36 m figurine)
root = empty("Chef", (-0.07, 0.0, 0.0))
S = 0.2
for sx in (-1, 1):
    blob("cyl", f"Leg{sx}", (0.055 * sx, 0, 0.065), (0.035, 0.035, 0.06), pants, root)
    blob("sphere", f"Shoe{sx}", (0.058 * sx, -0.02, 0.015), (0.035, 0.05, 0.02), black, root)
body = blob("sphere", "Body", (0, 0, 0.19), (0.095, 0.075, 0.1), white, root)
for k in range(3):
    blob("sphere", f"Button{k}", (0.0, -0.074, 0.15 + k * 0.035), (0.008, 0.005, 0.008), black, root, sub=0)
blob("torus", "Scarf", (0, 0, 0.285), (0.055, 0.05, 0.03), red, root)
headp = empty("HeadPivot", (0, 0, 0.29), root)
head = blob("sphere", "Head", (0, 0, 0.075), (0.078, 0.07, 0.08), skin, headp)
blob("sphere", "Nose", (0, -0.075, 0.07), (0.022, 0.022, 0.02), skin, headp)
for sx in (-1, 1):
    blob("sphere", f"Cheek{sx}", (0.045 * sx, -0.055, 0.05), (0.016, 0.008, 0.012), cheek, headp, sub=0)
must = []
for sx in (-1, 1):
    m_ = blob("sphere", f"Must{sx}", (0.026 * sx, -0.075, 0.045), (0.032, 0.012, 0.012), black, headp)
    m_.rotation_euler = (0, math.radians(-18 * sx), 0)
    must.append(m_)
eyes, pups, lids = [], [], []
for sx in (-1, 1):
    e = blob("sphere", f"EyeW{sx}", (0.028 * sx, -0.06, 0.1), (0.019, 0.012, 0.024), white, headp, sub=1)
    p = blob("sphere", f"Pupil{sx}", (0.028 * sx, -0.072, 0.102), (0.008, 0.005, 0.01), pupil, headp, sub=0)
    br = blob("cyl", f"Brow{sx}", (0.03 * sx, -0.066, 0.132), (0.005, 0.005, 0.016), black, headp, sub=0)
    br.rotation_euler = (0, math.radians(90 + 14 * sx), 0)
    eyes.append(e)
    pups.append(p)
    lids.append(br)
mouth = blob("sphere", "Mouth", (0, -0.068, 0.028), (0.016, 0.006, 0.006), black, headp, sub=0)
hat = empty("Hat", (0, 0, 0.14), headp)
blob("cyl", "HatBand", (0, 0, 0.0), (0.065, 0.065, 0.025), white, hat)
for k, (x, y, z, r) in enumerate(((0, 0, 0.065, 0.06), (-0.04, 0.0, 0.055, 0.045), (0.04, 0.0, 0.055, 0.045), (0, -0.03, 0.05, 0.045), (0, 0.03, 0.05, 0.045))):
    blob("sphere", f"HatPuff{k}", (x, y, z), (r, r, r * 0.9), white, hat)
# arms: left on hip, right holds the pan over the stove
shR = empty("ShoulderR", (-0.09, 0, 0.24), root)
blob("sphere", "SleeveR", (0, 0, 0), (0.032, 0.032, 0.032), white, shR)
blob("cyl", "ArmR", (0, 0, -0.06), (0.022, 0.022, 0.055), white, shR)
handR = blob("sphere", "HandR", (0, 0, -0.12), (0.024, 0.022, 0.024), skin, shR)
shL = empty("ShoulderL", (0.09, 0, 0.24), root)
blob("sphere", "SleeveL", (0, 0, 0), (0.032, 0.032, 0.032), white, shL)
blob("cyl", "ArmL", (0, 0, -0.06), (0.022, 0.022, 0.055), white, shL)
blob("sphere", "HandL", (0, 0, -0.12), (0.024, 0.022, 0.024), skin, shL)
shL.rotation_euler = (0, math.radians(35), 0)
panp = empty("PanPivot", (0, 0, -0.125), shR)
blob("cyl", "PanHandle", (0, -0.0, -0.0), (0.008, 0.008, 0.05), black, panp, sub=0).rotation_euler = (math.radians(90), 0, 0)
pan = blob("cyl", "Pan", (0, -0.12, 0.0), (0.06, 0.06, 0.008), pan_m, panp, bevel=0.006)
cakeo = blob("cyl", "Cake", (0, 0, 0), (0.05, 0.05, 0.007), cake, None, bevel=0.006)

# ---------------- animation (30 fps keys; rendered every 2nd frame = 15 fps stop-motion)
def key(o, f, loc=None, rot=None, scl=None):
    if loc is not None:
        o.location = loc
        o.keyframe_insert("location", frame=f)
    if rot is not None:
        o.rotation_euler = rot
        o.keyframe_insert("rotation_euler", frame=f)
    if scl is not None:
        o.scale = scl
        o.keyframe_insert("scale", frame=f)


D = math.radians
# right arm: hold pan forward (rot X back), dip, jerk up, hold up, lower
for f, r in ((1, (D(-70), D(10), 0)), (28, (D(-70), D(10), 0)), (34, (D(-55), D(10), 0)), (40, (D(-125), D(10), 0)),
             (60, (D(-120), D(10), 0)), (100, (D(-112), D(10), 0)), (112, (D(-80), D(18), 0)), (N, (D(-75), D(18), 0))):
    key(shR, f, rot=r)
for f, ax in ((1, 70), (28, 70), (34, 65), (40, 95), (50, 122), (60, 120), (100, 112), (112, 80), (N, 75)):
    key(panp, f, rot=(D(ax), 0, 0))
# head: confident nod, looks up after the flip, looks left/right, flinch on impact
for f, r in ((1, (D(-4), 0, 0)), (14, (D(-8), 0, D(4))), (28, (D(-2), 0, 0)), (46, (D(24), 0, 0)), (66, (D(26), 0, 0)),
             (76, (D(10), 0, D(-22))), (88, (D(10), 0, D(22))), (98, (D(14), 0, 0)), (104, (D(28), 0, 0)), (112, (D(-6), 0, 0)), (N, (D(-4), 0, 0))):
    key(headp, f, rot=r)
# pupils: at camera, up, left, right, up
for pu, sx in zip(pups, (-1, 1)):
    base = Vector((0.028 * sx, -0.072, 0.102))
    for f, off in ((1, (0, 0, 0)), (44, (0, 0.002, 0.009)), (72, (-0.008, 0, 0.002)), (84, (0.008, 0, 0.002)), (98, (0, 0.002, 0.009)), (112, (0, 0, 0))):
        key(pu, f, loc=base + Vector(off))
# blink twice under the pancake (eye whites squash)
for e in eyes:
    for f, s in ((1, 1), (126, 1), (128, 0.12), (132, 1), (148, 1), (150, 0.12), (154, 1)):
        key(e, f, scl=(1, 1, s))
# brows: up (proud) then knit (confused) then droop
for b, sx in zip(lids, (-1, 1)):
    base = Vector((0.03 * sx, -0.066, 0.132))
    for f, dz, rz in ((1, 0.006, 0), (66, 0.004, 0), (76, -0.002, -14 * sx), (112, -0.006, 18 * sx), (N, -0.006, 18 * sx)):
        key(b, f, loc=base + Vector((0, 0, dz)), rot=(0, D(90 + 14 * sx), D(rz)))
# mouth: smile line, O when it is gone, flat after impact
for f, s in ((1, (1.2, 1, 0.8)), (44, (0.7, 1, 1.8)), (100, (0.8, 1, 2.2)), (114, (1.4, 1, 0.5)), (N, (1.4, 1, 0.5))):
    key(mouth, f, scl=s)
# mustache droops after impact
for m_, sx in zip(must, (-1, 1)):
    for f, r in ((1, (0, D(-18 * sx), 0)), (112, (0, D(-18 * sx), 0)), (122, (0, D(25 * sx), 0)), (N, (0, D(28 * sx), 0))):
        key(m_, f, rot=r)
for f, s in ((1, 1.0), (112, 1.0), (114, 0.55), (118, 0.8), (122, 0.72), (N, 0.72)):
    key(hat, f, scl=(1 + (1 - s) * 0.4, 1 + (1 - s) * 0.4, s))
# whole body: little bounce, squash on impact
for f, z, s in ((1, 0, 1.0), (14, 0.004, 1.02), (28, 0, 1.0), (112, 0, 1.0), (114, -0.004, 0.86), (118, 0, 1.06), (122, 0, 0.98), (126, 0, 1.0), (N, 0, 1.0)):
    key(root, f, loc=(-0.07, 0.0, z), scl=(1 + (1 - s) * 0.5, 1 + (1 - s) * 0.5, s))
# the pancake: rides the pan, flies up out of frame, falls back onto the face, drapes
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
for f in range(1, N + 1):
    sc.frame_set(f)
    panw = pan.matrix_world
    head_w = hat.matrix_world @ Vector((0, -0.005, 0.12))
    if f <= 38:
        pos = panw @ Vector((0, 0, 0.012))
        rot = panw.to_euler()
        scl = (1, 1, 1)
    elif f <= 60:
        t = (f - 38) / 22
        p0 = (pan.matrix_world @ Vector((0, 0, 0.012)))
        pos = p0 + Vector((0.01 * t, 0.0, 0.75 * (1 - (1 - t) ** 2)))
        rot = (D(360 * 1.5 * t), D(40 * t), 0)
        scl = (1, 1, 1)
    elif f < 100:
        pos = Vector((-0.06, -0.02, 1.6))
        rot = (0, 0, 0)
        scl = (1, 1, 1)
    elif f <= 112:
        t = (f - 100) / 12
        pos = Vector((-0.06, -0.02, 1.4)).lerp(head_w, t * t)
        rot = (D(8), 0, D(10))
        scl = (1, 1, 1)
    else:
        k = f - 112
        pos = head_w + Vector((0, -0.03, 0.025))
        rot = (D(38), D(-6), D(6))
        sq = {0: 0.5, 1: 0.5, 2: 1.2, 3: 1.2, 4: 0.9, 5: 0.9}.get(k, 1.0)
        scl = (1.45 + (1 - sq) * 0.3, 1.45 + (1 - sq) * 0.3, 0.8 * sq)
    cakeo.location = pos
    cakeo.rotation_euler = rot
    cakeo.scale = scl
    cakeo.keyframe_insert("location", frame=f)
    cakeo.keyframe_insert("rotation_euler", frame=f)
    cakeo.keyframe_insert("scale", frame=f)
sc.frame_set(1)

# hand-made lumps that boil every 2 frames
tex = bpy.data.textures.new("Lumps", "CLOUDS")
tex.noise_scale = 0.015
hand = empty("Hand", (0, 0, 0))
for f in range(1, N + 2, 2):
    key(hand, f, loc=(random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
for o in bpy.data.objects:
    if o.type == "MESH" and not o.name.startswith(("Wall", "Tile", "Counter", "Flame")):
        md = o.modifiers.new("Lumps", "DISPLACE")
        md.texture = tex
        md.texture_coords = "OBJECT"
        md.texture_coords_object = hand
        md.strength = 0.0018
        md.mid_level = 0.5


def area(name, loc, target, energy, size, col):
    L = bpy.data.lights.new(name, "AREA")
    L.energy, L.size, L.color = energy, size, col
    o = bpy.data.objects.new(name, L)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


area("Key", (-0.7, -0.8, 0.9), (0, 0, 0.25), 70, 0.8, (1.0, 0.9, 0.8))
area("Fill", (0.8, -0.6, 0.4), (0, 0, 0.2), 22, 1.0, (0.8, 0.88, 1.0))
area("Rim", (0.2, 0.25, 0.8), (0, 0, 0.3), 30, 0.5, (1.0, 0.95, 0.9))

cam = C.camera("Cam", 45)
keys = ((1, (-0.04, -1.05, 0.34), (-0.06, 0.0, 0.3)), (36, (-0.04, -1.02, 0.35), (-0.06, 0.0, 0.32)),
        (50, (-0.04, -1.05, 0.42), (-0.06, 0.0, 0.48)), (96, (-0.04, -1.05, 0.42), (-0.06, 0.0, 0.46)),
        (110, (-0.04, -1.0, 0.36), (-0.07, 0.0, 0.34)), (N, (-0.05, -0.88, 0.36), (-0.07, 0.0, 0.35)))
for f, pos, tgt in keys:
    cam.location = pos
    C.look_at(cam, tgt)
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
C.ease_keys(cam)
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 1.0
cam.data.dof.aperture_fstop = 3.2
jit = empty("CamJitter", (0, 0, 0))
for f in range(1, N + 2, 2):
    key(jit, f, loc=(random.uniform(-0.0007, 0.0007), random.uniform(-0.0007, 0.0007), random.uniform(-0.0005, 0.0005)))
for o in (jit, hand):
    for fc in C.action_fcurves(o):
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"
c = cam.constraints.new("CHILD_OF")
c.target = jit
c.inverse_matrix = jit.matrix_world.inverted()

C.setup_render(1080 * SCALE // 100, 1920 * SCALE // 100, SPP, motion_blur=False)
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.denoising_use_gpu = True
sc.view_settings.exposure = -0.9
os.makedirs(OUT, exist_ok=True)
C.render_frames(OUT, START, END, STEP, "chef")
print("DONE chef")
