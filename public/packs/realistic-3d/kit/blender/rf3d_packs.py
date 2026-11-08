# Loads MakeHuman asset packs (zips) into MPFB's data in the kit's isolated profile and lists what is available:
#     blender -b --python rf3d_packs.py -- [pack.zip ...]
# setup.mjs runs it after installing MPFB; with no zips it only lists (skins, hair, clothes, eyebrows...).
import bpy, sys, os, addon_utils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
mod = "bl_ext.user_default.mpfb"
if not addon_utils.check(mod)[1]:
    bpy.ops.preferences.addon_enable(module=mod)
for z in argv:
    print("INFO load", os.path.basename(z), bpy.ops.mpfb.load_pack(filepath=z))
from bl_ext.user_default.mpfb.services import LocationService

data = LocationService.get_user_data()
print("INFO data", data)
for sub in ["skins", "hair", "eyebrows", "eyelashes", "eyes", "clothes", "poses", "expressions"]:
    p = os.path.join(data, sub)
    if os.path.isdir(p):
        names = sorted(n for n in os.listdir(p) if os.path.isdir(os.path.join(p, n)) and n != "materials")
        print(f"LIST {sub}: {' '.join(names)}")
print("READY")
