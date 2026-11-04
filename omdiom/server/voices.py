from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Optional

MANIFEST = "manifest.json"
DUOI_HOP_LE = {".pt"}
MAX_PT_BYTES = 8 * 1024 * 1024
MIN_PT_BYTES = 1024

_DAU_TORCH = (b"PK\x03\x04", b"\x80\x02", b"\x80\x04", b"\x80\x05")


def thu_muc() -> Path:
    """Thư mục thư viện giọng đọc."""
    p = os.getenv("OMDIOM_VOICES", os.getenv("OMNIVOICE_VOICES", "")).strip()
    d = Path(p) if p else Path(__file__).resolve().parent.parent / "voices"
    d.mkdir(parents=True, exist_ok=True)
    return d


def bo_dau(s: str) -> str:
    """Loại bỏ dấu tiếng Việt, giữ nguyên chữ hoa/thường."""
    s = (s or "").replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", s)


def lam_id(ten: str) -> str:
    """Tạo mã định danh an toàn từ tên giọng."""
    s = bo_dau(ten)
    s = re.sub(r"[^A-Za-z0-9_-]+", "_", s).strip("_-")
    s = re.sub(r"_{2,}", "_", s)
    return s[:48] or "giong"


def lam_ten_tep(ten: str) -> str:
    """Chuẩn hóa tên tệp giọng đọc."""
    ten = os.path.basename(ten or "").strip()
    ten = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", ten)
    return ten[:120] or "giong.pt"


def co_phai_pt(data: bytes) -> bool:
    """Kiểm tra định dạng tệp tensor hợp lệ."""
    return any(data.startswith(d) for d in _DAU_TORCH)


def _doc_manifest(d: Path) -> dict:
    f = d / MANIFEST
    if not f.exists():
        return {"voices": []}
    try:
        obj = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(obj, dict) or not isinstance(obj.get("voices"), list):
            raise ValueError("Cấu trúc manifest không hợp lệ")
        return obj
    except Exception:
        return {"voices": []}


def _ghi_manifest(d: Path, obj: dict) -> None:
    f = d / MANIFEST
    tmp = d / (MANIFEST + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, f)


def quet() -> list[dict]:
    """Quét và đồng bộ danh sách giọng hiện có trong thư viện."""
    d = thu_muc()
    manifest = _doc_manifest(d)
    m_by_id = {v["id"]: v for v in manifest.get("voices", []) if isinstance(v, dict) and "id" in v}

    tren_dia: list[Path] = []
    for ext in DUOI_HOP_LE:
        tren_dia.extend(d.glob(f"*{ext}"))
    tren_dia = sorted(tren_dia, key=lambda p: p.name.lower())

    ket_qua = []
    ids_da_thay: set[str] = set()

    for p in tren_dia:
        if p.name.startswith("."):
            continue
        try:
            sz = p.stat().st_size
        except OSError:
            continue
        if sz < MIN_PT_BYTES or sz > MAX_PT_BYTES:
            continue

        vid = lam_id(p.stem)
        if vid in ids_da_thay:
            continue
        ids_da_thay.add(vid)

        entry = m_by_id.get(vid)
        ten_hien_thi = entry.get("name") if entry else p.stem.replace("_", " ")
        gender = entry.get("gender", "") if entry else ""
        note = entry.get("note", "") if entry else ""

        ket_qua.append({
            "id": vid,
            "name": ten_hien_thi,
            "file": p.name,
            "gender": gender,
            "note": note,
            "bytes": sz,
            "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
        })

    m_voices = []
    for r in ket_qua:
        m_voices.append({
            "id": r["id"],
            "name": r["name"],
            "file": r["file"],
            "gender": r["gender"],
            "note": r["note"],
        })
    _ghi_manifest(d, {"voices": m_voices})

    return ket_qua


def tim(voice_id: str) -> Optional[dict]:
    """Tìm thông tin giọng theo voice_id."""
    for v in quet():
        if v["id"] == voice_id:
            return v
    return None


def duong_dan(voice_id: str) -> Path:
    """Trả về đường dẫn tệp của voice_id; lỗi nếu không tìm thấy."""
    v = tim(voice_id)
    if not v:
        raise FileNotFoundError(f"Không có giọng '{voice_id}' trong thư viện")
    p = thu_muc() / v["file"]
    if not p.exists():
        raise FileNotFoundError(f"Tệp giọng '{v['file']}' không tồn tại trên đĩa")
    return p


def luu(
    ten_goc: str,
    data: bytes,
    name: str = "",
    gender: str = "",
    note: str = "",
) -> dict:
    """Lưu dữ liệu tệp giọng mới vào thư viện và cập nhật manifest."""
    sz = len(data)
    if sz < MIN_PT_BYTES:
        raise ValueError(f"Tệp quá nhỏ ({sz} bytes < {MIN_PT_BYTES})")
    if sz > MAX_PT_BYTES:
        raise ValueError(f"Tệp quá lớn ({sz / (1024*1024):.1f} MB > {MAX_PT_BYTES / (1024*1024):.0f} MB)")
    if not co_phai_pt(data):
        raise ValueError("Định dạng tệp không hợp lệ")

    d = thu_muc()
    fname = lam_ten_tep(ten_goc)
    target = d / fname
    target.write_bytes(data)

    vid = lam_id(target.stem)
    ten_hien_thi = name.strip() or target.stem.replace("_", " ")

    m = _doc_manifest(d)
    voices = [v for v in m.get("voices", []) if v.get("id") != vid]
    voices.append({
        "id": vid,
        "name": ten_hien_thi,
        "file": target.name,
        "gender": gender.strip(),
        "note": note.strip(),
    })
    _ghi_manifest(d, {"voices": voices})

    return {
        "id": vid,
        "name": ten_hien_thi,
        "file": target.name,
        "gender": gender.strip(),
        "note": note.strip(),
        "bytes": sz,
        "sha256": hashlib.sha256(data).hexdigest()[:16],
    }


def xoa(voice_id: str) -> str:
    """Xóa một giọng đọc khỏi thư viện."""
    d = thu_muc()
    v = tim(voice_id)
    if not v:
        raise FileNotFoundError(f"Không có giọng '{voice_id}' để xoá")
    p = d / v["file"]
    if p.exists():
        p.unlink()

    m = _doc_manifest(d)
    m["voices"] = [item for item in m.get("voices", []) if item.get("id") != voice_id]
    _ghi_manifest(d, m)
    return v["file"]
