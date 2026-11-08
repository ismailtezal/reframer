# Shared Blender helpers for realistic 3D shots: render settings by quality, the "real camera" look
# (bloom, dispersion, vignette), an HDRI sky you can turn to put the sun where a shot needs it, cameras with eased
# moves, and a frame renderer that prints progress the kit's render.mjs reads.
#
# Shot scripts import it after adding this folder to sys.path:
#     sys.path.insert(0, os.environ["RF3D_BLENDER"])  # render.mjs sets it; or the kit's blender/ folder
#     import rf3d_common as C
import bpy, math, os, sys, time
from mathutils import Vector


def ss(a, b, x):
    """Smoothstep from a to b."""
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- shot arguments
def shot_args():
    """The arguments render.mjs passes after `--`: shot, outdir, start, end, step, scale %, samples, then extras.
    end 0 = the shot's last frame; step 0 = a preview (first, middle and last frame)."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    num = lambda i, d: int(argv[i]) if len(argv) > i and argv[i] != "" else d
    return {
        "shot": argv[0] if argv else "",
        "outdir": argv[1] if len(argv) > 1 else os.getcwd(),
        "start": num(2, 1),
        "end": num(3, 0),
        "step": num(4, 1),
        "scale": num(5, 100),
        "samples": num(6, 64),
        "extra": argv[7:],
    }


def frames_to_render(start, end, step, length):
    end = end or length
    if step == 0:  # preview: first, middle, last
        return sorted({start, (start + end) // 2, end})
    return list(range(start, end + 1, max(1, step)))


# ---------------------------------------------------------------- render settings
def setup_render(width=1080, height=1920, samples=64, motion_blur=None, fps=30, deform_motion=(), engine="CYCLES"):
    """Cycles on the GPU (OptiX when available). samples >= 64 is the delivery quality: OIDN denoise, more bounces,
    the camera look. motion_blur None follows the env MBLUR=1 (render.mjs sets it for final).
    deform_motion: name prefixes of meshes whose deformation should blur (characters); others blur by transform only."""
    sc = bpy.context.scene
    hq = samples >= 64
    if motion_blur is None:
        motion_blur = os.environ.get("MBLUR") == "1"
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = width, height, 100
    sc.render.fps = fps
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.view_settings.look = "None"
    sc.render.film_transparent = False
    sc.render.use_motion_blur = motion_blur
    sc.render.motion_blur_shutter = 0.5
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    if engine != "CYCLES":
        sc.eevee.use_raytracing = True
        sc.eevee.taa_render_samples = samples
        return
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for device_type in ("OPTIX", "CUDA", "METAL", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
            if any(d.type == device_type for d in prefs.devices):
                break
        except Exception:
            continue
    for d in prefs.devices:
        d.use = d.type != "CPU"
    sc.cycles.device = "GPU" if any(d.use for d in prefs.devices) else "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.012 if hq else 0.03
    denoise = os.environ.get("DENOISE", "oidn" if hq else "optix")
    sc.cycles.use_denoising = denoise != "off"
    try:
        if denoise.startswith("oidn"):
            sc.cycles.denoiser = "OPENIMAGEDENOISE"
            sc.cycles.denoising_use_gpu = denoise == "oidn-gpu"
            sc.cycles.denoising_prefilter = "ACCURATE"
            sc.cycles.denoising_quality = "HIGH"
        elif denoise != "off":
            sc.cycles.denoiser = "OPTIX"
    except Exception as e:
        print("WARN denoiser fallback", e)
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8 if hq else 6
    sc.cycles.diffuse_bounces = 4 if hq else 3
    sc.cycles.glossy_bounces = 4 if hq else 3
    sc.cycles.transmission_bounces = 8 if hq else 6
    sc.cycles.volume_bounces = 0
    sc.cycles.transparent_max_bounces = 16 if hq else 12
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.cycles.sample_clamp_indirect = 10.0
    sc.render.use_persistent_data = True
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.cycles.use_deform_motion = bool(motion_blur and hq and any(o.name.startswith(p) for p in deform_motion))
    if hq and os.environ.get("NOCOMP") != "1":
        camera_look(sc)


def _set_in(node, name, value):
    s = node.inputs.get(name)
    if s is None:
        return False
    try:
        s.default_value = value
        return True
    except Exception as e:
        print("WARN look input", node.bl_idname, name, value, e)
        return False


def camera_look(sc, bloom=0.2, dispersion=0.01, vignette=0.22):
    """What a real camera adds (the fix for 'too perfect' renders): soft bloom on highlights, a touch of lens
    dispersion, a gentle vignette. Grain goes on in the edit (it must move). Blender 5.x compositor API: a
    CompositorNodeTree on scene.compositing_node_group; Glare/Lensdist/EllipseMask settings are input sockets."""
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
    _set_in(gl, "Strength", bloom)
    _set_in(gl, "Size", 0.6)
    L.new(rl.outputs["Image"], gl.inputs["Image"])
    ld = N.new("CompositorNodeLensdist")
    _set_in(ld, "Distortion", 0.0)
    _set_in(ld, "Dispersion", dispersion)
    L.new(gl.outputs["Image"], ld.inputs["Image"])
    em = N.new("CompositorNodeEllipseMask")
    _set_in(em, "Position", (0.5, 0.5))
    _set_in(em, "Size", (1.05, 0.95))
    _set_in(em, "Value", 1.0)
    _set_in(em, "Mask", 0.0)
    bl = N.new("CompositorNodeBlur")
    _set_in(bl, "Size", (260.0, 260.0))
    L.new(em.outputs["Mask"], bl.inputs["Image"])
    fall = N.new("ShaderNodeMath")
    fall.operation = "MULTIPLY_ADD"
    L.new(bl.outputs["Image"], fall.inputs[0])
    fall.inputs[1].default_value = vignette
    fall.inputs[2].default_value = 1.0 - vignette
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    cin = [s for s in mix.inputs if s.type == "RGBA"]
    L.new(ld.outputs["Image"], cin[0])
    L.new(fall.outputs[0], cin[1])
    out = N.new("NodeGroupOutput")
    L.new([s for s in mix.outputs if s.type == "RGBA"][0], out.inputs[0])


# ---------------------------------------------------------------- sky
def hdri_world(hdr_path, strength=1.0):
    """World lit by an HDRI (Poly Haven, CC0). Nodes named SkyRot (mapping) and SkyBG (background) so shots and
    looks can turn and dim it."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("Sky")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "SkyRot"
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(hdr_path, check_existing=True)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.name = "SkyBG"
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bg.inputs["Strength"].default_value = strength
    return w


