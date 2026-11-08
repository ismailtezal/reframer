# Posing an MPFB human (default rig) in shot scripts: aim bones along directions instead of typing rotations,
# a few body poses, facial expressions on the ARKit shape keys, natural blinks, and props held in a hand.
#
#     import rf3d_rig as R
#     hero = R.Rig("Hero")                     # the armature rf3d_human.py built
#     hero.place(0.6, -0.4, facing_deg=0, ground=height_fn)
#     hero.key_pose(1, "idle", head=(0, -0.05, 1))
#     hero.key_pose(40, "phone_up", head=(0, 0.42, 1))
#     hero.key_face(1, "worried"); hero.key_face(60, "shock")
#     hero.blinks(1, 150)
#     phone = ...; hero.pose("phone_up"); hero.attach(phone, "wrist.R")
#
# Directions are in the armature's space: the rig faces -Y at facing 0, +Z is up, +X is the character's left.
# A pose is a dict of bone -> direction, mirrored for the right side; add your own to POSES.
import bpy, math, random
from mathutils import Vector, Matrix, Quaternion

IDLE = ((0.24, 0.04, -1), (0.13, -0.3, -1), (0.08, -0.16, -1))
# side: (upper arm, lower arm, wrist) directions for the left side (x is mirrored for the right), plus finger curls
POSES = {
    "idle": {"L": IDLE, "R": IDLE},
    "phone_up": {"L": IDLE, "R": ((0.3, -0.7, 0.45), (-0.1, -0.72, 0.8), (-0.08, -0.2, 1.0)), "fingersR": ((22, 26, 18), 30)},
    "stick": {"L": IDLE, "R": ((0.25, -0.45, -1), (0.12, -1.0, -0.45), (0.1, -1.0, -0.55)), "fingersR": ((70, 80, 55), 45)},
    "laptop": {
        "L": ((0.12, -0.32, -1), (-0.45, -1.0, 0.08), (-0.5, -1.0, 0.0)),
        "R": ((0.12, -0.32, -1), (-0.35, -1.0, 0.0), (-0.3, -1.0, -0.25)),
        "fingersL": ((8, 10, 6), 5),
        "fingersR": ((25, 30, 20), 15),
    },
    "stop": {"L": IDLE, "R": ((0.5, -0.85, 0.08), (0.12, -0.55, 1.0), (0.05, 0.45, 1.0)), "fingersR": ((2, 2, 2), 5)},
    "wave": {"L": IDLE, "R": ((0.85, -0.2, 0.5), (0.25, -0.1, 1.0), (0.1, 0.0, 1.0)), "fingersR": ((4, 4, 4), 5)},
    "hands_on_hips": {"L": ((0.7, 0.1, -0.7), (-0.6, 0.35, -0.6), (-0.6, 0.2, -0.3)), "R": ((0.7, 0.1, -0.7), (-0.6, 0.35, -0.6), (-0.6, 0.2, -0.3))},
}

FACE_KEYS = ["browInnerUp", "browDownLeft", "browDownRight", "browOuterUpLeft", "browOuterUpRight", "eyeWideLeft", "eyeWideRight",
             "eyeSquintLeft", "eyeSquintRight", "jawOpen", "mouthFrownLeft", "mouthFrownRight", "mouthSmileLeft", "mouthSmileRight",
             "mouthPressLeft", "mouthPressRight", "mouthPucker", "mouthFunnel", "cheekSquintLeft", "cheekSquintRight", "mouthRollLower",
             "noseSneerLeft", "noseSneerRight", "mouthShrugUpper", "mouthShrugLower"]
# Expressions on the ARKit face units (0..1). Keep them subtle: past ~0.8 the MakeHuman face breaks.
FACES = {
    "neutral": {},
    "worried": {"browInnerUp": 0.75, "browOuterUpLeft": 0.1, "browOuterUpRight": 0.1, "mouthFrownLeft": 0.35, "mouthFrownRight": 0.35, "mouthPressLeft": 0.3, "mouthPressRight": 0.3},
    "shock": {"browInnerUp": 0.8, "browOuterUpLeft": 0.55, "browOuterUpRight": 0.55, "eyeWideLeft": 0.6, "eyeWideRight": 0.6, "jawOpen": 0.28, "mouthFunnel": 0.15},
    "focus": {"browDownLeft": 0.35, "browDownRight": 0.35, "eyeSquintLeft": 0.25, "eyeSquintRight": 0.25, "mouthPressLeft": 0.35, "mouthPressRight": 0.35},
    "smug": {"mouthSmileLeft": 0.55, "mouthSmileRight": 0.25, "cheekSquintLeft": 0.25, "browOuterUpLeft": 0.25, "eyeSquintLeft": 0.15},
    "proud": {"mouthSmileLeft": 0.5, "mouthSmileRight": 0.5, "cheekSquintLeft": 0.3, "cheekSquintRight": 0.3, "browInnerUp": 0.15},
    "serious": {"browDownLeft": 0.2, "browDownRight": 0.2, "mouthPressLeft": 0.2, "mouthPressRight": 0.2},
    "happy": {"mouthSmileLeft": 0.65, "mouthSmileRight": 0.65, "cheekSquintLeft": 0.4, "cheekSquintRight": 0.4, "jawOpen": 0.1},
    "sad": {"browInnerUp": 0.6, "mouthFrownLeft": 0.55, "mouthFrownRight": 0.55, "mouthShrugLower": 0.3},
}


