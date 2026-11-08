# Stylized plasticine figure (simple, chunky proportions) for the clay teaser.
import bpy, math, os
import styles as ST


def _blob(kind, name, loc, scale, mat, parent=None, seg=32):
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1.0, location=(0, 0, 0))
    elif kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1.0, depth=2.0, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    o.location = loc
    if kind != "sphere":
        bv = o.modifiers.new("Round", "BEVEL")
        bv.width = min(scale) * 0.45
        bv.segments = 6
    sub = o.modifiers.new("Smooth", "SUBSURF")
    sub.levels = sub.render_levels = 1
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def clay_figure(sc, root_loc, facing_deg, f_raise=(30, 52), n=150):
    skin = bpy.data.materials.get("ClaySkin") or ST.clay_solid("ClaySkin", (0.88, 0.55, 0.38), 0.5, 0.15, 0.45)
    shirt = ST.clay_solid("ClayShirtBlue", (0.03, 0.14, 0.62), 0.6, 0.0, 0.45)
    jeans = ST.clay_solid("ClayJeans", (0.025, 0.05, 0.13), 0.65, 0.0, 0.5)
    hair = bpy.data.materials.get("ClayHair") or ST.clay_solid("ClayHair", (0.07, 0.045, 0.03), 0.7, 0.0, 0.55)
    white = ST.clay_solid("ClayWhite", (0.92, 0.92, 0.88), 0.35, 0.0, 0.15)
    black = ST.clay_solid("ClayBlack", (0.01, 0.01, 0.012), 0.3, 0.0, 0.1)
    mouthm = ST.clay_solid("ClayMouth", (0.25, 0.04, 0.04), 0.5, 0.0, 0.2)
    root = bpy.data.objects.new("ClayGuy", None)
    sc.collection.objects.link(root)
    root.location = root_loc
    root.rotation_euler = (0, 0, math.radians(facing_deg))
    S = 1.25

    def P(x, y, z):
        return (x * S, y * S, z * S)

    for sx in (-1, 1):
        _blob("cyl", f"ClayLeg{sx}", P(0.11 * sx, 0, 0.3), (0.085 * S, 0.085 * S, 0.27 * S), jeans, root)
        _blob("sphere", f"ClayFoot{sx}", P(0.12 * sx, -0.05, 0.035), (0.075 * S, 0.12 * S, 0.045 * S), skin, root)
    _blob("sphere", "ClayBody", P(0, 0, 0.78), (0.24 * S, 0.17 * S, 0.27 * S), shirt, root)
    _blob("cyl", "ClayNeck", P(0, 0, 1.03), (0.06 * S, 0.06 * S, 0.05 * S), skin, root)
    head = bpy.data.objects.new("ClayHeadPivot", None)
    sc.collection.objects.link(head)
    head.parent = root
    head.location = P(0, 0, 1.05)
    _blob("sphere", "ClayHead", P(0, 0, 0.17), (0.17 * S, 0.16 * S, 0.19 * S), skin, head)
    _blob("sphere", "ClayHairCap", P(0, 0.02, 0.27), (0.175 * S, 0.165 * S, 0.12 * S), hair, head)
    _blob("sphere", "ClayNose", P(0, -0.165, 0.15), (0.035 * S, 0.035 * S, 0.03 * S), skin, head)
    for sx in (-1, 1):
        _blob("sphere", f"ClayEye{sx}", P(0.062 * sx, -0.13, 0.22), (0.045 * S, 0.03 * S, 0.05 * S), white, head)
        _blob("sphere", f"ClayPupil{sx}", P(0.062 * sx, -0.158, 0.232), (0.02 * S, 0.012 * S, 0.022 * S), black, head)
        brow = _blob("cyl", f"ClayBrow{sx}", P(0.065 * sx, -0.14, 0.29), (0.012 * S, 0.012 * S, 0.035 * S), hair, head)
        brow.rotation_euler = (0, math.radians(90 + 12 * sx), 0)
    mouth = _blob("sphere", "ClayMouthO", P(0, -0.15, 0.07), (0.035 * S, 0.012 * S, 0.018 * S), mouthm, head)
    cu = bpy.data.curves.new("ClayLogo", "FONT")
    cu.body = os.environ.get("RF3D_PRINT", "REFRAMER")  # the shirt print, as on the realistic hero
    cu.size = 0.055 * S
    cu.extrude = 0.006
    cu.bevel_depth = 0.002
    cu.align_x = "CENTER"
    logo = bpy.data.objects.new("ClayLogo", cu)
    sc.collection.objects.link(logo)
    logo.parent = root
    logo.location = P(0, -0.172, 0.86)
    logo.rotation_euler = (math.radians(90), 0, 0)
    logo.data.materials.append(white)
    arms = {}
    for sx in (-1, 1):
        sh = bpy.data.objects.new(f"ClayShoulder{sx}", None)
        sc.collection.objects.link(sh)
        sh.parent = root
        sh.location = P(0.24 * sx, 0, 0.92)
        _blob("sphere", f"ClaySleeve{sx}", (0, 0, -0.02 * S), (0.075 * S, 0.075 * S, 0.075 * S), shirt, sh)
        _blob("cyl", f"ClayArm{sx}", (0, 0, -0.22 * S), (0.05 * S, 0.05 * S, 0.2 * S), skin, sh)
        _blob("sphere", f"ClayHand{sx}", (0, 0, -0.44 * S), (0.06 * S, 0.05 * S, 0.065 * S), skin, sh)
        sh.rotation_euler = (0, math.radians(-12 * sx), 0)
        arms[sx] = sh
    _blob("cube", "ClayPhone", (0, -0.03 * S, -0.52 * S), (0.035 * S, 0.008 * S, 0.07 * S), black, arms[-1])
    rsh = arms[-1]
    a0, a1 = f_raise
    for f, rot in ((1, (0, math.radians(12), 0)), (a0, (0, math.radians(12), 0)),
                   (a1, (math.radians(-22), math.radians(168), math.radians(-6))), (n, (math.radians(-24), math.radians(170), math.radians(-8)))):
        rsh.rotation_euler = rot
        rsh.keyframe_insert("rotation_euler", frame=f)
    for f, rot in ((1, (math.radians(-4), 0, 0)), (a0, (math.radians(-6), 0, math.radians(-6))),
                   (a1 + 6, (math.radians(-28), 0, math.radians(8))), (n, (math.radians(-30), 0, math.radians(10)))):
        head.rotation_euler = rot
        head.keyframe_insert("rotation_euler", frame=f)
    for f, sz in ((1, 1.0), (a1 + 20, 1.0), (a1 + 30, 2.6), (n, 2.8)):
        mouth.scale = (1.0, 1.0, sz)
        mouth.keyframe_insert("scale", frame=f)
    # lumpy, hand-shaped surfaces that "boil" every two frames
    tex = bpy.data.textures.get("ClayLumps")
    hand = bpy.data.objects.get("ClayHand")
    if tex and hand:
        for o in bpy.data.objects:
            if o.type == "MESH" and o.name.startswith("Clay") and o.name not in ("ClayPhone",):
                md = o.modifiers.new("ClayLumps", "DISPLACE")
                md.texture = tex
                md.texture_coords = "OBJECT"
                md.texture_coords_object = hand
                md.strength = 0.012
                md.mid_level = 0.5
    return root
