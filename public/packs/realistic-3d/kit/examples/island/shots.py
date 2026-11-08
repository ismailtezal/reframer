# Builds and renders one shot of the island short (a developer stranded on an island) from island.blend.
# Rendered through the kit: node ../../render.mjs --blend island.blend --script shots.py --out frames -- <texdir> <phdir>
# which runs: blender -b island.blend --python shots.py -- <shot> <outdir> <start> <end> <step> <scale%> <samples> <texdir> <phdir>
# (outdir is the shot's own folder; end 0 = the shot's last frame; step 0 = first, middle and last frame).
import bpy, sys, os, math, json, array, random
sys.path.insert(0, os.path.dirname(__file__))
import common as C
from mathutils import Vector, Matrix, Euler, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:]
SHOT, OUTDIR = argv[0], argv[1]
START = int(argv[2]) if len(argv) > 2 else 1
END = int(argv[3]) if len(argv) > 3 else 0
STEP = int(argv[4]) if len(argv) > 4 else 1
SCALE = int(argv[5]) if len(argv) > 5 else 100
SAMPLES = int(argv[6]) if len(argv) > 6 else 40
TEX, PH = argv[7], argv[8]
FPS = 30
sc = bpy.context.scene
arm = bpy.data.objects["Hero"]
body = bpy.data.objects["Hero.body"]
pb = arm.pose.bones
KB = body.data.shape_keys.key_blocks
Hgt = C.height
random.seed(3)
props = bpy.data.collections.new("Props")
sc.collection.children.link(props)


def sec(t, t0):
    """seconds on the master timeline -> local shot frame (1-based)"""
    return int(round((t - t0) * FPS)) + 1


# ------------------------------------------------------------------ materials / mesh helpers
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt


def link(o):
    props.objects.link(o)
    return o


