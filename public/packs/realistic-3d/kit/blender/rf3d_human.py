# Builds a realistic human with MPFB (MakeHuman for Blender, CC0 assets) from a JSON spec and saves a .blend:
#     blender -b --python rf3d_human.py -- <spec.json> <out.blend>
# Run it through the kit (setup.mjs installs MPFB into the kit's isolated profile; render/env set
# BLENDER_USER_RESOURCES). The armature is named spec["name"], the body mesh "<name>.body"; every part is a child
# of the armature. The face carries the 52 ARKit shape keys (rf3d_rig.Rig.key_face poses them).
#
# Spec (all optional except name; defaults build a man in his thirties in a casual t-shirt):
# {
#   "name": "Hero",
#   "phenotype": {"gender": 1.0, "age": 0.6, "muscle": 0.6, "weight": 0.55, "proportions": 0.7, "height": 0.56,
#                 "race": {"asian": 0.06, "caucasian": 0.88, "african": 0.06}},   gender 0 = female, 1 = male
#   "targets": [["chin-width-incr", 0.3], ...],         MakeHuman modelling targets (face and body shape)
#   "hair": "short02/short02.mhclo", "eyebrows": "eyebrow001/eyebrow001.mhclo", "eyelashes": "eyelashes02/eyelashes02.mhclo",
#   "clothes": ["male_casualsuit04/male_casualsuit04.mhclo"],
#   "skin": "young_caucasian_male/young_caucasian_male.mhmat",
#   "eye_texture": "brown_eye.png",                    eyes render solid (procedural eyes are see-through holes in EEVEE)
#   "hair_hsv": [0.5, 0.75, 0.32], "brow_hsv": [0.5, 0.8, 0.45],   hue/saturation/value on their textures
#   "garment_textures": [{"match": "casualsuit04", "image": "C:/.../shirt.png"}],   repainted garments (garment-print.mjs)
#   "skin_tweaks": {"Roughness": 0.5, ...},             inputs of MPFB's skin node group
#   "stubble": true,                                    stubble from a beard mask built on the face's own landmarks
#   "relaxed_arms": true                                arms down instead of the A-pose
# }
# What exists in the installed packs: setup.mjs --list (or rf3d_packs.py) prints the skins, hair, clothes, eyebrows.
import bpy, sys, os, math, json, addon_utils
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
spec_path, out_blend = argv[0], argv[1]
with open(spec_path, encoding="utf-8") as fh:
    spec = json.load(fh)

mod = "bl_ext.user_default.mpfb"
if not addon_utils.check(mod)[1]:
    bpy.ops.preferences.addon_enable(module=mod)
from bl_ext.user_default.mpfb.services import HumanService, FaceService, LocationService

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