class Rig:
    def __init__(self, name):
        self.arm = bpy.data.objects[name]
        self.body = bpy.data.objects[f"{name}.body"]
        self.pb = self.arm.pose.bones
        self.keys = self.body.data.shape_keys.key_blocks if self.body.data.shape_keys else None
        self.bones = [b.name for b in self.pb if any(k in b.name for k in ("upperarm", "lowerarm", "wrist", "finger", "shoulder", "clavicle", "neck", "head", "spine"))]

    # ---- placement
    def place(self, x, y, facing_deg=0.0, ground=None):
        """Stand on the ground (ground(x, y) -> z, or 0) facing -Y rotated counter-clockwise by facing_deg."""
        self.arm.location = (x, y, ground(x, y) if ground else 0.0)
        self.arm.rotation_euler = (0, 0, math.radians(facing_deg))
        return self.arm

    # ---- bones
    def reset(self):
        for n in self.bones:
            b = self.pb[n]
            b.rotation_mode = "QUATERNION"
            b.rotation_quaternion = (1, 0, 0, 0)

    def aim(self, name, d):
        """Point a bone along direction d (armature space), keeping its position."""
        bpy.context.view_layer.update()
        b = self.pb[name]
        M = b.matrix.copy()
        q = (M.to_3x3() @ Vector((0, 1, 0))).rotation_difference(Vector(d).normalized())
        b.matrix = Matrix.Translation(M.translation) @ (q.to_matrix() @ M.to_3x3()).to_4x4()
        bpy.context.view_layer.update()

    def twist(self, name, deg):
        b = self.pb[name]
        b.rotation_quaternion = b.rotation_quaternion @ Quaternion((0, 1, 0), math.radians(deg))
        bpy.context.view_layer.update()

    def fingers(self, side, curl=(18, 24, 16), thumb=10):
        for f in range(2, 6):
            for j, a in zip((1, 2, 3), curl):
                n = f"finger{f}-{j}.{side}"
                if n in self.pb:
                    self.pb[n].rotation_quaternion = Quaternion((1, 0, 0), math.radians(a))
        for j in (1, 2, 3):
            n = f"finger1-{j}.{side}"
            if n in self.pb:
                self.pb[n].rotation_quaternion = Quaternion((1, 0, 0), math.radians(thumb))

    def arm_dirs(self, side, up, low, wrist):
        s = 1 if side == "L" else -1
        m = lambda v: (v[0] * s, v[1], v[2])
        for bone, d in ((f"upperarm01.{side}", up), (f"upperarm02.{side}", up), (f"lowerarm01.{side}", low),
                        (f"lowerarm02.{side}", low), (f"wrist.{side}", wrist)):
            self.aim(bone, m(d))

    def pose(self, name, head=(0, 0, 1), yaw=0.0):
        """A body pose from POSES plus where the head looks (direction) and how far it turns (degrees)."""
        p = POSES[name]
        self.reset()
        self.aim("neck03", (head[0] * 0.4, head[1] * 0.4, 1))
        self.aim("head", head)
        if yaw:
            self.twist("head", yaw)
        for side in ("L", "R"):
            self.arm_dirs(side, *p[side])
            curl, thumb = p.get(f"fingers{side}", ((18, 24, 16), 10))
            self.fingers(side, curl, thumb)

    def key_pose(self, frame, name, **kw):
        self.pose(name, **kw)
        for n in self.bones:
            self.pb[n].keyframe_insert("rotation_quaternion", frame=frame)

    # ---- face
    def key_face(self, frame, name):
        vals = FACES[name] if isinstance(name, str) else name
        for k in FACE_KEYS:
            if k in self.keys:
                self.keys[k].value = vals.get(k, 0.0)
                self.keys[k].keyframe_insert("value", frame=frame)

    def blinks(self, f0, f1, every=95, seed=3):
        """Blinks every ~3 s with a little randomness (a face that never blinks reads as a doll)."""
        rnd = random.Random(seed)
        f = f0 + 20
        while f < f1 - 6:
            for k in ("eyeBlinkLeft", "eyeBlinkRight"):
                for df, v in ((0, 0.0), (2, 1.0), (4, 1.0), (7, 0.0)):
                    self.keys[k].value = v
                    self.keys[k].keyframe_insert("value", frame=f + df)
            f += every + rnd.randint(-25, 25)

    # ---- props
    def hand_frame(self, side="R"):
        """Palm position and axes in world space after the pose: (wrist, knuckle, forward, across, normal)."""
        bpy.context.view_layer.update()
        mw = self.arm.matrix_world
        wrist = mw @ self.pb[f"wrist.{side}"].head
        knuck = mw @ self.pb[f"finger3-1.{side}"].head
        across = (mw @ self.pb[f"finger2-1.{side}"].head) - (mw @ self.pb[f"finger5-1.{side}"].head)
        fwd = (knuck - wrist).normalized()
        nrm = fwd.cross(across).normalized()
        return wrist, knuck, fwd, across.normalized(), nrm

    def attach(self, obj, bone):
        """Parent a prop to a bone where it is now (Child Of with an explicit inverse: the prop keeps its place)."""
        bpy.context.view_layer.update()
        c = obj.constraints.new("CHILD_OF")
        c.target = self.arm
        c.subtarget = bone
        c.inverse_matrix = (self.arm.matrix_world @ self.pb[bone].matrix).inverted()
        return c
