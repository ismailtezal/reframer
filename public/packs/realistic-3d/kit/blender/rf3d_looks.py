# Two looks that reuse a realistic scene: claymation (plasticine stop-motion) and miniature (tilt-shift).
# Both keep the scene's geometry, lights and camera move; they change materials, motion and the lens.
#
#     import rf3d_looks as LK
#     skin = LK.clay_material("ClaySkin", (0.88, 0.55, 0.38), rough=0.5, sss=0.15, strength=0.45)
#     LK.assign(body_obj, skin)
#     LK.clay_lumps([body_obj, shirt_obj], frames=(1, 150))   # hand-made lumps that boil every 2 frames
#     LK.stop_motion_camera(cam, frames=(1, 150))              # tiny nudges between held frames
#     # render every 2nd frame (render.mjs --step 2) and hold each for two frames in the edit: 15 fps stop-motion
#
#     LK.miniature(scene, cam, focus=(0.6, -0.4, 1.0))          # high, far, long lens, razor-thin focus
import bpy, random
from mathutils import Vector


def _principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs["Surface"])
    return m, nt, bs


def _clay_bump(nt, bs, strength=0.32, boil=True):
    """Fingerprint-ish smudges and soft lumps; with boil the pattern shifts every 2 frames like hand-moved clay."""
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


def clay_material(name, rgb, rough=0.62, sss=0.06, strength=0.32, boil=True):
    """Matte plasticine in one colour."""
    m, nt, bs = _principled(name)
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Specular IOR Level"].default_value = 0.35
    bs.inputs["Subsurface Weight"].default_value = sss
    bs.inputs["Subsurface Radius"].default_value = (0.6, 0.35, 0.25)
    bs.inputs["Subsurface Scale"].default_value = 0.02
    _clay_bump(nt, bs, strength, boil)
    return m


def clay_from_texture(name, image, steps=5.0, sat=1.25, rough=0.6, split=None):
    """Keep a texture's colours but flatten them into plasticine: posterized, saturated, matte, smudged.
    split=(v, (r, g, b)) paints everything below texture height v one solid colour: MakeHuman's casual suits keep the
    shirt and the jeans in one texture, and posterized denim turns cyan (male_casualsuit04: (0.6, (0.1, 0.17, 0.36)))."""
    m, nt, bs = _principled(name)
    uv = nt.nodes.new("ShaderNodeUVMap")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = image
    nt.links.new(uv.outputs[0], t.inputs["Vector"])
    hs = nt.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Saturation"].default_value = sat
    nt.links.new(t.outputs["Color"], hs.inputs["Color"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(hs.outputs["Color"], sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineColor")
    for ch in ("Red", "Green", "Blue"):
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
    color = comb.outputs[0]
    if split:
        sep_uv = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(uv.outputs[0], sep_uv.inputs[0])
        below = nt.nodes.new("ShaderNodeMath")
        below.operation = "LESS_THAN"
        below.inputs[1].default_value = split[0]
        nt.links.new(sep_uv.outputs["Y"], below.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        cin = [x for x in mix.inputs if x.type == "RGBA"]
        nt.links.new(below.outputs[0], mix.inputs[0])
        nt.links.new(color, cin[0])
        cin[1].default_value = (*split[1], 1)
        color = [x for x in mix.outputs if x.type == "RGBA"][0]
    nt.links.new(color, bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Specular IOR Level"].default_value = 0.35
    _clay_bump(nt, bs, 0.3)
    return m


def first_image(obj):
    """The first diffuse image texture on an object's materials (to turn a garment into clay of its own colours)."""
    for s in obj.material_slots:
        if s.material and s.material.node_tree:
            for n in s.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and "diffuse" in n.name.lower():
                    return n.image
    return None


def assign(obj, mat):
    """Replace every material slot of obj with mat."""
    if not obj.data.materials:
        obj.data.materials.append(mat)
    for i in range(len(obj.data.materials)):
        obj.data.materials[i] = mat


def _hold(obj, frames, step, jitter, seed):
    rnd = random.Random(seed)
    for f in range(frames[0], frames[1] + 1, step):
        obj.location = tuple(rnd.uniform(-j, j) for j in jitter)
        obj.keyframe_insert("location", frame=f)
    ad = obj.animation_data
    if ad and ad.action:
        try:
            curves = list(ad.action.fcurves)
        except Exception:
            curves = [fc for layer in ad.action.layers for strip in layer.strips for cb in strip.channelbags for fc in cb.fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"


def clay_lumps(objects, strength=0.006, frames=(1, 150), seed=9):
    """Hand-made lumps on meshes (a displacement that changes every 2 frames, like a sculptor touching them)."""
    sc = bpy.context.scene
    tex = bpy.data.textures.new("ClayLumps", "CLOUDS")
    tex.noise_scale = 0.06
    tex.noise_depth = 1
    hand = bpy.data.objects.new("ClayHand", None)
    sc.collection.objects.link(hand)
    _hold(hand, frames, 2, (1, 1, 1), seed)
    for o in objects:
        md = o.modifiers.new("ClayLumps", "DISPLACE")
        md.texture = tex
        md.texture_coords = "OBJECT"
        md.texture_coords_object = hand
        md.strength = strength
        md.mid_level = 0.5
        o.cycles.use_deform_motion = False


def stop_motion_camera(cam, frames=(1, 150), amount=0.004, seed=5):
    """Tiny camera nudges between held frames, as on a hand-built stop-motion set."""
    sc = bpy.context.scene
    jit = bpy.data.objects.new("CamJitter", None)
    sc.collection.objects.link(jit)
    _hold(jit, frames, 2, (amount, amount, amount * 0.75), seed)
    c = cam.constraints.new("CHILD_OF")
    c.target = jit
    c.inverse_matrix = jit.matrix_world.inverted()


def area_light(name, loc, target, energy, size, color=(1.0, 0.95, 0.88)):
    """A soft studio area light aimed at target (a tabletop key or fill)."""
    L = bpy.data.lights.new(name, "AREA")
    L.energy = energy
    L.size = size
    L.color = color
    lo = bpy.data.objects.new(name, L)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return lo


def saturate(materials, saturation=1.35, value=1.05):
    """Punchier colour on materials' base colour (a miniature reads as painted model kit)."""
    for m in materials:
        if not m or not m.node_tree:
            continue
        nt = m.node_tree
        bs = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bs or not bs.inputs["Base Color"].links:
            continue
        link = bs.inputs["Base Color"].links[0]
        hs = nt.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = saturation
        hs.inputs["Value"].default_value = value
        nt.links.new(link.from_socket, hs.inputs["Color"])
        nt.links.new(hs.outputs["Color"], bs.inputs["Base Color"])


def miniature(sc, cam, focus, fstop=0.09, lens=85, exposure=0.25):
    """Tilt-shift miniature: a high, far camera with a long lens and a razor-thin focus plane on `focus`.
    Speed water and crowds up (time-lapse) for the toy-town feel; saturate() the main materials."""
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = fstop
    cam.data.dof.focus_distance = (Vector(focus) - cam.location).length
    sc.view_settings.exposure = exposure
