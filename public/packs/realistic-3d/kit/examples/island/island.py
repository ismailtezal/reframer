# Builds the island world around the hero (open hero.blend from rf3d_human.py first) and saves island.blend:
#     blender -b hero.blend --python island.py -- <polyhaven-dir> <island.blend>     (build.mjs runs it)
# Real assets: Poly Haven HDRI sky + sand/bark textures + shell (CC0). Built here: ocean (Blender ocean sim),
# terrain from a height function (fine top + coarse seabed), procedural coconut palm, coconuts.
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, Euler, noise

argv = sys.argv[sys.argv.index("--") + 1:]
PH, OUT = argv[0], argv[1]
sc = bpy.context.scene
random.seed(7)
FPS = 30
sc.render.fps = FPS


def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def load_img(path, non_color=False):
    im = bpy.data.images.load(path, check_existing=True)
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def ph(asset, kind):
    d = os.path.join(PH, asset)
    return os.path.join(d, next(f for f in os.listdir(d) if f"_{kind}_" in f))


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt


def mixc(nt, fac, a, b, blend="MIX"):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = blend
    cin = [s for s in n.inputs if s.type == "RGBA"]
    for s, v in ((n.inputs[0], fac), (cin[0], a), (cin[1], b)):
        if isinstance(v, (int, float)):
            s.default_value = v
        elif isinstance(v, tuple):
            s.default_value = v
        else:
            nt.links.new(v, s)
    return [o for o in n.outputs if o.type == "RGBA"][0]