def mesh(name, verts, faces, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


def principled(nt, col=(0.5, 0.5, 0.5, 1), rough=0.5):
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = col
    b.inputs["Roughness"].default_value = rough
    nt.links.new(b.outputs[0], o.inputs["Surface"])
    return b, o


def image(path, nc=False):
    im = bpy.data.images.load(path, check_existing=True)
    if nc:
        im.colorspace_settings.name = "Non-Color"
    return im


def f32(name):
    meta = json.load(open(os.path.join(TEX, name + ".json")))
    a = array.array("f")
    with open(os.path.join(TEX, name + ".f32"), "rb") as fh:
        a.frombytes(fh.read())
    return meta, a


def height_patch(name, data_name, mat, attr_name=None, attr_data=None):
    """Conforming terrain patch with a displacement height map (sits on the island top)."""
    meta, h = f32(data_name)
    W, Hh, res = meta["W"], meta["H"], meta["res"]
    if "cx" in meta:
        x0 = meta["cx"] - W * res / 2
        y1 = meta["cy"] + Hh * res / 2
    else:
        x0, y1 = meta["x0"], meta["y1"]
    verts, faces = [], []
    edge = 0.03
    for j in range(Hh):
        y = y1 - j * res
        for i in range(W):
            x = x0 + i * res
            d = min(i, W - 1 - i, j, Hh - 1 - j) * res
            w = C.ss(0.0, edge, d)
            verts.append((x, y, Hgt(x, y) - 0.002 + 0.005 * w + h[j * W + i] * w))
    for j in range(Hh - 1):
        for i in range(W - 1):
            a = j * W + i
            faces.append((a, a + 1, a + W + 1, a + W))
    o = mesh(name, verts, faces)
    o.data.materials.append(mat)
    if attr_name:
        at = o.data.attributes.new(attr_name, "FLOAT", "POINT")
        at.data.foreach_set("value", attr_data)
    return o


# ------------------------------------------------------------------ character posing
ARM_BONES = [b.name for b in pb if any(k in b.name for k in ("upperarm", "lowerarm", "wrist", "finger", "shoulder", "clavicle", "neck", "head", "spine"))]


def reset_pose():
    for n in ARM_BONES:
        b = pb[n]
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = (1, 0, 0, 0)


def aim(name, d):
    bpy.context.view_layer.update()
    b = pb[name]
    M = b.matrix.copy()
    cur = M.to_3x3() @ Vector((0, 1, 0))
    q = cur.rotation_difference(Vector(d).normalized())
    b.matrix = Matrix.Translation(M.translation) @ (q.to_matrix() @ M.to_3x3()).to_4x4()
    bpy.context.view_layer.update()


def twist(name, deg):
    b = pb[name]
    b.rotation_quaternion = b.rotation_quaternion @ Quaternion((0, 1, 0), math.radians(deg))
    bpy.context.view_layer.update()


def fingers(side, curl=(18, 24, 16), thumb=10):
    for f in range(2, 6):
        for j, a in zip((1, 2, 3), curl):
            n = f"finger{f}-{j}.{side}"
            if n in pb:
                pb[n].rotation_quaternion = Quaternion((1, 0, 0), math.radians(a))
    for j in (1, 2, 3):
        n = f"finger1-{j}.{side}"
        if n in pb:
            pb[n].rotation_quaternion = Quaternion((1, 0, 0), math.radians(thumb))


def arm_dirs(side, up, low, wr):
    s = 1 if side == "L" else -1
    f = lambda v: (v[0] * s, v[1], v[2])
    aim(f"upperarm01.{side}", f(up))
    aim(f"upperarm02.{side}", f(up))
    aim(f"lowerarm01.{side}", f(low))
    aim(f"lowerarm02.{side}", f(low))
    aim(f"wrist.{side}", f(wr))


IDLE = ((0.24, 0.04, -1), (0.13, -0.3, -1), (0.08, -0.16, -1))


def pose(name, head=(0, 0, 1), yaw=0.0):
    reset_pose()
    aim("neck03", (head[0] * 0.4, head[1] * 0.4, 1))
    aim("head", head)
    if yaw:
        twist("head", yaw)
    if name == "idle":
        arm_dirs("L", *IDLE)
        arm_dirs("R", *IDLE)
        fingers("L")
        fingers("R")
    elif name == "phone_up":
        arm_dirs("L", *IDLE)
        fingers("L")
        arm_dirs("R", (0.3, -0.7, 0.45), (-0.1, -0.72, 0.8), (-0.08, -0.2, 1.0))
        fingers("R", (22, 26, 18), 30)
    elif name == "stick":
        arm_dirs("L", *IDLE)
        fingers("L")
        arm_dirs("R", (0.25, -0.45, -1), (0.12, -1.0, -0.45), (0.1, -1.0, -0.55))
        fingers("R", (70, 80, 55), 45)
    elif name == "laptop":
        arm_dirs("L", (0.12, -0.32, -1), (-0.45, -1.0, 0.08), (-0.5, -1.0, 0.0))
        arm_dirs("R", (0.12, -0.32, -1), (-0.35, -1.0, 0.0), (-0.3, -1.0, -0.25))
        fingers("L", (8, 10, 6), 5)
        fingers("R", (25, 30, 20), 15)
    elif name == "stop":
        arm_dirs("L", *IDLE)
        fingers("L")
        arm_dirs("R", (0.5, -0.85, 0.08), (0.12, -0.55, 1.0), (0.05, 0.45, 1.0))
        fingers("R", (2, 2, 2), 5)


def key_pose(f, name, **kw):
    pose(name, **kw)
    for n in ARM_BONES:
        pb[n].keyframe_insert("rotation_quaternion", frame=f)


FACE_KEYS = ["browInnerUp", "browDownLeft", "browDownRight", "browOuterUpLeft", "browOuterUpRight", "eyeWideLeft", "eyeWideRight",
             "eyeSquintLeft", "eyeSquintRight", "jawOpen", "mouthFrownLeft", "mouthFrownRight", "mouthSmileLeft", "mouthSmileRight",
             "mouthPressLeft", "mouthPressRight", "mouthPucker", "mouthFunnel", "cheekSquintLeft", "cheekSquintRight", "mouthRollLower",
             "noseSneerLeft", "noseSneerRight", "mouthShrugUpper", "mouthShrugLower"]
FACES = {
    "neutral": {},
    "worried": {"browInnerUp": 0.75, "browOuterUpLeft": 0.1, "browOuterUpRight": 0.1, "mouthFrownLeft": 0.35, "mouthFrownRight": 0.35, "mouthPressLeft": 0.3, "mouthPressRight": 0.3},
    "shock": {"browInnerUp": 0.8, "browOuterUpLeft": 0.55, "browOuterUpRight": 0.55, "eyeWideLeft": 0.6, "eyeWideRight": 0.6, "jawOpen": 0.28, "mouthFunnel": 0.15},
    "focus": {"browDownLeft": 0.35, "browDownRight": 0.35, "eyeSquintLeft": 0.25, "eyeSquintRight": 0.25, "mouthPressLeft": 0.35, "mouthPressRight": 0.35},
    "smug": {"mouthSmileLeft": 0.55, "mouthSmileRight": 0.25, "cheekSquintLeft": 0.25, "browOuterUpLeft": 0.25, "eyeSquintLeft": 0.15},
    "proud": {"mouthSmileLeft": 0.5, "mouthSmileRight": 0.5, "cheekSquintLeft": 0.3, "cheekSquintRight": 0.3, "browInnerUp": 0.15},
    "serious": {"browDownLeft": 0.2, "browDownRight": 0.2, "mouthPressLeft": 0.2, "mouthPressRight": 0.2},
}


def key_face(f, name):
    vals = FACES[name]
    for k in FACE_KEYS:
        KB[k].value = vals.get(k, 0.0)
        KB[k].keyframe_insert("value", frame=f)


def blinks(f0, f1, every=95):
    f = f0 + 20
    while f < f1 - 6:
        for k in ("eyeBlinkLeft", "eyeBlinkRight"):
            for df, v in ((0, 0.0), (2, 1.0), (4, 1.0), (7, 0.0)):
                KB[k].value = v
                KB[k].keyframe_insert("value", frame=f + df)
        f += every + random.randint(-25, 25)


def place(x, y, facing):
    return C.place_character(x, y, facing, ground=Hgt)


# ------------------------------------------------------------------ props
def hand_frame(side="R"):
    """World position/orientation of the palm (after the pose is applied)."""
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    w = pb[f"wrist.{side}"]
    m3 = pb[f"finger3-1.{side}"]
    i2 = pb[f"finger2-1.{side}"]
    l5 = pb[f"finger5-1.{side}"]
    wrist = mw @ w.head
    knuck = mw @ m3.head
    across = (mw @ i2.head) - (mw @ l5.head)
    fwd = (knuck - wrist).normalized()
    nrm = fwd.cross(across).normalized()
    return wrist, knuck, fwd, across.normalized(), nrm


def child_of_bone(obj, bone):
    bpy.context.view_layer.update()
    c = obj.constraints.new("CHILD_OF")
    c.target = arm
    c.subtarget = bone
    c.inverse_matrix = (arm.matrix_world @ pb[bone].matrix).inverted()


def make_phone():
    bpy.ops.mesh.primitive_cube_add(size=1)
    ph = bpy.context.active_object
    ph.name = "Phone"
    for c_ in ph.users_collection:
        c_.objects.unlink(ph)
    link(ph)
    ph.scale = (0.072, 0.0078, 0.150)
    bpy.ops.object.transform_apply(scale=True)
    bv = ph.modifiers.new("Bevel", "BEVEL")
    bv.width = 0.0075
    bv.segments = 6
    bpy.ops.object.shade_smooth()
    m, nt = new_mat("PhoneBody")
    b, _ = principled(nt, (0.035, 0.037, 0.042, 1), 0.3)
    b.inputs["Metallic"].default_value = 0.7
    ph.data.materials.append(m)
    bpy.ops.mesh.primitive_plane_add(size=1)
    scr = bpy.context.active_object
    scr.name = "PhoneScreen"
    for c_ in scr.users_collection:
        c_.objects.unlink(scr)
    link(scr)
    scr.scale = (0.066, 0.143, 1)
    scr.rotation_euler = (math.radians(90), 0, 0)
    scr.location = (0, -0.00395, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    scr.parent = ph
    m, nt = new_mat("PhoneScreen")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 2.2
    gl = nt.nodes.new("ShaderNodeBsdfPrincipled")
    gl.inputs["Base Color"].default_value = (0, 0, 0, 1)
    gl.inputs["Roughness"].default_value = 0.05
    add = nt.nodes.new("ShaderNodeAddShader")
    uv = nt.nodes.new("ShaderNodeTexCoord")
    texs = []
    for k in "abc":
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image(os.path.join(TEX, f"phone_{k}.png"))
        nt.links.new(uv.outputs["UV"], t.inputs["Vector"])
        texs.append(t)
    vb = nt.nodes.new("ShaderNodeValue")
    vb.name = "toB"
    vc = nt.nodes.new("ShaderNodeValue")
    vc.name = "toC"
    mix1 = nt.nodes.new("ShaderNodeMix")
    mix1.data_type = "RGBA"
    cin = [s for s in mix1.inputs if s.type == "RGBA"]
    nt.links.new(vb.outputs[0], mix1.inputs[0])
    nt.links.new(texs[0].outputs["Color"], cin[0])
    nt.links.new(texs[1].outputs["Color"], cin[1])
    mix2 = nt.nodes.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    cin2 = [s for s in mix2.inputs if s.type == "RGBA"]
    nt.links.new(vc.outputs[0], mix2.inputs[0])
    nt.links.new([s for s in mix1.outputs if s.type == "RGBA"][0], cin2[0])
    nt.links.new(texs[2].outputs["Color"], cin2[1])
    nt.links.new([s for s in mix2.outputs if s.type == "RGBA"][0], em.inputs["Color"])
    nt.links.new(em.outputs[0], add.inputs[0])
    nt.links.new(gl.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], o.inputs["Surface"])
    scr.data.materials.append(m)
    return ph, m


def key_value(mat, node, f, v):
    n = mat.node_tree.nodes[node]
    n.outputs[0].default_value = v
    n.outputs[0].keyframe_insert("default_value", frame=f)


def hold_phone(ph, side="R"):
    wrist, knuck, fwd, across, nrm = hand_frame(side)
    head = arm.matrix_world @ pb["head"].head + Vector((0, 0, 0.09))
    palm = wrist + (knuck - wrist) * 0.75
    to_eye = (head - palm).normalized()
    if nrm.dot(to_eye) < 0:
        nrm = -nrm
    # phone space: screen faces -Y, long axis +Z. -Y -> toward the eyes (nrm), +Z -> along the fingers.
    y = (-nrm).normalized()
    x = y.cross(fwd).normalized()
    z = x.cross(y).normalized()
    R = Matrix((x, y, z)).transposed()
    ph.matrix_world = Matrix.Translation(palm + fwd * 0.075 + nrm * 0.022) @ R.to_4x4()
    print("PHONE at", tuple(round(c, 3) for c in palm), "screen->eye dot", round(nrm.dot(to_eye), 2))
    child_of_bone(ph, f"wrist.{side}")


def make_stick():
    pts = [Vector((0, 0, 0)), Vector((0.02, 0.01, 0.3)), Vector((0.0, 0.03, 0.62)), Vector((0.035, 0.02, 0.95)), Vector((0.02, 0.05, 1.18))]
    cu = bpy.data.curves.new("Stick", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.014
    cu.bevel_resolution = 3
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, v in zip(sp.points, pts):
        p.co = (v.x, v.y, v.z, 1)
        p.radius = 1.1 - 0.5 * v.z
    sp.use_endpoint_u = True
    o = link(bpy.data.objects.new("Stick", cu))
    m, nt = new_mat("Driftwood")
    b, _ = principled(nt, (0.36, 0.30, 0.22, 1), 0.8)
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 30
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1, 1, 0.08)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.22, 0.18, 0.13, 1)
    ramp.color_ramp.elements[1].color = (0.52, 0.45, 0.36, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    o.data.materials.append(m)
    return o


def coconut(name, face_png, loc, facing_dir, r=0.11):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=32, ring_count=20)
    o = bpy.context.active_object
    o.name = name
    for c_ in o.users_collection:
        c_.objects.unlink(o)
    link(o)
    bpy.ops.object.shade_smooth()
    o.scale = (1, 1, 1.08)
    o.location = Vector(loc)
    d = Vector(facing_dir).normalized()
    o.rotation_euler = (0, 0, math.atan2(d.y, d.x) + math.pi / 2)  # local -Y faces facing_dir
    m, nt = new_mat("Coco_" + name)
    b, _ = principled(nt, rough=0.78)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (45, 45, 7)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Detail"].default_value = 12
    nz.inputs["Roughness"].default_value = 0.72
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.11, 0.055, 0.022, 1)
    ramp.color_ramp.elements[1].color = (0.42, 0.26, 0.12, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    mpf = nt.nodes.new("ShaderNodeMapping")
    mpf.inputs["Location"].default_value = (0.5, 0.5, 0)
    mpf.inputs["Rotation"].default_value = (math.radians(-90), 0, 0)
    mpf.inputs["Scale"].default_value = (3.9, 3.9, 3.9)
    nt.links.new(tc.outputs["Object"], mpf.inputs["Vector"])
    fi = nt.nodes.new("ShaderNodeTexImage")
    fi.image = image(face_png)
    fi.extension = "CLIP"
    nt.links.new(mpf.outputs[0], fi.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    front = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(sep.outputs["Y"], front.inputs["Value"])
    front.inputs["From Min"].default_value, front.inputs["From Max"].default_value = 0.0, -0.04
    inkm = nt.nodes.new("ShaderNodeMath")
    inkm.operation = "MULTIPLY"
    nt.links.new(fi.outputs["Alpha"], inkm.inputs[0])
    nt.links.new(front.outputs[0], inkm.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    cin = [s for s in mix.inputs if s.type == "RGBA"]
    nt.links.new(inkm.outputs[0], mix.inputs[0])
    nt.links.new(ramp.outputs[0], cin[0])
    cin[1].default_value = (0.01, 0.01, 0.012, 1)
    nt.links.new([s for s in mix.outputs if s.type == "RGBA"][0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    o.data.materials.append(m)
    return o


def wood_mat(name, base=(0.42, 0.33, 0.24, 1)):
    m, nt = new_mat(name)
    b, _ = principled(nt, base, 0.75)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 22.0, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6
    nz.inputs["Detail"].default_value = 8
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(c * 0.55 for c in base[:3]) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1, c * 1.25) for c in base[:3]) + (1,)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def make_sign(loc, face_dir):
    d = Vector(face_dir).normalized()
    yaw = math.atan2(d.y, d.x) + math.pi / 2
    root = link(bpy.data.objects.new("Sign", None))
    root.location = Vector(loc)
    root.rotation_euler = (0, math.radians(-3), yaw)
    wm = wood_mat("SignWood")
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=1.55, location=(0, 0.04, 0.62))
    post = bpy.context.active_object
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.12))
    board = bpy.context.active_object
    board.scale = (1.25, 0.04, 0.52)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.0212, 1.12), rotation=(math.radians(90), 0, 0))
    paint = bpy.context.active_object
    paint.scale = (1.16, 0.45, 1)
    for ob in (post, board, paint):
        for c_ in ob.users_collection:
            c_.objects.unlink(ob)
        link(ob)
        ob.parent = root
    post.data.materials.append(wm)
    board.data.materials.append(wm)
    m, nt = new_mat("SignPaint")
    b, o = principled(nt, (0.92, 0.92, 0.9, 1), 0.55)
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = image(os.path.join(TEX, "sign_paint.png"))
    nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    paint.data.materials.append(m)
    return root


