# Style passes over the island scene for the style teasers: clay (plasticine stop-motion) and miniature (tilt-shift).
import bpy, math, random
from mathutils import Vector


def _mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs["Surface"])
    return m, nt, bs


def _clay_bump(nt, bs, strength=0.32, boil=True):
    """Fingerprint-ish smudges + soft lumps; the pattern shifts every 2 frames like hand-moved clay."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.noise_dimensions = "4D"
    nz.inputs["Scale"].default_value = 18.0
    nz.inputs["Detail"].default_value = 3.0
    nz.inputs["Roughness"].default_value = 0.45
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.feature = "DISTANCE_TO_EDGE"
    vo.inputs["Scale"].default_value = 60.0
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MULTIPLY_ADD"
    nt.links.new(vo.outputs["Distance"], mx.inputs[0])
    mx.inputs[1].default_value = 0.35
    nt.links.new(nz.outputs["Fac"], mx.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.01
    nt.links.new(mx.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bs.inputs["Normal"])
    if boil:
        w = nt.nodes.new("ShaderNodeValue")
        fc = w.outputs[0].driver_add("default_value")
        fc.driver.expression = "floor(frame/2)*0.37"
        nt.links.new(w.outputs[0], nz.inputs["W"])


def clay_solid(name, rgb, rough=0.62, sss=0.06, strength=0.32):
    m, nt, bs = _mat(name)
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Specular IOR Level"].default_value = 0.35
    bs.inputs["Subsurface Weight"].default_value = sss
    bs.inputs["Subsurface Radius"].default_value = (0.6, 0.35, 0.25)
    bs.inputs["Subsurface Scale"].default_value = 0.02
    _clay_bump(nt, bs, strength)
    return m


def clay_from_texture(name, image, steps=5.0, sat=1.25, rough=0.6):
    """Keep the garment's colours but flatten them into plasticine: posterized, saturated, matte, smudged."""
    m, nt, bs = _mat(name)
    uv = nt.nodes.new("ShaderNodeUVMap")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = image
    nt.links.new(uv.outputs[0], t.inputs["Vector"])
    blur = nt.nodes.new("ShaderNodeHueSaturation")
    blur.inputs["Saturation"].default_value = sat
    nt.links.new(t.outputs["Color"], blur.inputs["Color"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(blur.outputs["Color"], sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineColor")
    for i, ch in enumerate(("Red", "Green", "Blue")):
        a = nt.nodes.new("ShaderNodeMath")
        a.operation = "MULTIPLY"
        a.inputs[1].default_value = steps
        nt.links.new(sep.outputs[ch], a.inputs[0])
        r = nt.nodes.new("ShaderNodeMath")
        r.operation = "ROUND"
        nt.links.new(a.outputs[0], r.inputs[0])
        d = nt.nodes.new("ShaderNodeMath")
        d.operation = "DIVIDE"
        d.inputs[1].default_value = steps
        nt.links.new(r.outputs[0], d.inputs[0])
        nt.links.new(d.outputs[0], comb.inputs[ch])
    sepuv = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs[0], sepuv.inputs[0])
    isjeans = nt.nodes.new("ShaderNodeMath")
    isjeans.operation = "LESS_THAN"
    isjeans.inputs[1].default_value = 0.6
    nt.links.new(sepuv.outputs["Y"], isjeans.inputs[0])
    mixj = nt.nodes.new("ShaderNodeMix")
    mixj.data_type = "RGBA"
    cj = [x for x in mixj.inputs if x.type == "RGBA"]
    nt.links.new(isjeans.outputs[0], mixj.inputs[0])
    nt.links.new(comb.outputs[0], cj[0])
    cj[1].default_value = (0.1, 0.17, 0.36, 1)
    nt.links.new([x for x in mixj.outputs if x.type == "RGBA"][0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Specular IOR Level"].default_value = 0.35
    _clay_bump(nt, bs, 0.3)
    return m


def _first_image(obj):
    for s in obj.material_slots:
        if s.material and s.material.node_tree:
            for n in s.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and "diffuse" in n.name.lower():
                    return n.image
    return None


def clay(sc, cam, studio_bg=(0.32, 0.62, 0.95)):
    skin = clay_solid("ClaySkin", (0.88, 0.55, 0.38), 0.5, 0.15, 0.45)
    hair = clay_solid("ClayHair", (0.07, 0.045, 0.03), 0.7, 0.0, 0.55)
    sand = clay_solid("ClaySand", (0.93, 0.76, 0.45), 0.7, 0.0, 0.45)
    water = clay_solid("ClayWater", (0.12, 0.62, 0.72), 0.22, 0.0, 0.25)
    bark = clay_solid("ClayBark", (0.42, 0.26, 0.13), 0.7, 0.0, 0.6)
    leaf = clay_solid("ClayLeaf", (0.03, 0.17, 0.03), 0.65, 0.0, 0.3)
    nut = clay_solid("ClayNut", (0.36, 0.22, 0.1), 0.65, 0.0, 0.5)
    for o in bpy.data.objects:
        if o.type not in ("MESH", "CURVE"):
            continue
        n = o.name
        def setall(m):
            if not o.data.materials:
                o.data.materials.append(m)
            for i in range(len(o.data.materials)):
                o.data.materials[i] = m
        if n == "Hero.body":
            setall(skin)
        elif "short02" in n or "eyebrow" in n or "eyelash" in n:
            setall(hair)
        elif "casualsuit" in n:
            img = _first_image(o)
            setall(clay_from_texture("ClayClothes", img, steps=7.0, sat=1.1) if img else clay_solid("ClayShirt", (0.15, 0.32, 0.8)))
        elif n in ("IslandTop", "Seabed", "Writing"):
            setall(sand)
        elif n in ("Ocean", "OceanFar"):
            setall(water)
        elif n == "PalmTrunk":
            setall(bark)
        elif n == "PalmFronds":
            setall(leaf)
        elif n.startswith("PalmNut"):
            setall(nut)
        elif "teeth" in n or "tongue" in n:
            o.hide_render = True
    tex = bpy.data.textures.new("ClayLumps", "CLOUDS")
    tex.noise_scale = 0.06
    tex.noise_depth = 1
    hand = bpy.data.objects.new("ClayHand", None)
    sc.collection.objects.link(hand)
    random.seed(9)
    for f in range(1, 152, 2):
        hand.location = (random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))
        hand.keyframe_insert("location", frame=f)
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name.startswith("Hero.") and not any(k in o.name for k in ("high-poly", "teeth", "tongue", "eyelash")):
            md = o.modifiers.new("ClayLumps", "DISPLACE")
            md.texture = tex
            md.texture_coords = "OBJECT"
            md.texture_coords_object = hand
            md.strength = 0.006 if o.name == "Hero.body" else 0.009
            md.mid_level = 0.5
            o.cycles.use_deform_motion = False
    oc = bpy.data.objects.get("Ocean")
    if oc:
        md = oc.modifiers["Ocean"]
        md.wave_scale = 0.18
        md.choppiness = 0.4
    # studio backdrop for camera rays, HDRI keeps lighting the set (None: keep the real sky)
    w = sc.world.node_tree
    bg = w.nodes["SkyBG"]
    if studio_bg is None:
        bg.inputs["Strength"].default_value = 0.9
        studio_bg = (0.0, 0.0, 0.0)
        skip_backdrop = True
    else:
        skip_backdrop = False
    src = bg.inputs["Color"].links[0].from_socket
    lp = w.nodes.new("ShaderNodeLightPath")
    tc = w.nodes.new("ShaderNodeTexCoord")
    sep = w.nodes.new("ShaderNodeSeparateXYZ")
    w.links.new(tc.outputs["Generated"], sep.inputs[0])
    grad = w.nodes.new("ShaderNodeMapRange")
    w.links.new(sep.outputs["Z"], grad.inputs["Value"])
    grad.inputs["From Min"].default_value, grad.inputs["From Max"].default_value = -0.1, 0.6
    mixg = w.nodes.new("ShaderNodeMix")
    mixg.data_type = "RGBA"
    cin = [s for s in mixg.inputs if s.type == "RGBA"]
    w.links.new(grad.outputs[0], mixg.inputs[0])
    cin[0].default_value = (0.98, 0.86, 0.68, 1)
    cin[1].default_value = (*studio_bg, 1)
    mix = w.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    cin2 = [s for s in mix.inputs if s.type == "RGBA"]
    w.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    w.links.new(src, cin2[0])
    w.links.new([s for s in mixg.outputs if s.type == "RGBA"][0], cin2[1])
    if not skip_backdrop:
        w.links.new([s for s in mix.outputs if s.type == "RGBA"][0], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.75
    # soft key light like a tabletop studio
    L = bpy.data.lights.new("ClayKey", "AREA")
    L.energy = 2600
    L.size = 5.0
    L.color = (1.0, 0.95, 0.88)
    lo = bpy.data.objects.new("ClayKey", L)
    sc.collection.objects.link(lo)
    lo.location = (-4.0, -7.0, 7.5)
    lo.rotation_euler = (Vector((0.6, -0.9, 1.4)) - lo.location).to_track_quat("-Z", "Y").to_euler()
    # stop-motion camera: tiny nudges between held frames
    random.seed(5)
    if cam.animation_data and cam.animation_data.action:
        pass
    jit = bpy.data.objects.new("CamJitter", None)
    sc.collection.objects.link(jit)
    for f in range(1, 152, 2):
        jit.location = (random.uniform(-0.004, 0.004), random.uniform(-0.004, 0.004), random.uniform(-0.003, 0.003))
        jit.keyframe_insert("location", frame=f)
    import common as C
    for fc in C.action_fcurves(jit):
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"
    c = cam.constraints.new("CHILD_OF")
    c.target = jit
    c.inverse_matrix = jit.matrix_world.inverted()


def mini(sc, speed=4.0):
    """Tilt-shift miniature: time-lapse sea, punchier colour; the camera supplies the razor-thin focus."""
    oc = bpy.data.objects.get("Ocean")
    if oc:
        fc = oc.modifiers["Ocean"].driver_add("time")
        fc.driver.expression = f"frame/30*{speed}"
    wm = bpy.data.materials.get("Water")
    if wm:
        t = wm.node_tree.nodes.get("Time")
        if t:
            fc = t.outputs[0].driver_add("default_value")
            fc.driver.expression = f"frame/30*{speed}"
    sc.view_settings.exposure = 0.25
    w = sc.world.node_tree
    w.nodes["SkyBG"].inputs["Strength"].default_value = 1.15
    for mname in ("Sand", "SandTop"):
        m = bpy.data.materials.get(mname)
        if not m:
            continue
        nt = m.node_tree
        bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        link = bs.inputs["Base Color"].links[0]
        hs = nt.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = 1.35
        hs.inputs["Value"].default_value = 1.05
        nt.links.new(link.from_socket, hs.inputs["Color"])
        nt.links.new(hs.outputs["Color"], bs.inputs["Base Color"])
