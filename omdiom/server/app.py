from __future__ import annotations

import logging
import os
import time

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from engine import DEFAULTS, TTSEngine

try:
    import voices as thu_vien_giong
except Exception as _e:
    thu_vien_giong = None
    log_loi_voices = str(_e)
else:
    log_loi_voices = ""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("server")

MAX_UPLOAD_MB = 25

# Khởi tạo TTS Engine & API Key
_mock_env = os.getenv("OMDIOM_MOCK", os.getenv("OMNIVOICE_MOCK", "0"))
engine = TTSEngine(mock=(_mock_env == "1"))
API_KEY = os.getenv("OMDIOM_API_KEY", os.getenv("OMNIVOICE_API_KEY", "")).strip()

app = FastAPI(
    title="OmDiOm Studio — Backend API",
    description="API tổng hợp và nhân bản giọng nói tiếng Việt chuyên nghiệp",
    version="1.0.0",
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Gen-Time", "X-Audio-Duration", "X-RTF", "X-Mode"],
)


def require_key(x_api_key: str | None = Header(default=None)) -> None:
    """Xác thực API Key nếu được cấu hình."""
    if not API_KEY:
        return
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Sai hoặc thiếu X-API-Key")


@app.on_event("startup")
async def _startup() -> None:
    log.info("Backend khởi động | mock=%s | api_key=%s", engine.mock, "có" if API_KEY else "không")
    preload = os.getenv("OMDIOM_PRELOAD", os.getenv("OMNIVOICE_PRELOAD", "1"))
    if preload == "1" and not engine.mock:
        log.info("Preload model OmDiOm...")
        engine.load()


# Giao diện Web tĩnh
_ui_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "UI"))
_css_dir = os.path.join(_ui_dir, "css")
_js_dir = os.path.join(_ui_dir, "js")
_assets_dir = os.path.join(_ui_dir, "assets")
if os.path.isdir(_css_dir):
    app.mount("/css", StaticFiles(directory=_css_dir), name="css")
if os.path.isdir(_js_dir):
    app.mount("/js", StaticFiles(directory=_js_dir), name="js")
if os.path.isdir(_assets_dir):
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    f_path = os.path.join(_ui_dir, "assets", "logo", "rosette.ico")
    if os.path.exists(f_path):
        return FileResponse(f_path, media_type="image/x-icon")
    return Response(status_code=404)


@app.get("/")
@app.get("/ui")
def index_ui():
    ui_path = os.path.join(_ui_dir, "index.html")
    if os.path.exists(ui_path):
        return FileResponse(ui_path)
    return {"error": "UI index.html not found"}