def math_node(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for s, v in ((n.inputs[0], a), (n.inputs[1], b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            s.default_value = v
        else:
            nt.links.new(v, s)
    return n.outputs[0]


def maprange(nt, v, a, b, c=0.0, d=1.0, interp="SMOOTHSTEP"):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = interp
    nt.links.new(v, n.inputs["Value"])
    n.inputs["From Min"].default_value, n.inputs["From Max"].default_value = a, b
    n.inputs["To Min"].default_value, n.inputs["To Max"].default_value = c, d
    return n.outputs["Result"]


def link_obj(obj, coll=None):
    (coll or sc.collection).objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    return link_obj(o, coll)


world_coll = bpy.data.collections.new("World")
sc.collection.children.link(world_coll)

# ---------------------------------------------------------------- sky (HDRI, CC0)
w = bpy.data.worlds.new("Sky")
sc.world = w
w.use_nodes = True
nt = w.node_tree
nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
mp.name = "SkyRot"
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = load_img(os.path.join(PH, "kloofendal_43d_clear_puresky", "kloofendal_43d_clear_puresky_4k.hdr"))
bg = nt.nodes.new("ShaderNodeBackground")
bg.name = "SkyBG"
out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
bg.inputs["Strength"].default_value = 1.0
# Sun direction in the HDRI (measured): elevation 42.9 deg, azimuth -36.2 deg about +X. Shots rotate the sky.

# ---------------------------------------------------------------- terrain
def shore_R(a):
    return 5.4 * (1 + 0.10 * math.sin(3 * a + 0.7) + 0.06 * math.sin(5 * a + 2.1) + 0.035 * math.sin(9 * a + 0.3))


def height(x, y):
    r = math.hypot(x, y)
    a = math.atan2(y, x)
    t = r / shore_R(a)
    n = noise.noise(Vector((x * 0.33, y * 0.33, 0.5)))
    if t < 1:
        z = 0.62 * (1 - t * t) ** 1.6 + 0.04 * n * (1 - t) ** 0.5
    else:
        z = -1.3 * (t - 1) ** 1.45 + 0.08 * n * ss(1.0, 1.6, t)
    return max(z, -5.5)


def grid(name, size, segs, keep, zoff=0.0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=segs, y_segments=segs, size=size / 2)
    for v in bm.verts:
        v.co.z = height(v.co.x, v.co.y) + zoff
    kill = [f for f in bm.faces if not keep(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    return link_obj(o, world_coll)


fine = grid("IslandTop", 15.0, 600, lambda c: math.hypot(c.x, c.y) < 7.3)
coarse = grid("Seabed", 160.0, 400, lambda c: math.hypot(c.x, c.y) > 6.7, zoff=-0.012)

# sand material (shared): detail texture 2 m (damp_beach_sand), macro tint 15 m (coast_sand_01),
# wet below +12 cm, underwater tint toward deep teal with depth.
sand, nt = new_mat("Sand")
o = nt.nodes.new("ShaderNodeOutputMaterial")
bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
nt.links.new(bs.outputs[0], o.inputs["Surface"])
geo = nt.nodes.new("ShaderNodeNewGeometry")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], sep.inputs[0])
z = sep.outputs["Z"]
mp_d = nt.nodes.new("ShaderNodeMapping")
mp_d.inputs["Scale"].default_value = (0.5, 0.5, 0.5)
nt.links.new(geo.outputs["Position"], mp_d.inputs["Vector"])
mp_m = nt.nodes.new("ShaderNodeMapping")
mp_m.inputs["Scale"].default_value = (1 / 15, 1 / 15, 1 / 15)
nt.links.new(geo.outputs["Position"], mp_m.inputs["Vector"])


def timg(path, vec, nc=False):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = load_img(path, nc)
    nt.links.new(vec, n.inputs["Vector"])
    return n


d_diff = timg(ph("damp_beach_sand", "diff"), mp_d.outputs[0])
d_rough = timg(ph("damp_beach_sand", "rough"), mp_d.outputs[0], True)
d_nor = timg(ph("damp_beach_sand", "nor_gl"), mp_d.outputs[0], True)
d_disp = timg(ph("damp_beach_sand", "disp"), mp_d.outputs[0], True)
m_diff = timg(ph("coast_sand_01", "diff"), mp_m.outputs[0])
hsv = nt.nodes.new("ShaderNodeHueSaturation")
hsv.inputs["Saturation"].default_value = 0.72
hsv.inputs["Value"].default_value = 1.55
nt.links.new(d_diff.outputs["Color"], hsv.inputs["Color"])
dry = mixc(nt, 0.35, hsv.outputs["Color"], m_diff.outputs["Color"], "OVERLAY")
dry = mixc(nt, 0.12, dry, (0.93, 0.84, 0.68, 1.0), "MIX")  # warm bleached coral sand
wet_f = maprange(nt, z, 0.14, -0.01)
wet_col = mixc(nt, 1.0, dry, (0.62, 0.55, 0.45, 1.0), "MULTIPLY")
col = mixc(nt, wet_f, dry, wet_col)
under_f = maprange(nt, z, 0.0, -0.2)
col = mixc(nt, under_f, col, mixc(nt, 0.55, mixc(nt, 1.0, col, (0.42, 0.88, 0.95, 1.0), "MULTIPLY"), (0.25, 0.75, 0.8, 1.0), "MIX"))
deep_f = maprange(nt, z, -0.35, -4.8)
col = mixc(nt, deep_f, col, (0.015, 0.16, 0.30, 1.0))
nt.links.new(col, bs.inputs["Base Color"])
rough = math_node(nt, "MULTIPLY", d_rough.outputs["Color"], 1.15)
rough = mixc(nt, wet_f, rough, (0.28, 0.28, 0.28, 1))
nt.links.new(rough, bs.inputs["Roughness"])
nm = nt.nodes.new("ShaderNodeNormalMap")
nm.inputs["Strength"].default_value = 0.9
nt.links.new(d_nor.outputs["Color"], nm.inputs["Color"])
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.35
bump.inputs["Distance"].default_value = 0.004
nt.links.new(d_disp.outputs["Color"], bump.inputs["Height"])
nt.links.new(nm.outputs["Normal"], bump.inputs["Normal"])
# underwater sand ripples
rip_n = nt.nodes.new("ShaderNodeTexWave")
rip_n.wave_type = "BANDS"
rip_n.inputs["Scale"].default_value = 3.2
rip_n.inputs["Distortion"].default_value = 6.0
rip_n.inputs["Detail"].default_value = 2.0
nt.links.new(geo.outputs["Position"], rip_n.inputs["Vector"])
bump2 = nt.nodes.new("ShaderNodeBump")
bump2.inputs["Distance"].default_value = 0.02
nt.links.new(math_node(nt, "MULTIPLY", rip_n.outputs["Color"], under_f), bump2.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
nt.links.new(bump2.outputs["Normal"], bs.inputs["Normal"])
bs.inputs["Specular IOR Level"].default_value = 0.4
for ob in (fine, coarse):
    ob.data.materials.append(sand)

# ---------------------------------------------------------------- ocean (Blender ocean sim)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
ocean = bpy.context.active_object
ocean.name = "Ocean"
for c in ocean.users_collection:
    c.objects.unlink(ocean)
world_coll.objects.link(ocean)
om = ocean.modifiers.new("Ocean", "OCEAN")
om.geometry_mode = "GENERATE"
om.size = 1.0
om.spatial_size = 40
om.resolution = 14
om.viewport_resolution = 6
om.repeat_x = 4
om.repeat_y = 4
om.wave_scale = 0.32
om.choppiness = 0.9
om.wind_velocity = 6.0
om.wave_alignment = 0.35
om.wave_direction = 0.6
om.damping = 0.5
om.random_seed = 3
om.use_normals = True
om.use_foam = True
om.foam_layer_name = "foam"
om.foam_coverage = 0.25
fc = om.driver_add("time")
fc.driver.expression = f"frame/{FPS}"
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = ocean.evaluated_get(dg)
bb = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
cx = sum(v.x for v in bb) / 8
cy = sum(v.y for v in bb) / 8
ocean.location = (-cx, -cy, 0.0)
print("OCEAN bounds", round(min(v.x for v in bb), 1), round(max(v.x for v in bb), 1), "-> centered")

water, nt = new_mat("Water")
o = nt.nodes.new("ShaderNodeOutputMaterial")
wb = nt.nodes.new("ShaderNodeBsdfPrincipled")
wb.inputs["Base Color"].default_value = (0.86, 0.98, 1.0, 1)
wb.inputs["Roughness"].default_value = 0.025
wb.inputs["IOR"].default_value = 1.333
wb.inputs["Transmission Weight"].default_value = 1.0
# shore foam: depth from a baked height map of the terrain + ocean foam layer
hm_res = 512
hm_size = 40.0
hm = bpy.data.images.new("TerrainHeight", hm_res, hm_res, float_buffer=True, alpha=False)
hm.colorspace_settings.name = "Non-Color"
px = [0.0] * (hm_res * hm_res * 4)
for j in range(hm_res):
    yy = (j + 0.5) / hm_res * hm_size - hm_size / 2
    for i in range(hm_res):
        xx = (i + 0.5) / hm_res * hm_size - hm_size / 2
        hv = height(xx, yy)
        k = (j * hm_res + i) * 4
        px[k] = px[k + 1] = px[k + 2] = hv
        px[k + 3] = 1.0
hm.pixels.foreach_set(px)
hm.pack()
geo = nt.nodes.new("ShaderNodeNewGeometry")
mpw = nt.nodes.new("ShaderNodeMapping")
mpw.inputs["Location"].default_value = (0.5, 0.5, 0)
mpw.inputs["Scale"].default_value = (1 / hm_size, 1 / hm_size, 1)
nt.links.new(geo.outputs["Position"], mpw.inputs["Vector"])
hmn = nt.nodes.new("ShaderNodeTexImage")
hmn.image = hm
hmn.extension = "EXTEND"
nt.links.new(mpw.outputs[0], hmn.inputs["Vector"])
sepw = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], sepw.inputs[0])
depth = math_node(nt, "SUBTRACT", sepw.outputs["Z"], hmn.outputs["Color"])
tnode = nt.nodes.new("ShaderNodeValue")
tnode.name = "Time"
fcv = tnode.outputs[0].driver_add("default_value")
fcv.driver.expression = f"frame/{FPS}"
fnoise = nt.nodes.new("ShaderNodeTexNoise")
fnoise.noise_dimensions = "4D"
fnoise.inputs["Scale"].default_value = 6.0
fnoise.inputs["Detail"].default_value = 6.0
fnoise.inputs["Roughness"].default_value = 0.65
nt.links.new(geo.outputs["Position"], fnoise.inputs["Vector"])
nt.links.new(math_node(nt, "MULTIPLY", tnode.outputs[0], 0.35), fnoise.inputs["W"])
band = maprange(nt, depth, 0.11, 0.0)
breakup = maprange(nt, fnoise.outputs["Fac"], 0.44, 0.6)
lap = math_node(nt, "SINE", math_node(nt, "ADD", math_node(nt, "MULTIPLY", tnode.outputs[0], 1.7), math_node(nt, "MULTIPLY", depth, 30.0)))
lap = maprange(nt, lap, -0.3, 1.0, 0.45, 1.0, "LINEAR")
shore_foam = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", band, breakup), lap, clamp=True)
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "foam"
sea_foam = maprange(nt, attr.outputs["Fac"], 0.55, 1.0, 0.0, 0.7)
foam = math_node(nt, "MAXIMUM", shore_foam, math_node(nt, "MULTIPLY", sea_foam, breakup))
fb = nt.nodes.new("ShaderNodeBsdfPrincipled")
fb.inputs["Base Color"].default_value = (0.92, 0.95, 0.95, 1)
fb.inputs["Roughness"].default_value = 0.6
ms = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(foam, ms.inputs["Fac"])
nt.links.new(wb.outputs[0], ms.inputs[1])
nt.links.new(fb.outputs[0], ms.inputs[2])
# Sunlight must reach the seabed: without caustics Cycles blocks shadow rays at the glass surface,
# so the water is transparent to shadow rays (the standard fake-caustics trick).
lp = nt.nodes.new("ShaderNodeLightPath")
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
tr.inputs["Color"].default_value = (0.9, 0.97, 0.97, 1)
ms2 = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(lp.outputs["Is Shadow Ray"], ms2.inputs["Fac"])
nt.links.new(ms.outputs[0], ms2.inputs[1])
nt.links.new(tr.outputs[0], ms2.inputs[2])
nt.links.new(ms2.outputs[0], o.inputs["Surface"])
ocean.data.materials.append(water)
ocean.cycles.use_motion_blur = False

# far water: a flat ring from 70 m to 3 km so the horizon never shows the end of the sim tiles
ring_v, ring_f, segs_r = [], [], 96
for i in range(segs_r):
    a = 2 * math.pi * i / segs_r
    ring_v.append((math.cos(a) * 79, math.sin(a) * 79, -0.02))
    ring_v.append((math.cos(a) * 3000, math.sin(a) * 3000, -0.02))
for i in range(segs_r):
    j = (i + 1) % segs_r
    ring_f.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j))