name = spec.get("name", "Hero")
pheno = {"gender": 1.0, "age": 0.6, "muscle": 0.6, "weight": 0.55, "proportions": 0.7, "height": 0.56,
         "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.06, "caucasian": 0.88, "african": 0.06}}
pheno.update(spec.get("phenotype", {}))
hi = HumanService._create_default_human_info_dict()
hi.update({
    "name": name,
    "phenotype": pheno,
    "targets": [{"target": t, "value": v} for t, v in spec.get("targets", [])],
    "rig": "default",
    "eyes": spec.get("eyes", "high-poly/high-poly.mhclo"),
    "eyebrows": spec.get("eyebrows", "eyebrow001/eyebrow001.mhclo"),
    "eyelashes": spec.get("eyelashes", "eyelashes02/eyelashes02.mhclo"),
    "teeth": "teeth_base/teeth_base.mhclo",
    "tongue": "tongue01/tongue01.mhclo",
    "hair": spec.get("hair", "short02/short02.mhclo"),
    "clothes": spec.get("clothes", ["male_casualsuit04/male_casualsuit04.mhclo"]),
    "skin_mhmat": spec.get("skin", "young_caucasian_male/young_caucasian_male.mhmat"),
    "skin_material_type": "ENHANCED_SSS",
    "eyes_material_type": "MAKESKIN",
})
st = HumanService.get_default_deserialization_settings()
st["subdiv_levels"] = 1
body = HumanService.deserialize_from_dict(hi, st)
FaceService.load_targets(body, load_microsoft_visemes=False, load_meta_visemes=False, load_arkit_faceunits=True)
arm = body.parent
arm.name = name
body.name = f"{name}.body"
print("BUILT", name, "verts", len(body.data.vertices), "shape keys", len(body.data.shape_keys.key_blocks) if body.data.shape_keys else 0)


def part(word):
    return next((o for o in arm.children if word.lower() in o.name.lower()), None)


def first_diffuse(mat):
    return next((n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and "diffuse" in n.name.lower()), None)


# ---- eyes: a real iris texture (MAKESKIN material) ---------------------------------------------
eyes = part("high-poly") or part("eye")
if eyes and eyes.material_slots:
    em = eyes.material_slots[0].material
    tex = next((n for n in em.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    want = spec.get("eye_texture", "brown_eye.png")
    if tex is not None:
        img = os.path.join(os.path.dirname(bpy.path.abspath(tex.image.filepath)), want)
        if not os.path.exists(img):
            img = os.path.join(LocationService.get_user_data(), "eyes", "materials", want)
        if os.path.exists(img):
            tex.image = bpy.data.images.load(img)
        else:
            print("WARN eye texture not found", want)

# ---- skin -------------------------------------------------------------------------------------
sm = body.material_slots[0].material
group = next(n for n in sm.node_tree.nodes if n.type == "GROUP")
tweaks = {"Roughness": 0.5, "Pore strength": 0.38, "Pore scale": 2600.0, "SSS strength": 0.16, "Clearcoat": 0.04,
          "colorMixIn": (0.56, 0.36, 0.24, 1), "colorMixInStrength": 0.26, "Contrast": 0.04}
tweaks.update({k: (tuple(v) if isinstance(v, list) else v) for k, v in spec.get("skin_tweaks", {}).items()})
for k, v in tweaks.items():
    if k in group.inputs:
        group.inputs[k].default_value = v


def tint_texture(mat, hsv):
    nt = mat.node_tree
    tex = first_diffuse(mat)
    if tex is None:
        return
    out = tex.outputs["Color"]
    targets = [l.to_socket for l in out.links]
    node = nt.nodes.new("ShaderNodeHueSaturation")
    node.inputs["Hue"].default_value, node.inputs["Saturation"].default_value, node.inputs["Value"].default_value = hsv
    nt.links.new(out, node.inputs["Color"])
    for t in targets:
        nt.links.new(node.outputs["Color"], t)


hair_name = os.path.basename(os.path.dirname(spec.get("hair", "short02/short02.mhclo"))) or "hair"
hair = part(hair_name)
if hair and spec.get("hair_hsv", [0.5, 0.75, 0.32]):
    tint_texture(hair.material_slots[0].material, spec.get("hair_hsv", [0.5, 0.75, 0.32]))
brows = part("eyebrow")
if brows and spec.get("brow_hsv", [0.5, 0.8, 0.45]):
    tint_texture(brows.material_slots[0].material, spec.get("brow_hsv", [0.5, 0.8, 0.45]))
for g in spec.get("garment_textures", []):
    o = part(g["match"])
    tex = first_diffuse(o.material_slots[0].material) if o and o.material_slots else None
    if tex is None:
        print("WARN no garment matching", g["match"])
        continue
    img = bpy.data.images.load(g["image"])
    img.pack()  # an 8-bit PNG: safe to pack (never pack generated float images: they save as 8-bit and clamp)
    tex.image = img

# ---- stubble: a beard mask from the face's own landmarks (MPFB default rig face bones) ----------
if spec.get("stubble", True):
    saved = [(m, m.show_viewport) for m in body.modifiers]
    for m, _ in saved:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    P = [body.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    for m, s in saved:
        m.show_viewport = s
    vg = {gr.name: gr.index for gr in body.vertex_groups}
    bones = arm.data.bones
    W = lambda n, end="head": arm.matrix_world @ (bones[n].head_local if end == "head" else bones[n].tail_local)
    eye_z = W("eye.L").z
    nose_bottom = W("levator06.L").z
    lip_top = W("oris04.L").z
    lip_bottom = W("oris01").z
    mouth_hw = abs(W("oris03.L", "tail").x) + 0.003
    menton_z = W("special04").z
    chin_y = W("special04", "tail").y
    hinge_y = W("jaw").y
    body_idx = vg["body"]
    in_body = [any(gg.group == body_idx and gg.weight > 0.5 for gg in v.groups) for v in body.data.vertices]

    def ss(a, b, x):
        t = max(0.0, min(1.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)

    lip_cz = (lip_top + lip_bottom) / 2
    lip_hz = (lip_top - lip_bottom) / 2 + 0.002
    mask = [0.0] * len(P)
    for i, v in enumerate(P):
        if not in_body[i]:
            continue
        x, y, z = abs(v.x), v.y, v.z
        # mustache up to the nose, a low cheek line from the mouth corner to the jaw angle, sideburns by the ear
        cheek = (lip_top + 0.004) + 0.012 * ss(mouth_hw + 0.004, 0.058, x)
        upper = (nose_bottom - 0.003) + (cheek - (nose_bottom - 0.003)) * ss(mouth_hw - 0.006, mouth_hw + 0.006, x)
        side = ss(-0.098, -0.082, y)
        upper = upper + side * ((eye_z - 0.004) - upper)
        w = 1.0 - ss(upper - 0.009, upper + 0.003, z)
        w *= 1.0 - ss(hinge_y + 0.004, hinge_y + 0.016, y)
        w *= ss(menton_z - 0.045, menton_z - 0.012, z)
        if z < menton_z:
            w *= 1.0 - ss(chin_y + 0.045, chin_y + 0.07, y)
        lip = (x / mouth_hw) ** 2 + ((z - lip_cz) / lip_hz) ** 2
        w *= ss(0.85, 1.3, lip)
        if x > 0.078:
            w = 0.0
        mask[i] = max(0.0, min(1.0, w))
    attr = body.data.color_attributes.new("beard", "FLOAT_COLOR", "POINT")
    for i, mval in enumerate(mask):
        attr.data[i].color = (mval, mval, mval, 1.0)
    nt = sm.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    skin_sock = out.inputs["Surface"].links[0].from_socket
    attrn = nt.nodes.new("ShaderNodeAttribute")
    attrn.attribute_name = "beard"
    attrn.attribute_type = "GEOMETRY"
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 1150.0
    vor.inputs["Randomness"].default_value = 0.9
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.34
    ramp.inputs["From Max"].default_value = 0.18
    nt.links.new(vor.outputs["Distance"], ramp.inputs["Value"])
    shade = nt.nodes.new("ShaderNodeMath")
    shade.operation = "MULTIPLY"
    shade.inputs[1].default_value = 0.2
    nt.links.new(attrn.outputs["Fac"], shade.inputs[0])
    shadow = nt.nodes.new("ShaderNodeBsdfPrincipled")
    shadow.inputs["Base Color"].default_value = (0.075, 0.062, 0.055, 1)
    shadow.inputs["Roughness"].default_value = 0.6
    mix1 = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(shade.outputs[0], mix1.inputs["Fac"])
    nt.links.new(skin_sock, mix1.inputs[1])
    nt.links.new(shadow.outputs[0], mix1.inputs[2])
    dots = nt.nodes.new("ShaderNodeMath")
    dots.operation = "MULTIPLY"
    nt.links.new(attrn.outputs["Fac"], dots.inputs[0])
    nt.links.new(ramp.outputs["Result"], dots.inputs[1])
    amount = nt.nodes.new("ShaderNodeMath")
    amount.operation = "MULTIPLY"
    amount.inputs[1].default_value = 0.62
    nt.links.new(dots.outputs[0], amount.inputs[0])
    hairc = nt.nodes.new("ShaderNodeBsdfPrincipled")
    hairc.inputs["Base Color"].default_value = (0.012, 0.009, 0.007, 1)
    hairc.inputs["Roughness"].default_value = 0.55
    mix2 = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(amount.outputs[0], mix2.inputs["Fac"])
    nt.links.new(mix1.outputs[0], mix2.inputs[1])
    nt.links.new(hairc.outputs[0], mix2.inputs[2])
    nt.links.new(mix2.outputs[0], out.inputs["Surface"])

# ---- relaxed arms (the rest pose is an A-pose) ---------------------------------------------------
if spec.get("relaxed_arms", True):
    pb = arm.pose.bones
    left_sign = 1 if (arm.matrix_world @ arm.data.bones["eye.L"].head_local).x > 0 else -1

    def aim(bone, d):
        bpy.context.view_layer.update()
        b = pb[bone]
        Mx = b.matrix.copy()
        q = (Mx.to_3x3() @ Vector((0, 1, 0))).rotation_difference(Vector(d).normalized())
        b.matrix = Matrix.Translation(Mx.translation) @ (q.to_matrix() @ Mx.to_3x3()).to_4x4()

    for side, s in (("L", left_sign), ("R", -left_sign)):
        aim(f"upperarm01.{side}", (0.2 * s, 0.03, -1))
        aim(f"upperarm02.{side}", (0.2 * s, 0.03, -1))
        aim(f"lowerarm01.{side}", (0.1 * s, -0.22, -1))
        aim(f"lowerarm02.{side}", (0.1 * s, -0.22, -1))
        aim(f"wrist.{side}", (0.06 * s, -0.12, -1))
        for f in range(2, 6):
            for j, a in ((1, 22), (2, 28), (3, 18)):
                n = f"finger{f}-{j}.{side}"
                if n in pb:
                    pb[n].rotation_mode = "XYZ"
                    pb[n].rotation_euler.x = math.radians(a)
    bpy.context.view_layer.update()

for o in arm.children:
    print("INFO part", o.name)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
print("SAVED", out_blend)
