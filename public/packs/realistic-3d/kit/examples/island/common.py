# Shared helpers for the island shots: render settings, sky/sun direction, character placement, camera keys.
import bpy, math, time
from mathutils import Vector, Matrix, Euler

IMG_SUN_AZ = -36.2  # measured azimuth of the sun in kloofendal_43d_clear_puresky (elevation 42.9 deg)


def ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def setup_render(width=720, height=1280, samples=64, engine="CYCLES", motion_blur=True):
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = width, height, 100
    sc.render.fps = 30
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.render.film_transparent = False
    sc.render.use_motion_blur = motion_blur
    sc.render.motion_blur_shutter = 0.5
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    if engine == "CYCLES":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type != "CPU"
        sc.cycles.device = "GPU"
        sc.cycles.samples = samples
        hq = samples >= 64
        sc.cycles.use_adaptive_sampling = True
        sc.cycles.adaptive_threshold = 0.012 if hq else 0.03
        sc.cycles.use_denoising = True
        try:
            sc.cycles.denoiser = "OPENIMAGEDENOISE" if hq else "OPTIX"
            sc.cycles.denoising_use_gpu = False
            sc.cycles.denoising_prefilter = "ACCURATE"
            sc.cycles.denoising_quality = "HIGH"
        except Exception as e:
            print("DENOISER fallback", e)
            sc.cycles.denoiser = "OPTIX"
        sc.cycles.max_bounces = 8 if hq else 6
        sc.cycles.diffuse_bounces = 4 if hq else 3
        sc.cycles.glossy_bounces = 4 if hq else 3
        sc.cycles.transmission_bounces = 8 if hq else 6
        sc.cycles.volume_bounces = 0
        sc.cycles.transparent_max_bounces = 16 if hq else 12
        for o in bpy.data.objects:
            if o.type == "MESH" and o.name == "Ocean":
                o.cycles.use_deform_motion = False
            elif o.type == "MESH" and o.name.startswith("Hero"):
                o.cycles.use_deform_motion = bool(hq and motion_blur)
        sc.cycles.caustics_reflective = False
        sc.cycles.caustics_refractive = False
        sc.cycles.blur_glossy = 1.0
        sc.cycles.sample_clamp_indirect = 10.0
        sc.render.use_persistent_data = True
        if hq:
            camera_look(sc)
    else:
        sc.eevee.use_raytracing = True
        sc.eevee.taa_render_samples = samples


def _set_in(node, name, value):
    s = node.inputs.get(name)
    if s is None:
        return False
    try:
        s.default_value = value
        return True
    except Exception as e:
        print("LOOK set failed", node.bl_idname, name, value, e)
        return False


def camera_look(sc):
    """What a real camera adds (the reference's fix for 'too perfect' renders): soft bloom on highlights,
    a touch of lens dispersion, and a gentle vignette. Grain is added in the edit (it must move)."""
    tree = bpy.data.node_groups.new("CameraLook", "CompositorNodeTree")
    tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    sc.compositing_node_group = tree
    try:
        sc.render.compositor_device = "GPU"
    except Exception:
        pass
    N, L = tree.nodes, tree.links
    rl = N.new("CompositorNodeRLayers")
    rl.scene = sc
    gl = N.new("CompositorNodeGlare")
    for v in ("Bloom", "BLOOM", "bloom"):
        if _set_in(gl, "Type", v):
            break
    for v in ("High", "HIGH", "high"):
        if _set_in(gl, "Quality", v):
            break
    _set_in(gl, "Threshold", 0.9)
    _set_in(gl, "Smoothness", 0.3)
    _set_in(gl, "Strength", 0.2)
    _set_in(gl, "Size", 0.6)
    L.new(rl.outputs["Image"], gl.inputs["Image"])
    ld = N.new("CompositorNodeLensdist")
    _set_in(ld, "Distortion", 0.0)
    _set_in(ld, "Dispersion", 0.01)
    L.new(gl.outputs["Image"], ld.inputs["Image"])
    em = N.new("CompositorNodeEllipseMask")
    _set_in(em, "Position", (0.5, 0.5))
    _set_in(em, "Size", (1.05, 0.95))
    _set_in(em, "Value", 1.0)
    _set_in(em, "Mask", 0.0)
    bl = N.new("CompositorNodeBlur")
    _set_in(bl, "Size", (260.0, 260.0))
    L.new(em.outputs["Mask"], bl.inputs["Image"])
    sep = N.new("ShaderNodeMath")
    sep.operation = "MULTIPLY_ADD"
    L.new(bl.outputs["Image"], sep.inputs[0])
    sep.inputs[1].default_value = 0.22
    sep.inputs[2].default_value = 0.78
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    cin = [s for s in mix.inputs if s.type == "RGBA"]
    L.new(ld.outputs["Image"], cin[0])
    L.new(sep.outputs[0], cin[1])
    out = N.new("NodeGroupOutput")
    L.new([s for s in mix.outputs if s.type == "RGBA"][0], out.inputs[0])
    print("LOOK compositor ready", [n.bl_idname for n in N])