far = mesh_obj("OceanFar", ring_v, ring_f, world_coll)
far.data.materials.append(water)

# ---------------------------------------------------------------- coconut palm (procedural)
def bark_material():
    m, nt = new_mat("PalmBark")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], o.inputs["Surface"])
    uv = nt.nodes.new("ShaderNodeUVMap")
    def t(kind, nc=False):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = load_img(ph("palm_tree_bark", kind), nc)
        nt.links.new(uv.outputs[0], n.inputs["Vector"])
        return n
    nt.links.new(t("diff").outputs["Color"], b.inputs["Base Color"])
    nt.links.new(t("rough", True).outputs["Color"], b.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(t("nor_gl", True).outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs[0], b.inputs["Normal"])
    return m


def leaf_material():
    m, nt = new_mat("PalmLeaf")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
    ms = nt.nodes.new("ShaderNodeMixShader")
    ms.inputs["Fac"].default_value = 0.3
    a_tip = nt.nodes.new("ShaderNodeAttribute")
    a_tip.attribute_name = "tip"
    a_rnd = nt.nodes.new("ShaderNodeAttribute")
    a_rnd.attribute_name = "rnd"
    a_old = nt.nodes.new("ShaderNodeAttribute")
    a_old.attribute_name = "old"
    base = mixc(nt, a_rnd.outputs["Fac"], (0.11, 0.22, 0.035, 1), (0.19, 0.30, 0.05, 1))
    base = mixc(nt, maprange(nt, a_tip.outputs["Fac"], 0.55, 1.0, 0.0, 0.55), base, (0.42, 0.40, 0.12, 1))
    base = mixc(nt, a_old.outputs["Fac"], base, (0.36, 0.25, 0.11, 1))
    nt.links.new(base, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.42
    b.inputs["Specular IOR Level"].default_value = 0.45
    nt.links.new(mixc(nt, 1.0, base, (1.6, 1.6, 0.9, 1), "MULTIPLY"), tr.inputs["Color"])
    nt.links.new(b.outputs[0], ms.inputs[1])
    nt.links.new(tr.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], o.inputs["Surface"])
    return m


def build_palm(base, H, lean, seed):
    rnd = random.Random(seed)
    lean = Vector(lean).normalized()
    side = lean.cross(Vector((0, 0, 1))).normalized()

    def P(s):
        return base + Vector((0, 0, H * s)) + lean * (H * 0.2 * s ** 1.7) + side * (0.22 * math.sin(math.pi * s) * 0.8)

    def R(s):
        return 0.17 - 0.055 * s + 0.11 * math.exp(-s * 14)

    rings, seg = 110, 22
    verts, faces, uvs = [], [], []
    for i in range(rings + 1):
        s = i / rings
        c = P(s)
        tng = (P(min(1, s + 0.01)) - P(max(0, s - 0.01))).normalized()
        nx = tng.cross(Vector((0, 1, 0))).normalized()
        ny = tng.cross(nx).normalized()
        scar = 1 + 0.045 * max(0.0, math.sin(2 * math.pi * s * H / 0.085)) ** 4
        for j in range(seg):
            a = 2 * math.pi * j / seg
            rr = R(s) * scar * (1 + 0.02 * noise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, s * 9))))
            verts.append(c + (nx * math.cos(a) + ny * math.sin(a)) * rr)
    for i in range(rings):
        for j in range(seg):
            a0, a1 = i * seg + j, i * seg + (j + 1) % seg
            faces.append((a0, a1, a1 + seg, a0 + seg))
    trunk = mesh_obj("PalmTrunk", verts, faces, world_coll)
    uvl = trunk.data.uv_layers.new(name="UVMap")
    for p in trunk.data.polygons:
        p.use_smooth = True
        for li in p.loop_indices:
            vi = trunk.data.loops[li].vertex_index
            i, j = divmod(vi, seg)
            # fix the seam: the wrapped face uses u = 1 instead of 0
            jj = j
            if (j == 0) and any((trunk.data.loops[l2].vertex_index % seg) == seg - 1 for l2 in p.loop_indices):
                jj = seg
            uvl.data[li].uv = (jj / seg * 1.3, i / rings * H / 1.1)
    trunk.data.materials.append(bark_material())
    top = P(1.0)
    # fronds
    lv, lf, a_tip, a_rnd, a_old = [], [], [], [], []
    nf = 17
    for k in range(nf):
        az = k * 2.39996 + rnd.uniform(-0.15, 0.15)
        age = k / (nf - 1)  # 0 = young/upright, 1 = old/drooping
        old = 1.0 if k >= nf - 2 else 0.0
        el = math.radians(55 - 95 * age + rnd.uniform(-8, 8)) if not old else math.radians(-55)
        L = rnd.uniform(2.7, 3.4) * (0.75 if k < 2 else 1.0)
        d0 = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        droop = 0.32 + 0.55 * age + (0.4 if old else 0)
        fr = rnd.random()

        def rach(u):
            return top + d0 * (L * u) + Vector((0, 0, -droop * L * u * u))

        # rachis tube
        n_r, sides = 18, 6
        base_i = len(lv)
        for i in range(n_r + 1):
            u = i / n_r
            c = rach(u)
            tg = (rach(min(1, u + 0.02)) - rach(max(0, u - 0.02))).normalized()
            ax = tg.cross(Vector((0, 0, 1))).normalized() if abs(tg.z) < 0.99 else Vector((1, 0, 0))
            ay = tg.cross(ax).normalized()
            rr = 0.03 * (1 - 0.75 * u)
            for j in range(sides):
                a = 2 * math.pi * j / sides
                lv.append(c + (ax * math.cos(a) + ay * math.sin(a)) * rr)
                a_tip.append(0.0)
                a_rnd.append(fr)
                a_old.append(old)
        for i in range(n_r):
            for j in range(sides):
                a0 = base_i + i * sides + j
                a1 = base_i + i * sides + (j + 1) % sides
                lf.append((a0, a1, a1 + sides, a0 + sides))
        # leaflets
        nl = 64
        for side_s in (-1, 1):
            for q in range(nl):
                u = 0.1 + 0.88 * q / (nl - 1) + rnd.uniform(-0.004, 0.004)
                c = rach(u)
                tg = (rach(min(1, u + 0.01)) - rach(max(0, u - 0.01))).normalized()
                sd = tg.cross(Vector((0, 0, 1)))
                if sd.length < 1e-4:
                    sd = Vector((1, 0, 0))
                sd = sd.normalized() * side_s
                up = sd.cross(tg).normalized() * side_s
                ll = (0.92 * math.sin(math.pi * min(1, u * 1.05)) ** 0.55 + 0.12) * L / 3.1 * rnd.uniform(0.85, 1.1)
                wd = 0.042 * rnd.uniform(0.85, 1.15)
                beta = math.radians(rnd.uniform(28, 42))
                dirv = (sd * math.cos(beta) + tg * math.sin(beta)).normalized()
                lift = rnd.uniform(-0.1, 0.35) * (1 - age)
                hang = (0.35 + 0.5 * age + 0.6 * old) * rnd.uniform(0.8, 1.2)
                segs = 5
                bi = len(lv)
                for e in range(segs + 1):
                    v = e / segs
                    pt = c + dirv * (ll * v) + up * (lift * ll * v) + Vector((0, 0, -hang * ll * v * v))
                    half = wd * 0.5 * (1 - v ** 1.8) * (0.6 + 0.4 * math.sin(math.pi * min(1, v * 1.4 + 0.15)))
                    wv = tg * half
                    lv.append(pt - wv)
                    lv.append(pt + wv + up * 0.006)
                    for _ in range(2):
                        a_tip.append(v)
                        a_rnd.append(fr)
                        a_old.append(old)
                for e in range(segs):
                    a0 = bi + e * 2
                    lf.append((a0, a0 + 1, a0 + 3, a0 + 2))
    fronds = mesh_obj("PalmFronds", lv, lf, world_coll)
    for nm_, arr in (("tip", a_tip), ("rnd", a_rnd), ("old", a_old)):
        at = fronds.data.attributes.new(nm_, "FLOAT", "POINT")
        at.data.foreach_set("value", arr)
    for p in fronds.data.polygons:
        p.use_smooth = True
    fronds.data.materials.append(leaf_material())
    # coconuts cluster
    nutm = coconut_material(False)
    for k in range(6):
        a = k * 2.4 + rnd.uniform(-0.3, 0.3)
        pos = top + Vector((math.cos(a) * 0.17, math.sin(a) * 0.17, -0.22 - rnd.uniform(0, 0.12)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, segments=24, ring_count=16, location=pos)
        nut = bpy.context.active_object
        nut.name = f"PalmNut{k}"
        nut.scale = (1, 1, 1.12)
        for c_ in nut.users_collection:
            c_.objects.unlink(nut)
        world_coll.objects.link(nut)
        bpy.ops.object.shade_smooth()
        nut.data.materials.append(nutm)
    return top


def coconut_material(husk_brown=True, face_img=None):
    m, nt = new_mat("Coconut" + ("Face" if face_img else ("Brown" if husk_brown else "Green")))
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], o.inputs["Surface"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mpn = nt.nodes.new("ShaderNodeMapping")
    mpn.inputs["Scale"].default_value = (40, 40, 6)
    nt.links.new(tc.outputs["Object"], mpn.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.0
    nz.inputs["Detail"].default_value = 10
    nz.inputs["Roughness"].default_value = 0.7
    nt.links.new(mpn.outputs[0], nz.inputs["Vector"])
    c1, c2 = ((0.16, 0.085, 0.035, 1), (0.36, 0.22, 0.10, 1)) if husk_brown else ((0.12, 0.17, 0.04, 1), (0.27, 0.30, 0.08, 1))
    col = mixc(nt, nz.outputs["Fac"], c1, c2)
    if face_img:
        mpf = nt.nodes.new("ShaderNodeMapping")
        mpf.inputs["Location"].default_value = (0.5, 0.5, 0)
        mpf.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
        mpf.inputs["Scale"].default_value = (3.6, 3.6, 3.6)
        nt.links.new(tc.outputs["Object"], mpf.inputs["Vector"])
        fi = nt.nodes.new("ShaderNodeTexImage")
        fi.image = load_img(face_img)
        fi.extension = "CLIP"
        nt.links.new(mpf.outputs[0], fi.inputs["Vector"])
        sepn = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sepn.inputs[0])
        front = maprange(nt, sepn.outputs["Y"], 0.0, -0.03)
        ink = math_node(nt, "MULTIPLY", fi.outputs["Alpha"], front)
        col = mixc(nt, ink, col, (0.015, 0.015, 0.02, 1))
    nt.links.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.75
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


PALM_BASE = Vector((-1.2, 1.1, height(-1.2, 1.1) - 0.05))
top = build_palm(PALM_BASE, 6.2, (0.55, -0.35, 0), 11)
print("PALM top", tuple(round(c, 2) for c in top))

# ---------------------------------------------------------------- shells (Poly Haven lambis_shell, CC0)
shell_dir = os.path.join(PH, "lambis_shell")
with bpy.data.libraries.load(os.path.join(shell_dir, next(f for f in os.listdir(shell_dir) if f.endswith(".blend")))) as (src, dst):
    dst.objects = [n for n in src.objects if n == "lambis_shell"]
shell = dst.objects[0]
for k, (x, y, rz) in enumerate(((2.1, -1.6, 40), (-2.8, -2.4, 160), (3.4, 1.2, 260), (0.6, -3.6, 90))):
    s = shell if k == 0 else shell.copy()
    s.location = (x, y, height(x, y) + 0.01)
    s.rotation_euler = (0, 0, math.radians(rz))
    s.scale = (1.4, 1.4, 1.4)
    world_coll.objects.link(s)

sc["shore_R_note"] = "shore radius ~5.4 m, top height 0.62 m at center"
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
