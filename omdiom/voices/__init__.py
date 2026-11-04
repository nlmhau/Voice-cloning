# -*- coding: utf-8 -*-
from pathlib import Path
import json

def thu_muc() -> Path:
    return Path(__file__).resolve().parent

def quet():
    mf = thu_muc() / "manifest.json"
    if mf.exists():
        try:
            with open(mf, "r", encoding="utf-8") as f:
                return json.load(f).get("voices", [])
        except Exception:
            pass
    return []

def tim(voice_id: str):
    v_id = str(voice_id).strip().lower()
    for v in quet():
        if v.get("id", "").lower() == v_id:
            return v
    for p in thu_muc().glob("*.pt"):
        if p.stem.lower() == v_id or v_id in p.stem.lower():
            return {"id": p.stem, "file": p.name}
    return None

def duong(voice_id: str) -> Path:
    v = tim(voice_id)
    if v and v.get("file"):
        p = thu_muc() / v["file"]
        if p.exists():
            return p
    # fallback direct match
    p_direct = thu_muc() / f"{voice_id}.pt"
    if p_direct.exists():
        return p_direct
    raise FileNotFoundError(f"Không tìm thấy tệp giọng '{voice_id}' trong {thu_muc()}")

def duong_dan(voice_id: str) -> Path:
    return duong(voice_id)

def thong_ke():
    ds = quet()
    return {"count": len(ds), "dir": str(thu_muc())}