def set_sun_azimuth(world_az_deg):
    """Rotate the HDRI so its sun sits at this world azimuth (deg, atan2(y, x) of the direction toward the sun)."""
    nt = bpy.context.scene.world.node_tree
    nt.nodes["SkyRot"].inputs["Rotation"].default_value = (0, 0, math.radians(IMG_SUN_AZ - world_az_deg))


def place_character(x, y, facing_deg=0.0, ground=None):
    """The hero's rig faces -Y at facing 0. facing_deg rotates him about Z (counter-clockwise)."""
    arm = bpy.data.objects["Hero"]
    z = ground(x, y) if ground else 0.0
    arm.location = (x, y, z)
    arm.rotation_euler = (0, 0, math.radians(facing_deg))
    return arm


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(name="Cam", lens=35.0, sensor=36.0):
    sc = bpy.context.scene
    cam = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_width = sensor  # AUTO fit: 36 mm across the long (vertical) side, like a full-frame camera held upright
    cam.sensor_fit = "AUTO"
    cam.clip_start = 0.02
    cam.clip_end = 600
    co = bpy.data.objects.get(name) or bpy.data.objects.new(name, cam)
    if co.name not in sc.collection.objects:
        sc.collection.objects.link(co)
    sc.camera = co
    return co


def key_camera(co, frames_pos_target, ease="QUAD"):
    """frames_pos_target: [(frame, (x,y,z), (tx,ty,tz)), ...] -> location + rotation keys, eased."""
    for f, pos, tgt in frames_pos_target:
        co.location = pos
        look_at(co, tgt)
        co.keyframe_insert("location", frame=f)
        co.keyframe_insert("rotation_euler", frame=f)
    ease_keys(co)


def action_fcurves(obj):
    ad = obj.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        return list(act.fcurves)
    except Exception:
        pass
    out = []
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for cb in getattr(strip, "channelbags", []):
                out.extend(cb.fcurves)
    return out


def ease_keys(obj, interp="SINE", easing="EASE_IN_OUT"):
    for fc in action_fcurves(obj):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            kp.easing = easing


def render_frames(outdir, f0, f1, step=1, tag=""):
    sc = bpy.context.scene
    times = []
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f)
        sc.render.filepath = f"{outdir}/{f:04d}.png"
        t = time.time()
        bpy.ops.render.render(write_still=True)
        times.append(time.time() - t)
        print(f"FRAME {tag} {f} {times[-1]:.1f}s", flush=True)
    return times


# ---- island terrain (must match island.py exactly) ----
from mathutils import noise as _noise


def shore_R(a):
    return 5.4 * (1 + 0.10 * math.sin(3 * a + 0.7) + 0.06 * math.sin(5 * a + 2.1) + 0.035 * math.sin(9 * a + 0.3))


def height(x, y):
    r = math.hypot(x, y)
    a = math.atan2(y, x)
    t = r / shore_R(a)
    n = _noise.noise(Vector((x * 0.33, y * 0.33, 0.5)))
    if t < 1:
        z = 0.62 * (1 - t * t) ** 1.6 + 0.04 * n * (1 - t) ** 0.5
    else:
        z = -1.3 * (t - 1) ** 1.45 + 0.08 * n * ss(1.0, 1.6, t)
    return max(z, -5.5)