@app.get("/api/system/models")
def get_available_models():
    """Lấy danh sách các model khả dụng để chuyển đổi."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
    omdiom_exists = os.path.exists(os.path.join(base_dir, "omdiom", "model.safetensors"))
    omni_exists = os.path.exists(os.path.join(base_dir, "OmniVoice", "model.safetensors"))
    cur_id = "omdiom" if "omdiom" in engine.model_id.lower() else "omnivoice"
    return {
        "status": "ok",
        "current": cur_id,
        "current_name": getattr(engine, "model_name", "OmDiOm"),
        "models": [
            {
                "id": "omdiom",
                "name": "OmDiOm (Việt hóa)",
                "desc": "Mô hình OmDiOm huấn luyện chuyên sâu cho tiếng Việt",
                "available": omdiom_exists,
                "active": (cur_id == "omdiom"),
            },
            {
                "id": "omnivoice",
                "name": "OmniVoice (Gốc)",
                "desc": "Mô hình k2-fsa/OmniVoice",
                "available": omni_exists,
                "active": (cur_id == "omnivoice"),
            },
        ],
    }


@app.post("/api/system/switch-model")
def switch_model_endpoint(target: str = Form(...)):
    """Chuyển đổi model tức thì trong bộ nhớ."""
    return engine.switch_model(target)


@app.get("/health")
def health() -> dict:
    dev_info = engine.get_device_info()
    return {
        "status": "ok",
        "model": getattr(engine, "model_name", "OmDiOm"),
        "model_id": engine.model_id,
        "device": dev_info.get("device_display", engine.device),
        "device_info": dev_info,
        "mock": engine.mock,
        "loaded": engine._loaded,
        "load_time": engine.load_time,
        "sample_rate": engine.sample_rate,
        "language": "vi",
    }


@app.get("/info")
def info() -> dict:
    return engine.info()


@app.get("/api/system")
def thong_tin_he_thong() -> dict:
    """Lấy thông tin cấu hình phần cứng (CPU, RAM, GPU) và trạng thái sẵn sàng."""
    try:
        import system_info
        return system_info.lay_cau_hinh_he_thong()
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/device")
def lay_thiet_bi() -> dict:
    """Lấy thông tin thiết bị đang chọn (CPU hoặc GPU)."""
    return engine.get_device_info()


@app.post("/api/device")
def dat_thiet_bi(device: str = Form(...), _: None = Depends(require_key)) -> dict:
    """Chuyển đổi thiết bị xử lý (CPU hoặc GPU)."""
    return engine.set_device(device)


# Endpoints tổng hợp giọng nói
@app.post("/api/tts")
def tts(
    text: str = Form(...),
    num_step: int = Form(DEFAULTS["num_step"]),
    guidance_scale: float = Form(DEFAULTS["guidance_scale"]),
    speed: float = Form(1.0),
    voice_id: str = Form(""),
    split_mode: str = Form("none"),
    pause_sentence: float = Form(0.5),
    pause_paragraph: float = Form(1.0),
    _: None = Depends(require_key),
) -> Response:
    """Tổng hợp giọng nói từ văn bản kèm ngắt nghỉ và thẻ cảm xúc."""
    return _run(lambda: engine.synth(
        text=text, mode="tts", voice_id=voice_id,
        num_step=num_step, guidance_scale=guidance_scale, speed=speed,
        split_mode=split_mode, pause_sentence=pause_sentence, pause_paragraph=pause_paragraph,
    ))


@app.post("/api/clone")
async def clone(
    text: str = Form(...),
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(""),
    num_step: int = Form(DEFAULTS["num_step"]),
    guidance_scale: float = Form(DEFAULTS["guidance_scale"]),
    speed: float = Form(1.0),
    _: None = Depends(require_key),
) -> Response:
    """Nhân bản giọng từ clip âm thanh mẫu zero-shot."""
    data = await ref_audio.read()
    _check_size(data)
    return _run(lambda: engine.synth(
        text=text, mode="clone",
        ref_audio_bytes=data, ref_text=ref_text,
        num_step=num_step, guidance_scale=guidance_scale, speed=speed,
    ))


@app.post("/api/design")
def design(
    text: str = Form(...),
    instruct: str = Form(...),
    num_step: int = Form(DEFAULTS["num_step"]),
    guidance_scale: float = Form(DEFAULTS["guidance_scale"]),
    speed: float = Form(1.0),
    _: None = Depends(require_key),
) -> Response:
    """Thiết kế giọng nói theo mô tả ngôn ngữ tự nhiên."""
    return _run(lambda: engine.synth(
        text=text, mode="design", instruct=instruct,
        num_step=num_step, guidance_scale=guidance_scale, speed=speed,
    ))


# Quản lý thư viện giọng
def _can_voices() -> None:
    if thu_vien_giong is None:
        raise HTTPException(503, f"Thư viện giọng không khả dụng ({log_loi_voices})")


@app.get("/api/voices")
def danh_sach_giong(_: None = Depends(require_key)) -> dict:
    """Danh sách giọng có sẵn trong thư viện."""
    _can_voices()
    ds = thu_vien_giong.quet()
    return {
        "dir": str(thu_vien_giong.thu_muc()),
        "count": len(ds),
        "voices": ds,
        "cached": sorted(engine._prompts),
    }


@app.get("/api/voices/bundle")
def lay_goi_giong_mac_dinh(_: None = Depends(require_key)) -> dict:
    """Trả về gói dữ liệu giọng mẫu để hỗ trợ đồng bộ sang máy chủ."""
    _can_voices()
    import base64
    d = thu_vien_giong.thu_muc()
    res = {}
    for p in d.glob("*.pt"):
        try:
            res[p.name] = base64.b64encode(p.read_bytes()).decode("ascii")
        except Exception:
            pass
    return {"status": "ok", "count": len(res), "voices": res}


@app.post("/api/voices/sync")
async def dong_bo_goi_giong(payload: dict, _: None = Depends(require_key)) -> dict:
    """Đồng bộ các giọng mẫu vào thư viện trên máy chủ."""
    _can_voices()
    import base64
    v_dict = payload.get("voices", {})
    count = 0
    synced = []
    for fname, b64_str in v_dict.items():
        try:
            data = base64.b64decode(b64_str)
            e = thu_vien_giong.luu(fname, data)
            engine.xoa_prompt(e["id"])
            count += 1
            synced.append(e["id"])
        except Exception as ex:
            log.warning("Lỗi khi đồng bộ giọng %s: %s", fname, ex)
    log.info("Đã đồng bộ %d giọng vào thư viện", count)
    return {"status": "ok", "count": count, "synced": synced}


@app.post("/api/voices")
async def them_giong(
    file: UploadFile = File(...),
    name: str = Form(""),
    gender: str = Form(""),
    note: str = Form(""),
    _: None = Depends(require_key),
) -> dict:
    """Thêm một tệp giọng đọc vào thư viện."""
    _can_voices()
    data = await file.read()
    try:
        e = thu_vien_giong.luu(file.filename or "giong.pt", data, name=name, gender=gender, note=note)
    except ValueError as ex:
        raise HTTPException(400, str(ex)) from ex
    engine.xoa_prompt(e["id"])
    log.info("Thêm giọng '%s' (%d B)", e["id"], e["bytes"])
    return {"ok": True, "voice": e}


@app.post("/api/voices/save-clone")
def luu_giong_clone(
    name: str = Form(...),
    gender: str = Form(""),
    note: str = Form(""),
    _: None = Depends(require_key),
) -> dict:
    """Lưu giọng vừa nhân bản vào thư viện."""
    _can_voices()
    prompt = engine._last_clone_prompt
    if prompt is None:
        if engine.mock:
            import io, zipfile
            ten_tep = thu_vien_giong.lam_ten_tep(thu_vien_giong.lam_id(name) + ".pt")
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as zf:
                zf.writestr("mock_voice/data.pkl", b"\x80\x02}q\x00." + b"\x00" * 2000)
            data = buf.getvalue()
            e = thu_vien_giong.luu(ten_tep, data, name=name, gender=gender, note=note)
            log.info("Lưu giọng giả lập '%s'", e["id"])
            return {"ok": True, "voice": e}
        raise HTTPException(400, "Chưa có giọng nào để lưu — hãy nhân bản giọng trước")

    import tempfile
    fd, tmp = tempfile.mkstemp(suffix=".pt")
    try:
        prompt.save(tmp)
        with open(tmp, "rb") as f:
            data = f.read()
    finally:
        try:
            import os as _os
            _os.close(fd)
            _os.unlink(tmp)
        except OSError:
            pass

    ten_tep = thu_vien_giong.lam_ten_tep(thu_vien_giong.lam_id(name) + ".pt")
    try:
        e = thu_vien_giong.luu(ten_tep, data, name=name, gender=gender, note=note)
    except ValueError as ex:
        raise HTTPException(400, str(ex)) from ex

    engine.xoa_prompt(e["id"])
    log.info("Lưu giọng clone '%s' (%d B)", e["id"], e["bytes"])
    return {"ok": True, "voice": e}


@app.delete("/api/voices/{voice_id}")
def xoa_giong(voice_id: str, _: None = Depends(require_key)) -> dict:
    """Xóa một giọng khỏi thư viện."""
    _can_voices()
    try:
        ten = thu_vien_giong.xoa(voice_id)
    except FileNotFoundError as ex:
        raise HTTPException(404, str(ex)) from ex
    engine.xoa_prompt(voice_id)
    log.info("Xoá giọng '%s' (%s)", voice_id, ten)
    return {"ok": True, "deleted": voice_id}


# Bộ hỗ trợ thực thi
def _check_size(data: bytes) -> None:
    mb = len(data) / (1024 * 1024)
    if mb > MAX_UPLOAD_MB:
        raise HTTPException(413, f"File quá lớn ({mb:.1f} MB > {MAX_UPLOAD_MB} MB)")
    if len(data) < 1024:
        raise HTTPException(400, "File audio quá nhỏ hoặc rỗng")


def _run(fn) -> Response:
    t0 = time.perf_counter()
    try:
        res = fn()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except Exception as e:
        log.exception("Lỗi khi tổng hợp âm thanh")
        raise HTTPException(500, f"{type(e).__name__}: {e}") from e

    headers = {
        "X-Gen-Time": str(res.gen_time),
        "X-Audio-Duration": str(res.duration),
        "X-RTF": f"{res.rtf:.3f}",
        "X-Mode": res.mode,
        "Content-Disposition": f'inline; filename="{res.mode}.wav"',
    }
    log.info(
        "OK mode=%s dur=%.2fs gen=%.2fs rtf=%.3f wall=%.2fs",
        res.mode, res.duration, res.gen_time, res.rtf, time.perf_counter() - t0,
    )
    return Response(content=res.wav, media_type="audio/wav", headers=headers)


@app.exception_handler(HTTPException)
async def _http_err(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
