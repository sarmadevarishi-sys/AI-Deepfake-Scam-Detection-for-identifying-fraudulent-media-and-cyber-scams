import io, numpy as np
from PIL import Image

_pipe1 = None
_pipe2 = None
M1 = "prithivMLmods/Deep-Fake-Detector-Model"
M2 = "Organika/sdxl-detector"

def _load(mid, name):
    try:
        from transformers import pipeline
        print(f"[IM] loading {name}")
        p = pipeline("image-classification", model=mid, device=-1)
        print(f"[IM] {name} ready")
        return p
    except Exception as e:
        print(f"[IM] failed {name}: {e}")
        return None

def _g1():
    global _pipe1
    if _pipe1 is None: _pipe1 = _load(M1, "DeepFake-Detector")
    return _pipe1

def _g2():
    global _pipe2
    if _pipe2 is None: _pipe2 = _load(M2, "SDXL-Detector")
    return _pipe2

def _score(res):
    for r in res:
        if any(k in r["label"].lower() for k in ["fake","ai","artificial","generated","synthetic"]):
            return round(r["score"]*100)
    for r in res:
        if any(k in r["label"].lower() for k in ["real","authentic","genuine","human"]):
            return round((1-r["score"])*100)
    return round(res[0]["score"]*100)

def _exif(img):
    try:
        ex = img._getexif()
    except Exception:
        ex = None
    if ex is None:
        return 72, {"exifPresent": False, "note": "No EXIF - AI images rarely have it"}
    risk = 40
    info = {"exifPresent": True}
    if ex.get(271): risk -= 10; info["make"]  = ex[271]
    if ex.get(272): risk -= 10; info["model"] = ex[272]
    if ex.get(306): risk -= 10; info["date"]  = str(ex[306])
    if ex.get(34853): risk -= 10; info["gps"] = True
    return max(0, risk), info

def analyze_image(fb: bytes) -> dict:
    img   = Image.open(io.BytesIO(fb)).convert("RGB")
    W, H  = img.size
    rows  = []
    raw   = {}

    p = _g1()
    if p:
        try:
            r = p(img); s = _score(r)
            rows.append((s, 0.45, M1)); raw["m1"] = s
        except Exception as e:
            print(f"[IM] m1 err {e}")

    p = _g2()
    if p:
        try:
            r = p(img); s = _score(r)
            rows.append((s, 0.40, M2)); raw["m2"] = s
        except Exception as e:
            print(f"[IM] m2 err {e}")

    es, ed = _exif(img)
    rows.append((es, 0.15, "EXIF")); raw["exif"] = ed

    tw = sum(w for _,w,_ in rows)
    final = min(100, max(0, round(sum(s*w for s,w,_ in rows)/tw)))

    return {
        "riskScore":  final,
        "label":      "HIGH" if final > 60 else ("MEDIUM" if final > 30 else "LOW"),
        "method":     "Ensemble: " + " + ".join(n for _,_,n in rows),
        "modelsUsed": [n for _,_,n in rows],
        "modelLoaded": len(rows) > 1,
        "resolution": f"{W}x{H}",
        "breakdown":  raw
    }