def set_sun_azimuth(world_az_deg, image_sun_az_deg):
    """Turn the HDRI so its sun sits at this world azimuth (degrees, atan2(y, x) of the direction toward the sun).
    image_sun_az_deg is where the sun sits in the unrotated image (measure it once per HDRI: render a chrome ball
    or find the brightest pixel; kloofendal_43d_clear_puresky is -36.2, elevation 42.9)."""
    nt = bpy.context.scene.world.node_tree
    nt.nodes["SkyRot"].inputs["Rotation"].default_value = (0, 0, math.radians(image_sun_az_deg - world_az_deg))


# ---------------------------------------------------------------- cameras
def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(name="Cam", lens=35.0, sensor=36.0):
    """A full-frame camera (36 mm across the long side, also when the frame is vertical)."""
    sc = bpy.context.scene
    cam = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_width = sensor
    cam.sensor_fit = "AUTO"
    cam.clip_start = 0.02
    cam.clip_end = 600
    co = bpy.data.objects.get(name) or bpy.data.objects.new(name, cam)
    if co.name not in sc.collection.objects:
        sc.collection.objects.link(co)
    sc.camera = co
    return co


def action_fcurves(obj):
    """F-curves of an object's action (Blender 4.4+ layered actions included)."""
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


def key_camera(cam, keys):
    """keys: [(frame, (x, y, z), (tx, ty, tz), lens or None), ...]: one straight eased move, the style's camera.
    Keep a shot to two keys on one axis (a dolly in or out, a slow rise); no orbit drift."""
    for k in keys:
        f, pos, tgt = k[0], k[1], k[2]
        lens = k[3] if len(k) > 3 else None
        cam.location = pos
        look_at(cam, tgt)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        if lens:
            cam.data.lens = lens
            cam.data.keyframe_insert("lens", frame=f)
    ease_keys(cam)
    if cam.data.animation_data:
        ease_keys(cam.data)


# ---------------------------------------------------------------- rendering
def render_frames(outdir, frames, tag=""):
    """Renders frames to outdir/NNNN.png, printing `FRAME <tag> <frame> <seconds>s` for render.mjs."""
    sc = bpy.context.scene
    os.makedirs(outdir, exist_ok=True)
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(outdir, f"{f:04d}.png")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"FRAME {tag} {f} {time.time() - t:.1f}s", flush=True)