def make_boat(loc, heading_deg):
    L, B, D = 6.4, 2.3, 1.05
    secs = 14
    verts, faces = [], []
    prof = []
    for i in range(secs + 1):
        s = i / secs
        hw = B / 2 * (1 - s ** 2.6) ** 0.55 if s < 1 else 0.0
        sheer = D + 0.35 * s ** 2
        keel = -0.35 * (1 - s ** 3) + 0.25 * s ** 3
        x = -L / 2 + L * s
        ring = [(x, hw, sheer), (x, hw * 0.98, 0.35), (x, hw * 0.55, keel + 0.1), (x, 0.0, keel),
                (x, -hw * 0.55, keel + 0.1), (x, -hw * 0.98, 0.35), (x, -hw, sheer)]
        prof.append(ring)
    n = len(prof[0])
    for ring in prof:
        verts.extend(ring)
    for i in range(secs):
        for j in range(n - 1):
            a = i * n + j
            faces.append((a, a + 1, a + n + 1, a + n))
    deck_c = len(verts)
    for i in range(secs + 1):
        verts.append((prof[i][0][0], 0.0, prof[i][0][2] - 0.12))
    for i in range(secs):
        a, b2 = i * n, (i + 1) * n
        faces.append((a, b2, deck_c + i + 1, deck_c + i))
        faces.append((a + n - 1, deck_c + i, deck_c + i + 1, b2 + n - 1))
    faces.append(tuple(range(0, n))[::-1])
    hull = mesh("BoatHull", verts, faces)
    sub = hull.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    m, nt = new_mat("BoatGelcoat")
    b, _ = principled(nt, (0.86, 0.87, 0.86, 1), 0.22)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    tcn = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tcn.outputs["Object"], sep.inputs[0])
    stripe = nt.nodes.new("ShaderNodeMapRange")
    stripe.interpolation_type = "STEPPED" if False else "LINEAR"
    nt.links.new(sep.outputs["Z"], stripe.inputs["Value"])
    stripe.inputs["From Min"].default_value, stripe.inputs["From Max"].default_value = 0.55, 0.6
    st2 = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(sep.outputs["Z"], st2.inputs["Value"])
    st2.inputs["From Min"].default_value, st2.inputs["From Max"].default_value = 0.78, 0.73
    band = nt.nodes.new("ShaderNodeMath")
    band.operation = "MULTIPLY"
    nt.links.new(stripe.outputs[0], band.inputs[0])
    nt.links.new(st2.outputs[0], band.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    cin = [s for s in mix.inputs if s.type == "RGBA"]
    nt.links.new(band.outputs[0], mix.inputs[0])
    cin[0].default_value = (0.86, 0.87, 0.86, 1)
    cin[1].default_value = (0.03, 0.12, 0.35, 1)
    nt.links.new([s for s in mix.outputs if s.type == "RGBA"][0], b.inputs["Base Color"])
    hull.data.materials.append(m)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.6, 0, 1.55))
    cab = bpy.context.active_object
    cab.name = "BoatCabin"
    cab.scale = (1.7, 1.5, 0.85)
    bv = cab.modifiers.new("Bevel", "BEVEL")
    bv.width = 0.08
    bv.segments = 3
    for c_ in cab.users_collection:
        c_.objects.unlink(cab)
    link(cab)
    cab.data.materials.append(m)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.05, 0, 1.68))
    win = bpy.context.active_object
    win.name = "BoatGlass"
    win.scale = (0.62, 1.52, 0.38)
    for c_ in win.users_collection:
        c_.objects.unlink(win)
    link(win)
    gm, gnt = new_mat("BoatGlass")
    gb, _ = principled(gnt, (0.02, 0.03, 0.04, 1), 0.05)
    win.data.materials.append(gm)
    root = link(bpy.data.objects.new("Boat", None))
    for ob in (hull, cab, win):
        ob.parent = root
    root.location = Vector(loc)
    root.rotation_euler = (0, 0, math.radians(heading_deg))
    return root


