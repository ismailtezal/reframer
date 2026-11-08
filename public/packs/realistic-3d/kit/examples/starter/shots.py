# The smallest realistic-3D film: the hero from rf3d_human.py on open ground under a real sky, three shots.
# Start a new story from this file: build the set in build_set(), write one block per shot.
#     node ../../render.mjs --blend <work>/hero.blend --script shots.py --out <work>/frames --profile preview -- <hdri.hdr>
# Shots (frames in shots.json):
#   hello  a slow dolly in; he looks up from the ground and waves, smiling
#   proud  low angle, hands on hips, a proud look; the camera rises a little
#   clay   the same hero as plasticine stop-motion (render.mjs --step 2, then encode.mjs --hold 2)
import bpy, os, sys, math
sys.path.insert(0, os.environ.get("RF3D_BLENDER", os.path.join(os.path.dirname(__file__), "..", "..", "blender")))
import rf3d_common as C
import rf3d_rig as R
import rf3d_looks as LK
from mathutils import Vector

A = C.shot_args()
SHOT = A["shot"]
HDRI = A["extra"][0]
LEN = {"hello": 90, "proud": 75, "clay": 60}
n = LEN[SHOT]
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, n


def build_set():
    C.hdri_world(HDRI, strength=1.0)
    C.set_sun_azimuth(-125, image_sun_az_deg=-36.2)  # sun behind-left of the camera: a warm key on the face
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Ground"
    m = bpy.data.materials.new("Ground")
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    nz = m.node_tree.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    ramp = m.node_tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.32, 0.27, 0.2, 1)
    ramp.color_ramp.elements[1].color = (0.45, 0.4, 0.31, 1)
    m.node_tree.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    m.node_tree.links.new(ramp.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.9
    ground.data.materials.append(m)


build_set()
hero = R.Rig("Hero")
hero.place(0, 0, facing_deg=0)
hero.blinks(1, n)
cam = C.camera("Cam", 35)
cam.data.dof.use_dof = True
cam.data.dof.focus_object = hero.arm
cam.data.dof.aperture_fstop = 2.8
head = Vector((0, 0, 1.6))

if SHOT == "hello":
    hero.key_pose(1, "idle", head=(0, -0.2, 1))
    hero.key_pose(30, "idle", head=(0, -0.05, 1))
    hero.key_pose(55, "wave", head=(0.05, -0.02, 1))
    hero.key_pose(n, "wave", head=(0.05, -0.02, 1), yaw=-6)
    hero.key_face(1, "neutral")
    hero.key_face(40, "happy")
    C.key_camera(cam, [(1, (0.35, -4.2, 1.55), head), (n, (0.3, -2.6, 1.6), head)])
elif SHOT == "proud":
    hero.key_pose(1, "hands_on_hips", head=(0, -0.08, 1))
    hero.key_pose(n, "hands_on_hips", head=(0.06, -0.12, 1), yaw=8)
    hero.key_face(1, "serious")
    hero.key_face(30, "proud")
    C.key_camera(cam, [(1, (-0.6, -2.4, 0.6), head + Vector((0, 0, -0.1)), 28), (n, (-0.6, -2.3, 0.85), head, 28)])
elif SHOT == "clay":
    hero.key_pose(1, "idle", head=(0, -0.05, 1))
    hero.key_pose(n, "wave", head=(0, 0, 1))
    hero.key_face(1, "neutral")
    hero.key_face(30, "happy")
    C.key_camera(cam, [(1, (0.2, -3.4, 1.5), head), (n, (0.2, -3.0, 1.5), head)])
    skin = LK.clay_material("ClaySkin", (0.88, 0.55, 0.38), rough=0.5, sss=0.15, strength=0.45)
    hair = LK.clay_material("ClayHair", (0.07, 0.045, 0.03), rough=0.7, sss=0.0, strength=0.55)
    meshes = []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.startswith("Hero"):
            continue
        if o.name == "Hero.body":
            LK.assign(o, skin)
        elif any(k in o.name for k in ("short", "eyebrow", "eyelash")):
            LK.assign(o, hair)
        elif "casualsuit" in o.name:
            img = LK.first_image(o)
            clothes = LK.clay_from_texture("ClayClothes", img, steps=7.0, sat=1.1, split=(0.6, (0.1, 0.17, 0.36))) if img else None
            LK.assign(o, clothes or LK.clay_material("ClayShirt", (0.15, 0.32, 0.8)))
        elif any(k in o.name for k in ("teeth", "tongue")):
            o.hide_render = True
            continue
        if "high-poly" not in o.name:
            meshes.append(o)
    LK.clay_lumps(meshes, strength=0.006, frames=(1, n))
    LK.stop_motion_camera(cam, frames=(1, n))
    LK.area_light("ClayFill", (-3.0, -5.0, 3.5), (0, 0, 1.2), 300, 4.0)  # a soft fill; the sun stays the key

C.setup_render(1080 * A["scale"] // 100, 1920 * A["scale"] // 100, A["samples"], deform_motion=("Hero",))
C.render_frames(A["outdir"], C.frames_to_render(A["start"], A["end"], A["step"], n), SHOT)
print("DONE", SHOT)
