# Tilt-shift miniature teaser: a little town crossroads at morning, time-lapse traffic and walkers.
# usage: blender -b --factory-startup --python mini_town.py -- <outdir> <hdri> [start end step scale spp]
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import common as C
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, HDRI = argv[0], argv[1]
START, END, STEP = (int(argv[2]), int(argv[3]), int(argv[4])) if len(argv) > 4 else (1, 150, 2)
SCALE = int(argv[5]) if len(argv) > 5 else 100
SPP = int(argv[6]) if len(argv) > 6 else 32
N = 150
random.seed(11)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = 1, N

w = bpy.data.worlds.new("Sky")
sc.world = w
w.use_nodes = True
nt = w.node_tree
nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
mp.name = "SkyRot"
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(HDRI)
bg = nt.nodes.new("ShaderNodeBackground")
bg.name = "SkyBG"
bg.inputs["Strength"].default_value = 1.2
out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
C.set_sun_azimuth(-125)


def mat(name, rgb, rough=0.6, metal=0.0, emit=None, noise=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    bs = t.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if emit:
        bs.inputs["Emission Color"].default_value = (*emit, 1)
        bs.inputs["Emission Strength"].default_value = 6.0
    if noise:
        tco = t.nodes.new("ShaderNodeTexCoord")
        nz = t.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 1.2
        nz.inputs["Detail"].default_value = 6
        t.links.new(tco.outputs["Object"], nz.inputs["Vector"])
        mix = t.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        cin = [s for s in mix.inputs if s.type == "RGBA"]
        mix.inputs[0].default_value = noise
        cin[0].default_value = (*rgb, 1)
        t.links.new(nz.outputs["Color"], cin[1])
        t.links.new([s for s in mix.outputs if s.type == "RGBA"][0], bs.inputs["Base Color"])
    return m


def box(name, loc, size, m, bevel=0.0, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.rotation_euler = (0, 0, rot)
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
    o.data.materials.append(m)
    return o


def cyl(name, loc, r, h, m, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o


def ball(name, loc, r, m, sz=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = sz
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o


grass = mat("Grass", (0.16, 0.42, 0.1), 0.85, noise=0.35)
asphalt = mat("Asphalt", (0.07, 0.07, 0.075), 0.8, noise=0.2)
walk = mat("Sidewalk", (0.62, 0.6, 0.56), 0.8, noise=0.15)
paint = mat("Paint", (0.92, 0.92, 0.9), 0.5)
glass = mat("Glass", (0.03, 0.05, 0.07), 0.08, metal=0.2)
bark = mat("Bark", (0.25, 0.15, 0.08), 0.8)
leaves = [mat(f"Leaves{i}", c, 0.7, noise=0.3) for i, c in enumerate(((0.12, 0.38, 0.08), (0.2, 0.45, 0.1), (0.1, 0.3, 0.12)))]
pastels = [(0.95, 0.72, 0.6), (0.98, 0.88, 0.62), (0.62, 0.8, 0.92), (0.72, 0.9, 0.78), (0.95, 0.62, 0.62), (0.88, 0.78, 0.95), (0.98, 0.95, 0.88)]
walls = [mat(f"Wall{i}", c, 0.75, noise=0.12) for i, c in enumerate(pastels)]
roofm = mat("Roof", (0.35, 0.33, 0.32), 0.8)

box("Ground", (0, 0, -0.05), (80, 80, 0.1), grass)
RW = 7.0
box("RoadX", (0, 0, 0.0), (80, RW, 0.02), asphalt)
box("RoadY", (0, 0, 0.001), (RW, 80, 0.02), asphalt)
for s in (-1, 1):
    box(f"WalkX{s}", (0, s * (RW / 2 + 1.25), 0.08), (80, 2.5, 0.16), walk)
    box(f"WalkY{s}", (s * (RW / 2 + 1.25), 0, 0.081), (2.5, 80, 0.16), walk)
for k in range(-12, 13):
    if abs(k) < 2:
        continue
    box(f"DashX{k}", (k * 3.2, 0, 0.012), (1.6, 0.15, 0.01), paint)
    box(f"DashY{k}", (0, k * 3.2, 0.013), (0.15, 1.6, 0.01), paint)
for s in (-1, 1):
    for k in range(-3, 4):
        box(f"ZebraX{s}{k}", (s * (RW / 2 + 1.6), k * 0.9, 0.014), (2.2, 0.45, 0.01), paint)
        box(f"ZebraY{s}{k}", (k * 0.9, s * (RW / 2 + 1.6), 0.015), (0.45, 2.2, 0.01), paint)

# buildings in three quadrants, a park in the fourth
blocks = [(1, 1), (-1, 1), (1, -1)]
bi = 0
for qx, qy in blocks:
    x = qx * (RW / 2 + 3.5)
    for row in range(3):
        y = qy * (RW / 2 + 3.5)
        for col in range(3):
            wdt, dep = random.uniform(5.5, 8.0), random.uniform(5.5, 8.0)
            h = random.uniform(5.0, 14.0)
            cx = x + qx * (col * 8.6 + wdt / 2)
            cy = y + qy * (row * 8.6 + dep / 2)
            if abs(cx) > 34 or abs(cy) > 34:
                continue
            wm = walls[bi % len(walls)]
            b = box(f"Bldg{bi}", (cx, cy, h / 2), (wdt, dep, h), wm, 0.15)
            # window rows facing the street sides
            floors = int(h // 3)
            for fl in range(floors):
                zf = 1.6 + fl * 3.0
                if zf > h - 0.8:
                    break
                for side in (-1, 1):
                    box(f"WinX{bi}_{fl}_{side}", (cx, cy + side * (dep / 2 + 0.02), zf), (wdt * 0.8, 0.05, 1.2), glass)
                    box(f"WinY{bi}_{fl}_{side}", (cx + side * (wdt / 2 + 0.02), cy, zf), (0.05, dep * 0.8, 1.2), glass)
            box(f"RoofTop{bi}", (cx, cy, h + 0.15), (wdt * 1.02, dep * 1.02, 0.3), roofm)
            if random.random() < 0.6:
                box(f"AC{bi}", (cx + random.uniform(-1, 1), cy + random.uniform(-1, 1), h + 0.7), (1.4, 1.0, 0.8), walk, 0.05)
            bi += 1
# park: trees, paths, fountain
px, py = -(RW / 2 + 15), -(RW / 2 + 15)
box("ParkPath", (px, py, 0.02), (24, 2.0, 0.03), walk)
box("ParkPath2", (px, py, 0.021), (2.0, 24, 0.03), walk)
cyl("Fountain", (px, py, 0.3), 2.2, 0.6, walk, 32)
cyl("FountainWater", (px, py, 0.55), 1.9, 0.1, mat("FWater", (0.2, 0.55, 0.75), 0.05), 32)
for k in range(26):
    tx = px + random.uniform(-12, 12)
    ty = py + random.uniform(-12, 12)
    if abs(tx - px) < 2.5 or abs(ty - py) < 2.5:
        continue
    r = random.uniform(1.4, 2.4)
    cyl(f"Trunk{k}", (tx, ty, r * 0.9), 0.22, r * 1.8, bark, 8)
    ball(f"Crown{k}", (tx, ty, r * 1.9 + 0.6), r, leaves[k % 3])
# street trees
for k in range(-6, 7):
    if abs(k) < 2:
        continue
    for s in (-1, 1):
        ball(f"STree{k}{s}", (k * 5.0, s * (RW / 2 + 2.2), 3.0), 1.2, leaves[(k + s) % 3])
        cyl(f"STrunk{k}{s}", (k * 5.0, s * (RW / 2 + 2.2), 1.2), 0.14, 2.4, bark, 8)
# traffic lights
redm = mat("Red", (0.8, 0.02, 0.02), 0.3, emit=(1.0, 0.05, 0.03))
greenm = mat("Green", (0.02, 0.8, 0.2), 0.3, emit=(0.05, 1.0, 0.3))
pole = mat("Pole", (0.15, 0.15, 0.16), 0.5, metal=0.6)
for sx, sy, axis in ((1, 1, "x"), (-1, -1, "x"), (1, -1, "y"), (-1, 1, "y")):
    lx, ly = sx * (RW / 2 + 0.6), sy * (RW / 2 + 0.6)
    cyl(f"TLPole{sx}{sy}", (lx, ly, 1.8), 0.08, 3.6, pole, 8)
    box(f"TLBox{sx}{sy}", (lx, ly, 3.7), (0.4, 0.4, 1.0), pole)
    ball(f"TLLamp{sx}{sy}", (lx, ly + (0.21 if axis == "x" else 0), 3.95), 0.13, greenm if axis == "x" else redm)

# cars: X road flows, Y road waits at the red light
carcols = [(0.85, 0.05, 0.05), (0.98, 0.78, 0.05), (0.05, 0.3, 0.85), (0.92, 0.92, 0.9), (0.95, 0.4, 0.05), (0.1, 0.6, 0.3), (0.55, 0.1, 0.7)]
carm = [mat(f"Car{i}", c, 0.25, metal=0.3) for i, c in enumerate(carcols)]
tire = mat("Tire", (0.02, 0.02, 0.02), 0.7)


def car(name, m):
    root = bpy.data.objects.new(name, None)
    sc.collection.objects.link(root)
    body = box(name + "B", (0, 0, 0.55), (4.2, 1.8, 0.7), m, 0.2)
    cab = box(name + "C", (-0.3, 0, 1.1), (2.2, 1.6, 0.6), glass, 0.15)
    for o in (body, cab):
        o.parent = root
    for dx in (-1.35, 1.35):
        for dy in (-0.85, 0.85):
            wh = cyl(name + f"W{dx}{dy}", (dx, dy, 0.33), 0.33, 0.25, tire, 12)
            wh.rotation_euler = (math.pi / 2, 0, 0)
            wh.parent = root
    return root


L = 80.0
cars = []
for k in range(9):
    lane = 1 if k % 2 == 0 else -1
    c = car(f"CarX{k}", carm[k % len(carm)])
    s0 = random.uniform(0, L)
    v = random.uniform(11, 15) * lane  # time-lapse speed (m per second of screen time)
    for f in range(1, N + 1, 1):
        t = (f - 1) / 30
        x = ((s0 + v * t) % L) - L / 2
        c.location = (x, -lane * 1.75, 0.0)
        c.rotation_euler = (0, 0, 0 if lane > 0 else math.pi)
        c.keyframe_insert("location", frame=f)
        c.keyframe_insert("rotation_euler", frame=f)
    cars.append(c)
for k in range(6):
    side = 1 if k < 3 else -1
    c = car(f"CarY{k}", carm[(k + 3) % len(carm)])
    c.location = (side * 1.75 * -1, side * (RW / 2 + 4.0 + (k % 3) * 5.6), 0.0)
    c.rotation_euler = (0, 0, -math.pi / 2 if side > 0 else math.pi / 2)
# walkers on the X sidewalks
shirt = [mat(f"Shirt{i}", c, 0.7) for i, c in enumerate(((0.9, 0.2, 0.2), (0.2, 0.4, 0.9), (0.95, 0.8, 0.2), (0.2, 0.7, 0.4), (0.95, 0.95, 0.95)))]
skin = mat("Skin", (0.85, 0.6, 0.45), 0.6)
for k in range(16):
    side = 1 if k % 2 else -1
    root = bpy.data.objects.new(f"Walker{k}", None)
    sc.collection.objects.link(root)
    b = cyl(f"WB{k}", (0, 0, 0.75), 0.22, 1.1, shirt[k % 5], 10)
    hd = ball(f"WH{k}", (0, 0, 1.5), 0.17, skin)
    b.parent = root
    hd.parent = root
    s0 = random.uniform(0, L)
    v = random.uniform(1.6, 2.6) * (1 if random.random() < 0.5 else -1)
    for f in range(1, N + 1, 2):
        t = (f - 1) / 30
        x = ((s0 + v * t) % L) - L / 2
        root.location = (x, side * (RW / 2 + 1.25 + random.uniform(-0.6, 0.6) * 0), 0.16)
        root.keyframe_insert("location", frame=f)

# camera: high and far with a razor-thin focus plane = miniature
cam = C.camera("Cam", 55)
tgt = Vector((1.0, 1.5, 0.5))
for f, pos in ((1, (-24.0, -36.0, 44.0)), (N, (-19.0, -38.5, 43.0))):
    cam.location = pos
    C.look_at(cam, tgt)
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
C.ease_keys(cam)
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = (Vector((-21.5, -37.2, 43.5)) - tgt).length
cam.data.dof.aperture_fstop = 0.07

C.setup_render(1080 * SCALE // 100, 1920 * SCALE // 100, SPP, motion_blur=False)
sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.denoising_use_gpu = True
sc.view_settings.exposure = 0.2
os.makedirs(OUT, exist_ok=True)
C.render_frames(OUT, START, END, STEP, "mini")
print("DONE mini")