def f32_image(name, data_name):
    import numpy as np
    meta = json.load(open(os.path.join(TEX, data_name + ".json")))
    W, Hh = meta["W"], meta["H"]
    a = np.fromfile(os.path.join(TEX, data_name + ".f32"), dtype=np.float32).reshape(Hh, W)[::-1]
    px = np.ones((Hh, W, 4), np.float32)
    px[..., 0] = px[..., 1] = px[..., 2] = a
    im = bpy.data.images.new(name, W, Hh, float_buffer=True, alpha=False)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(px.ravel())
    return im


def sandtop_material():
    """Sand + footprint bump + a footfall heat-map overlay (HeatReveal value), mapped by world XY over 15 m."""
    m = bpy.data.materials["Sand"].copy()
    m.name = "SandTop"
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mp.inputs["Scale"].default_value = (1 / 15, 1 / 15, 1)
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])
    pr = nt.nodes.new("ShaderNodeTexImage")
    pr.image = f32_image("Prints", "prints")
    pr.extension = "CLIP"
    pr.interpolation = "Cubic"
    nt.links.new(mp.outputs[0], pr.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 0.012
    bump.inputs["Strength"].default_value = 1.0
    nt.links.new(pr.outputs["Color"], bump.inputs["Height"])
    prev = bs.inputs["Normal"].links[0].from_socket
    nt.links.new(prev, bump.inputs["Normal"])
    nt.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    col_sock = bs.inputs["Base Color"].links[0].from_socket
    # footprints are a touch darker (disturbed, damper sand)
    dk = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(pr.outputs["Color"], dk.inputs["Value"])
    dk.inputs["From Min"].default_value, dk.inputs["From Max"].default_value = 0.0, -0.8
    dk.inputs["To Min"].default_value, dk.inputs["To Max"].default_value = 0.0, 0.22
    dmix = nt.nodes.new("ShaderNodeMix")
    dmix.data_type = "RGBA"
    dmix.blend_type = "MULTIPLY"
    cin = [x for x in dmix.inputs if x.type == "RGBA"]
    nt.links.new(dk.outputs[0], dmix.inputs[0])
    nt.links.new(col_sock, cin[0])
    cin[1].default_value = (0.72, 0.66, 0.58, 1)
    col_sock = [x for x in dmix.outputs if x.type == "RGBA"][0]
    ht = nt.nodes.new("ShaderNodeTexImage")
    ht.image = f32_image("Heat", "heat")
    ht.extension = "CLIP"
    nt.links.new(mp.outputs[0], ht.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.08, (0.05, 0.25, 1.0, 1)
    els[1].position, els[1].color = 0.95, (1.0, 0.1, 0.03, 1)
    e = els.new(0.4)
    e.color = (0.1, 0.95, 0.35, 1)
    e = els.new(0.7)
    e.color = (1.0, 0.85, 0.05, 1)
    nt.links.new(ht.outputs["Color"], ramp.inputs[0])
    rv = nt.nodes.new("ShaderNodeValue")
    rv.name = "HeatReveal"
    rv.outputs[0].default_value = 0.0
    cl = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(ht.outputs["Color"], cl.inputs["Value"])
    cl.inputs["From Min"].default_value, cl.inputs["From Max"].default_value = 0.05, 0.3
    amt = nt.nodes.new("ShaderNodeMath")
    amt.operation = "MULTIPLY"
    nt.links.new(rv.outputs[0], amt.inputs[0])
    nt.links.new(cl.outputs[0], amt.inputs[1])
    amt2 = nt.nodes.new("ShaderNodeMath")
    amt2.operation = "MULTIPLY"
    amt2.inputs[1].default_value = 0.85
    nt.links.new(amt.outputs[0], amt2.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    cin = [x for x in mix.inputs if x.type == "RGBA"]
    nt.links.new(amt2.outputs[0], mix.inputs[0])
    nt.links.new(col_sock, cin[0])
    nt.links.new(ramp.outputs[0], cin[1])
    nt.links.new([x for x in mix.outputs if x.type == "RGBA"][0], bs.inputs["Base Color"])
    em = nt.nodes.new("ShaderNodeMath")
    em.operation = "MULTIPLY"
    em.inputs[1].default_value = 0.8
    nt.links.new(amt.outputs[0], em.inputs[0])
    nt.links.new(ramp.outputs[0], bs.inputs["Emission Color"])
    nt.links.new(em.outputs[0], bs.inputs["Emission Strength"])
    return m


TOP_MAT = sandtop_material()
bpy.data.objects["IslandTop"].data.materials[0] = TOP_MAT


def writing():
    meta = json.load(open(os.path.join(TEX, "writing.json")))
    hw, hh = meta["W"] * meta["res"] / 2, meta["H"] * meta["res"] / 2
    x0, x1, y0, y1 = meta["cx"] - hw, meta["cx"] + hw, meta["cy"] - hh, meta["cy"] + hh
    me = bpy.data.objects["IslandTop"].data
    for v in me.vertices:
        if x0 + 0.02 < v.co.x < x1 - 0.02 and y0 + 0.02 < v.co.y < y1 - 0.02:
            v.co.z -= 0.03
    me.update()
    return height_patch("Writing", "writing", TOP_MAT)


def make_laptop(screen_png, open_deg=110):
    """Modern thin laptop: user side is local -Y, hinge at +Y."""
    root = link(bpy.data.objects.new("Laptop", None))
    alu, ant = new_mat("Aluminium")
    ab, _ = principled(ant, (0.42, 0.43, 0.45, 1), 0.32)
    ab.inputs["Metallic"].default_value = 1.0

    def box(name, size, loc, mat, parent, bev=0.003):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(scale=True)
        if bev:
            md = o.modifiers.new("Bevel", "BEVEL")
            md.width = bev
            md.segments = 3
        for c_ in o.users_collection:
            c_.objects.unlink(o)
        link(o)
        o.parent = parent
        o.data.materials.append(mat)
        return o

    box("LaptopBase", (0.312, 0.221, 0.0155), (0, 0, 0.00775), alu, root, 0.004)
    km, knt = new_mat("Keyboard")
    kb_, _ = principled(knt, (0.02, 0.02, 0.022, 1), 0.5)
    br = knt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0
    br.inputs["Color1"].default_value = (0.03, 0.03, 0.033, 1)
    br.inputs["Color2"].default_value = (0.035, 0.035, 0.038, 1)
    br.inputs["Mortar"].default_value = (0.006, 0.006, 0.007, 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.0025
    br.inputs["Brick Width"].default_value = 0.0175
    br.inputs["Row Height"].default_value = 0.0175
    tc = knt.nodes.new("ShaderNodeTexCoord")
    knt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    knt.links.new(br.outputs["Color"], kb_.inputs["Base Color"])
    box("LaptopKeys", (0.27, 0.105, 0.001), (0, 0.035, 0.0158), km, root, 0)
    pivot = link(bpy.data.objects.new("LaptopHinge", None))
    pivot.parent = root
    pivot.location = (0, 0.108, 0.0155)
    pivot.rotation_euler = (math.radians(-(open_deg - 90)), 0, 0)
    box("LaptopLid", (0.312, 0.006, 0.214), (0, 0, 0.107), alu, pivot, 0.003)
    bz, bnt = new_mat("Bezel")
    bb_, _ = principled(bnt, (0.005, 0.005, 0.006, 1), 0.12)
    box("LaptopBezel", (0.304, 0.0008, 0.206), (0, -0.0034, 0.108), bz, pivot, 0)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.0039, 0.11), rotation=(math.radians(90), 0, 0))
    scr = bpy.context.active_object
    scr.name = "LaptopScreen"
    scr.scale = (0.288, 0.18, 1)
    for c_ in scr.users_collection:
        c_.objects.unlink(scr)
    link(scr)
    scr.parent = pivot
    m, nt = new_mat("LaptopScreen")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.8
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = image(screen_png)
    nt.links.new(t.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], o.inputs["Surface"])
    scr.data.materials.append(m)
    return root


# ------------------------------------------------------------------ camera
def cam_keys(cam, keys, lens=None):
    """keys: [(frame, pos, target, focus_target_or_None, lens_or_None)]"""
    for f, pos, tgt, foc, ln in keys:
        cam.location = Vector(pos)
        C.look_at(cam, tgt)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        if foc is not None:
            cam.data.dof.use_dof = True
            cam.data.dof.focus_distance = (Vector(foc) - Vector(pos)).length
            cam.data.dof.keyframe_insert("focus_distance", frame=f)
        if ln:
            cam.data.lens = ln
            cam.data.keyframe_insert("lens", frame=f)
    C.ease_keys(cam)
    C.ease_keys(cam.data)


def topdown(cam, f, x, y, z, lens=None, up_deg=0.0):
    cam.location = (x, y, z)
    cam.rotation_euler = (0, 0, math.radians(up_deg))
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
    if lens:
        cam.data.lens = lens
        cam.data.keyframe_insert("lens", frame=f)


# ------------------------------------------------------------------ shots
T0 = {"c_clay": 0.0, "c_mini": 0.0, "s1": 0.0, "s2a": 4.0, "s2b": 6.25, "s3": 9.15, "s4": 14.2, "s5a": 22.6, "s5b": 28.7, "s6": 30.9}
LEN = {"c_clay": 150, "c_mini": 150, "s1": 120, "s2a": 68, "s2b": 87, "s3": 152, "s4": 252, "s5a": 183, "s5b": 66, "s6": 199}
cam = C.camera("Cam", 30)
cam.data.dof.aperture_fstop = 4.0
n = LEN[SHOT]
t0 = T0[SHOT]
sc.frame_start, sc.frame_end = 1, n
blinks(1, n)
if SHOT not in ("s1", "s2a", "s2b", "c_clay", "c_mini"):
    writing()

if SHOT == "s1":
    C.set_sun_azimuth(-118)
    place(0.6, -0.4, 0)
    key_pose(1, "idle", head=(0, -0.05, 1))
    key_pose(60, "idle", head=(0.12, -0.02, 1), yaw=-14)
    key_pose(n, "idle", head=(0.12, -0.02, 1), yaw=-18)
    key_face(1, "worried")
    cam.data.lens = 30
    cam_keys(cam, [(1, (2.4, -27.0, 34.0), (0.2, -0.2, 0.5), None, None), (n, (0.9, -11.5, 13.2), (0.4, -0.3, 0.7), None, None)])
    cam.data.dof.use_dof = False

elif SHOT == "s2a":
    C.set_sun_azimuth(-118)
    place(0.9, -0.9, 8)
    key_pose(1, "idle", head=(0, -0.05, 1))
    key_pose(8, "idle", head=(0, -0.02, 1))
    key_pose(26, "phone_up", head=(0, 0.42, 1))
    key_pose(n, "phone_up", head=(0.03, 0.46, 1))
    pose("phone_up", head=(0, 0.42, 1))
    ph, phm = make_phone()
    hold_phone(ph)
    key_face(1, "neutral")
    key_face(20, "worried")
    key_face(n, "worried")
    key_value(phm, "toB", 1, 0.0)
    key_value(phm, "toC", 1, 0.0)
    a = arm.location
    cam_keys(cam, [(1, a + Vector((0.5, -2.05, 0.5)), a + Vector((0, 0, 1.45)), a + Vector((0, 0, 1.55)), 30),
                   (n, a + Vector((0.38, -1.65, 0.55)), a + Vector((0, 0, 1.6)), a + Vector((0, 0, 1.6)), 30)])
    cam.data.dof.aperture_fstop = 3.2

elif SHOT == "s2b":
    C.set_sun_azimuth(-118)
    place(0.9, -0.9, 8)
    key_pose(1, "phone_up", head=(0.03, 0.46, 1))
    key_pose(n, "phone_up", head=(0.05, 0.48, 1))
    pose("phone_up", head=(0.03, 0.46, 1))
    ph, phm = make_phone()
    hold_phone(ph)
    key_face(1, "worried")
    fB, fC = sec(7.35, t0), sec(8.25, t0)
    for node, f_on in (("toB", fB), ("toC", fC)):
        key_value(phm, node, 1, 0.0)
        key_value(phm, node, f_on - 1, 0.0)
        key_value(phm, node, f_on, 1.0)
    bpy.context.view_layer.update()
    pm = ph.matrix_world
    pc = pm.translation
    scr_n = -(pm.to_3x3() @ Vector((0, 1, 0))).normalized()
    up = (pm.to_3x3() @ Vector((0, 0, 1))).normalized()
    c0 = pc + scr_n * 0.42 - up * 0.06
    c1 = pc + scr_n * 0.3 - up * 0.04
    cam_keys(cam, [(1, c0, pc, pc, 35), (n, c1, pc, pc, 35)])
    cam.data.dof.aperture_fstop = 2.0

elif SHOT == "s3":
    C.set_sun_azimuth(178)
    place(0.2, -3.42, 90)
    key_pose(1, "stick", head=(0.0, -0.45, 1))
    key_pose(n, "stick", head=(0.0, -0.5, 1))
    pose("stick", head=(0.0, -0.45, 1))
    st = make_stick()
    wrist, knuck, fwd, across, nrm = hand_frame("R")
    grip = wrist + (knuck - wrist) * 0.6
    st.location = grip + Vector((0, 0, -0.1))
    tip = Vector((0.78, -3.02, Hgt(0.78, -3.02)))
    d = (grip - tip).normalized()
    st.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    st.location = tip
    st.scale = (1, 1, (grip - tip).length / 1.15 + 0.12)
    child_of_bone(st, "wrist.R")
    key_face(1, "focus")
    zg = Hgt(1.5, -1.9)
    topdown(cam, 1, 1.5, -1.22, zg + 1.65, 30)
    topdown(cam, sec(11.9, t0), 1.5, -1.3, zg + 1.75, 30)
    topdown(cam, sec(13.0, t0), 1.5, -2.05, zg + 2.6, 30)
    topdown(cam, n, 1.5, -2.12, zg + 2.5, 30)
    C.ease_keys(cam)
    cam.data.dof.use_dof = False

elif SHOT == "s4":
    C.set_sun_azimuth(150)
    place(4.0, 0.25, 180)
    key_pose(1, "idle", head=(0, -0.1, 1))
    key_pose(n, "idle", head=(0, 0.25, 1), yaw=20)
    key_face(1, "smug")
    rv = TOP_MAT.node_tree.nodes["HeatReveal"].outputs[0]
    for f, v in ((1, 0.0), (sec(15.2, t0), 0.0), (sec(17.6, t0), 1.0), (n, 1.0)):
        rv.default_value = v
        rv.keyframe_insert("default_value", frame=f)
    topdown(cam, 1, 0.3, 0.1, 19.0, 30)
    topdown(cam, sec(19.6, t0), 0.6, 0.15, 14.5, 30)
    topdown(cam, n, 3.95, 0.3, Hgt(4.0, 0.25) + 4.6, 30)
    C.ease_keys(cam)
    cam.data.dof.use_dof = False

elif SHOT in ("s5a", "s5b"):
    C.set_sun_azimuth(196)
    place(2.45, 0.2, -90)
    key_pose(1, "laptop", head=(-0.0, -0.55, 1))
    key_pose(n, "laptop", head=(-0.0, -0.58, 1))
    pose("laptop", head=(0.0, -0.55, 1))
    root = make_laptop(os.path.join(TEX, "laptop_call.png"))
    parts = [c for c in root.children_recursive if c.type == "MESH"]
    bpy.context.view_layer.update()
    # laptop base in front of him at forearm height, screen facing him
    wl, kl, *_ = hand_frame("L")
    wr, kr, *_ = hand_frame("R")
    mid = (wl + wr) / 2
    root.location = Vector((mid.x - 0.07, mid.y, mid.z + 0.02))
    root.rotation_euler = (0, 0, math.radians(90))
    bpy.context.view_layer.update()
    for ob in parts:
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        cmin = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
        cmax = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
        print("LAPTOP", ob.name, tuple(round(c, 3) for c in cmin), tuple(round(c, 3) for c in cmax))
    faces = ["coco_face1.png", "coco_face2.png", "coco_face3.png", "coco_face4.png"]
    spots = [(1.18, -0.62), (1.0, -0.12), (1.0, 0.45), (1.18, 0.98)]
    for i, (x, y) in enumerate(spots):
        coconut(f"Coco{i + 1}", os.path.join(TEX, faces[i]), (x, y, Hgt(x, y) + 0.105), (2.45 - x, 0.2 - y))
    key_face(1, "serious")
    a = arm.location
    if SHOT == "s5a":
        f_cut = sec(26.05, t0)
        g = Hgt(0.2, 0.2)
        g = Hgt(0.7, -1.5)
        A0, A1 = Vector((0.4, -1.9, g + 1.45)), Vector((0.72, -1.6, g + 1.4))
        tgtA = Vector((1.72, 0.15, a.z + 0.72))
        gb = Hgt(1.75, 0.0)
        B0, B1 = Vector((2.12, -0.62, gb + 0.26)), Vector((2.12, 0.92, gb + 0.26))
        cam_keys(cam, [(1, A0, tgtA, a + Vector((0, 0, 1.2)), 26),
                       (f_cut - 1, A1, tgtA, a + Vector((0, 0, 1.2)), 26),
                       (f_cut, B0, Vector((1.0, -0.62, gb + 0.12)), Vector((1.18, -0.62, gb + 0.12)), 30),
                       (n, B1, Vector((1.0, 0.92, gb + 0.12)), Vector((1.1, 0.92, gb + 0.12)), 30)])
        for fc in C.action_fcurves(cam) + C.action_fcurves(cam.data):
            for kp in fc.keyframe_points:
                if abs(kp.co[0] - (f_cut - 1)) < 0.5:
                    kp.interpolation = "CONSTANT"
        cam.data.dof.aperture_fstop = 2.8
    else:
        sh = arm.matrix_world @ pb["head"].head
        scr = root.location + Vector((0, 0, 0.11))
        look = scr + Vector((-0.45, 0, -0.12))
        cam_keys(cam, [(1, sh + Vector((0.34, 0.24, 0.12)), look, scr, 30), (n, sh + Vector((0.24, 0.16, 0.05)), look, scr, 30)])
        cam.data.dof.aperture_fstop = 2.8

elif SHOT == "s6":
    C.set_sun_azimuth(-25)
    fx, fy = 2.3, -3.6
    place(fx, fy, 33)
    f_stop = sec(33.6, t0)
    key_pose(1, "idle", head=(0, -0.05, 1))
    key_pose(f_stop - 6, "idle", head=(0, -0.05, 1))
    key_pose(f_stop + 6, "stop", head=(0, -0.05, 1))
    key_pose(n, "stop", head=(0, -0.05, 1))
    key_face(1, "neutral")
    key_face(f_stop, "proud")
    key_face(n, "proud")
    sea = Vector((0.54, -0.84, 0)).normalized()
    side = Vector((-sea.y, sea.x, 0))  # to the hero's left when he faces the sea
    P = Vector((fx, fy, Hgt(fx, fy)))
    sp = P + side * 1.05 - sea * 0.35
    make_sign((sp.x, sp.y, Hgt(sp.x, sp.y) - 0.18), (-sea.x - side.x * 0.6, -sea.y - side.y * 0.6, 0))
    hdg = math.degrees(math.atan2(-sea.y, -sea.x))
    boat = make_boat(P + sea * 24.0 - side * 1.5, hdg)
    f_arrive = sec(33.4, t0)
    for f in range(1, n + 1, 4):
        k = C.ss(1, f_arrive, f)
        dist = 24.0 - 8.0 * (1 - (1 - k) ** 2)
        boat.location = P + sea * dist - side * 1.5 + Vector((0, 0, 0.05 * math.sin(f * 0.11) - 0.05))
        boat.rotation_euler = (math.radians(1.6 * math.sin(f * 0.09 + 1)), math.radians(-2.0 * (1 - k)), math.radians(hdg))
        boat.keyframe_insert("location", frame=f)
        boat.keyframe_insert("rotation_euler", frame=f)
    behind = P - sea * 3.0 - side * 1.25 + Vector((0, 0, 1.65))
    cam_keys(cam, [(1, behind, P + sea * 9.0 + Vector((0, 0, 0.9)), P + sea * 12.0, 30),
                   (f_stop, behind + sea * 0.35, P + sea * 9.0 + Vector((0, 0, 0.95)), P + sea * 10.0, 30),
                   (sec(34.4, t0), behind + sea * 0.3 + Vector((0, 0, 0.1)), P + sea * 8.0 + Vector((0, 0, 0.9)), P, 30),
                   (n, P - sea * 7.5 - side * 2.6 + Vector((0, 0, 5.4)), P + sea * 1.8 + side * 0.5 + Vector((0, 0, 0.6)), P + side * 0.6, 30)])
    cam.data.dof.aperture_fstop = 8.0

if SHOT == "c_clay":
    import styles as ST
    C.set_sun_azimuth(-118)
    place(0.9, -0.9, 8)
    key_pose(1, "idle", head=(0, -0.05, 1))
    key_pose(30, "idle", head=(0.0, 0.05, 1), yaw=-12)
    key_pose(52, "phone_up", head=(0, 0.42, 1))
    key_pose(n, "phone_up", head=(0.04, 0.46, 1))
    pose("phone_up", head=(0, 0.42, 1))
    ph, phm = make_phone()
    hold_phone(ph)
    key_value(phm, "toB", 1, 0.0)
    key_value(phm, "toC", 1, 0.0)
    key_face(1, "neutral")
    key_face(60, "worried")
    key_face(n, "shock")
    a = arm.location
    cam_keys(cam, [(1, a + Vector((0.75, -3.4, 1.05)), a + Vector((0.1, 0, 1.35)), a + Vector((0, 0, 1.45)), 32),
                   (n, a + Vector((0.5, -2.6, 1.1)), a + Vector((0.12, 0, 1.5)), a + Vector((0, 0, 1.5)), 32)])
    cam.data.dof.aperture_fstop = 2.2
    ST.clay(sc, cam, studio_bg=None)
    for o in bpy.data.objects:
        if o.name.startswith("Hero") or o.name.startswith("Phone"):
            o.hide_render = True
    import clayfig
    clayfig.clay_figure(sc, arm.location.copy(), 8)
elif SHOT == "c_mini":
    import styles as ST
    C.set_sun_azimuth(-140)
    place(0.6, -0.4, 0)
    key_pose(1, "idle", head=(0, -0.05, 1))
    key_pose(40, "phone_up", head=(0, 0.42, 1))
    key_pose(n, "phone_up", head=(0.04, 0.46, 1))
    pose("phone_up", head=(0, 0.42, 1))
    ph, phm = make_phone()
    hold_phone(ph)
    key_face(1, "worried")
    f0 = Vector((0.6, -0.4, Hgt(0.6, -0.4) + 1.0))
    cam_keys(cam, [(1, (16.0, -25.0, 21.0), f0, f0, 85), (n, (12.5, -27.0, 20.0), f0, f0, 85)])
    cam.data.dof.aperture_fstop = 0.09
    ST.mini(sc)

dbg = os.environ.get("DEBUG_CAM")
if dbg:
    v = [float(t) for t in dbg.split(",")]
    cam.animation_data_clear()
    cam.data.animation_data_clear()
    cam.location = v[0:3]
    C.look_at(cam, v[3:6])
    cam.data.lens = v[6]
    cam.data.dof.use_dof = False
for pre in [p for p in os.environ.get("DEBUG_HIDE", "").split(",") if p]:
    for ob in bpy.data.objects:
        if ob.name.startswith(pre):
            ob.hide_render = True
if os.environ.get("DEBUG_SUN"):
    C.set_sun_azimuth(float(os.environ["DEBUG_SUN"]))
if os.environ.get("DEBUG_REPORT"):
    sc.frame_set(START)
    bpy.context.view_layer.update()
    dgr = bpy.context.evaluated_depsgraph_get()
    for nm in ("Phone", "PhoneScreen", "Writing", "Stick", "Laptop"):
        ob = bpy.data.objects.get(nm)
        if ob:
            ev = ob.evaluated_get(dgr)
            bb = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
            print("DBG", nm, "hide_render", ob.hide_render, "min", tuple(round(min(p[i] for p in bb), 3) for i in range(3)), "max", tuple(round(max(p[i] for p in bb), 3) for i in range(3)))
    print("DBG cam", tuple(round(c, 3) for c in cam.matrix_world.translation), "rot", tuple(round(math.degrees(c), 1) for c in cam.matrix_world.to_euler()), "lens", round(cam.data.lens, 1), "sensor", cam.data.sensor_width, cam.data.sensor_fit, "res", sc.render.resolution_x, sc.render.resolution_y)
    w_ = bpy.data.objects.get("Writing")
    if w_:
        zs = [v.co.z for v in w_.data.vertices]
        print("DBG writing z", round(min(zs), 4), round(max(zs), 4), "verts", len(zs))
    it = bpy.data.objects["IslandTop"]
    print("DBG terrain z at (1.5,-1.25):", round(max((v.co.z for v in it.data.vertices if abs(v.co.x - 1.5) < 0.013 and abs(v.co.y + 1.25) < 0.013), default=-9), 4), "H", round(Hgt(1.5, -1.25), 4))
C.setup_render(1080 * SCALE // 100, 1920 * SCALE // 100, SAMPLES, motion_blur=os.environ.get("MBLUR") == "1")
if os.environ.get("NOCOMP"):
    sc.render.use_compositing = False
if os.environ.get("DENOISE"):
    dn = os.environ["DENOISE"]
    sc.cycles.use_denoising = dn != "off"
    if dn == "optix":
        sc.cycles.denoiser = "OPTIX"
    elif dn.startswith("oidn"):
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
        sc.cycles.denoising_use_gpu = dn == "oidn-gpu"
if os.environ.get("OCEANRES"):
    bpy.data.objects["Ocean"].modifiers["Ocean"].resolution = int(os.environ["OCEANRES"])
end = END or n
os.makedirs(OUTDIR, exist_ok=True)
if STEP == 0:  # preview: first, middle and last frame
    for f in sorted({START, (START + end) // 2, end}):
        C.render_frames(OUTDIR, f, f, 1, SHOT)
else:
    C.render_frames(OUTDIR, START, end, STEP, SHOT)
print("DONE", SHOT, START, end)
