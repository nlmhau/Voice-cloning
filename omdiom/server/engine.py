from __future__ import annotations

import io
import logging
import math
import struct
import time
import wave
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger("engine")

# Ngôn ngữ mục tiêu: Tiếng Việt
LANG_CODE = "vi"
LANG_NAME = "vietnamese"

# Tham số cấu hình suy luận mặc định
DEFAULTS = {
    "num_step": 16,        # 16 bước khuếch tán tối ưu tốc độ và chất lượng
    "guidance_scale": 2.0,
    "speed": 1.0,
    "t_shift": 0.1,
    "denoise": True,
    "postprocess_output": True,
}

VALID_MODES = ("tts", "clone", "design")

# Ánh xạ thẻ cảm xúc tiếng Việt
MAP_THE_CAM_XUC_VN_SANG_OMNI = {
    r"\[cười\]": "[laughter]",
    r"\[cuoi\]": "[laughter]",
    r"\[thở dài\]": "[sigh]",
    r"\[tho dai\]": "[sigh]",
    r"\[ngạc nhiên\]": "[surprise-oh]",
    r"\[ngạc nhiên-ồ\]": "[surprise-oh]",
    r"\[ngạc nhiên-o\]": "[surprise-oh]",
    r"\[ngac nhien\]": "[surprise-oh]",
    r"\[ngac nhien-o\]": "[surprise-oh]",
    r"\[ngạc nhiên-à\]": "[surprise-ah]",
    r"\[ngac nhien-a\]": "[surprise-ah]",
    r"\[ngạc nhiên-dô\]": "[surprise-yo]",
    r"\[trầm trồ\]": "[surprise-wa]",
    r"\[trầm trồ-oa\]": "[surprise-wa]",
    r"\[tram tro\]": "[surprise-wa]",
    r"\[tram tro-oa\]": "[surprise-wa]",
    r"\[nghi vấn\]": "[question-ah]",
    r"\[nghi vấn-hả\]": "[question-ah]",
    r"\[nghi van\]": "[question-ah]",
    r"\[nghi van-ha\]": "[question-ah]",
    r"\[thắc mắc\]": "[question-oh]",
    r"\[thắc mắc-ơ\]": "[question-oh]",
    r"\[thac mac\]": "[question-oh]",
    r"\[thac mac-o\]": "[question-oh]",
    r"\[thắc mắc-hở\]": "[question-ei]",
    r"\[thắc mắc-í\]": "[question-yi]",
    r"\[đồng tình\]": "[confirmation-en]",
    r"\[đồng tình-ừm\]": "[confirmation-en]",
    r"\[dong tinh\]": "[confirmation-en]",
    r"\[ừm\]": "[confirmation-en]",
    r"\[um\]": "[confirmation-en]",
    r"\[bất mãn\]": "[dissatisfaction-hnn]",
    r"\[bất mãn-hừm\]": "[dissatisfaction-hnn]",
    r"\[bat man\]": "[dissatisfaction-hnn]",
    r"\[hừm\]": "[dissatisfaction-hnn]",
    r"\[hum\]": "[dissatisfaction-hnn]",
}

VALID_INSTRUCTS_EN = {
    "american accent", "australian accent", "british accent", "canadian accent",
    "child", "chinese accent", "elderly", "female", "high pitch", "indian accent",
    "japanese accent", "korean accent", "low pitch", "male", "middle-aged",
    "moderate pitch", "portuguese accent", "russian accent", "teenager",
    "very high pitch", "very low pitch", "whisper", "young adult"
}

MAP_INSTRUCT_VN = {
    "nữ": "female", "gái": "female", "phụ nữ": "female", "chị": "female", "bà": "female",
    "nam": "male", "trai": "male", "đàn ông": "male", "anh": "male", "ông": "male",
    "trẻ em": "child", "bé": "child", "con nít": "child", "em bé": "child",
    "thiếu niên": "teenager", "tuổi teen": "teenager",
    "trẻ": "young adult", "thanh niên": "young adult", "người trẻ": "young adult",
    "trung niên": "middle-aged", "đứng tuổi": "middle-aged",
    "già": "elderly", "người già": "elderly", "lớn tuổi": "elderly",
    "thì thầm": "whisper", "nói nhỏ": "whisper",
    "trầm": "low pitch", "giọng trầm": "low pitch", "thấp": "low pitch",
    "rất trầm": "very low pitch", "cực trầm": "very low pitch",
    "cao": "high pitch", "giọng cao": "high pitch", "trong trẻo": "high pitch",
    "rất cao": "very high pitch", "chói": "very high pitch",
    "vừa phải": "moderate pitch", "bình thường": "moderate pitch", "nhẹ nhàng": "moderate pitch",
    "tự nhiên": "moderate pitch", "truyền cảm": "moderate pitch", "ấm áp": "moderate pitch",
}

def chuan_hoa_instruct(instruct: str) -> str:
    """Chuẩn hóa câu lệnh thiết kế giọng sang tập token chuẩn.
    Tự động dịch từ tiếng Việt và loại bỏ các từ không được hỗ trợ để chống lỗi ValueError."""
    if not instruct:
        return "female, young adult, moderate pitch"
    raw = instruct.lower().replace(";", ",").replace(".", ",")
    tokens = [t.strip() for t in raw.split(",") if t.strip()]
    kq = []
    for t in tokens:
        if t in VALID_INSTRUCTS_EN:
            if t not in kq:
                kq.append(t)
            continue
        matched = False
        for k_vn, target_tok in MAP_INSTRUCT_VN.items():
            if k_vn in t or t in k_vn:
                if target_tok not in kq:
                    kq.append(target_tok)
                matched = True
                break
        if not matched:
            for tok_en in VALID_INSTRUCTS_EN:
                if tok_en in t:
                    if tok_en not in kq:
                        kq.append(tok_en)
                    matched = True
                    break
    if not kq:
        kq = ["female", "young adult", "moderate pitch"]
    if "female" in kq and "male" in kq:
        kq.remove("male")
    return ", ".join(kq)


def chuan_hoa_the_cam_xuc(text: str) -> str:
    """Chuyển đổi thẻ cảm xúc tiếng Việt sang token chuẩn để AI nhận diện đúng."""
    if not text:
        return ""
    import re
    res = text
    for pattern, omni_tag in MAP_THE_CAM_XUC_VN_SANG_OMNI.items():
        res = re.sub(pattern, omni_tag, res, flags=re.IGNORECASE)
    return res


@dataclass
class SynthResult:
    """Kết quả một lần tổng hợp."""
    wav: bytes
    sample_rate: int
    duration: float          # giây
    gen_time: float          # giây
    mode: str
    params: dict = field(default_factory=dict)

    @property
    def rtf(self) -> float:
        """Real-Time Factor: < 1 nghĩa là nhanh hơn thời gian thực."""
        return self.gen_time / self.duration if self.duration > 0 else float("inf")


class TTSEngine:
    def __init__(self, model_id: str = "k2-fsa/OmniVoice", mock: bool = False):
        import os
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
        for alt in [base_dir, r"D:\OmDiOm\models", r"C:\OmDiOm\models"]:
            if os.path.exists(os.path.join(alt, "omdiom", "model.safetensors")):
                base_dir = alt
                break
        local_omdiom = os.path.join(base_dir, "omdiom")
        local_model = os.path.join(base_dir, "OmniVoice")
        active_file = os.path.join(base_dir, "active_model.txt")

        saved_choice = ""
        if os.path.exists(active_file):
            try:
                with open(active_file, "r", encoding="utf-8") as af:
                    saved_choice = af.read().strip().lower()
            except Exception:
                pass

        if saved_choice == "omnivoice" and os.path.isdir(local_model) and os.path.exists(os.path.join(local_model, "model.safetensors")):
            self.model_id = local_model
            self.model_name = "OmniVoice (Base)"
            log.info("Nạp model OmniVoice gốc theo cấu hình: %s", self.model_id)
        elif os.path.isdir(local_omdiom) and os.path.exists(os.path.join(local_omdiom, "model.safetensors")):
            self.model_id = local_omdiom
            self.model_name = "OmDiOm (Vietnamese Fine-tuned)"
            log.info("Phát hiện model OmDiOm Việt hóa cục bộ đã huấn luyện: %s", self.model_id)
        elif os.path.isdir(local_model) and os.path.exists(os.path.join(local_model, "model.safetensors")):
            self.model_id = local_model
            self.model_name = "OmniVoice (Base)"
            log.info("Phát hiện model OmniVoice cục bộ đã tải về máy: %s", self.model_id)
        else:
            self.model_id = model_id
            self.model_name = "OmniVoice (k2-fsa)"
        self.mock = mock
        self.model = None
        self.sample_rate = 24000   # ghi đè bằng model.sampling_rate khi load thật
        self.device = "cpu"        # chuỗi HIỂN THỊ, có thể kèm tên GPU — đừng đem .to()
        self.device_torch = "cpu"  # "cuda:0"/"cpu"/"mps" — dùng được cho tensor.to()
        self.load_time: Optional[float] = None
        self._loaded = False
        self._prompts: dict = {}   # id giọng → VoiceClonePrompt đã nạp (cache)
        self._last_clone_prompt = None  # prompt cuối cùng từ clone — để UI lưu giọng

        self.selected_device = "cpu"
        self.cpu_name = "Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz"
        self.gpu_name = "NVIDIA Quadro T2000"
        self._init_device_names()
        self.device = f"💻 CPU: {self.cpu_name}"

        try:
            import voices as thu_vien
            self.thu_vien = thu_vien
        except Exception as e:      # thiếu voices.py vẫn chạy được, chỉ mất tính năng chọn giọng
            log.warning("Không nạp được thư viện giọng: %s", e)
            self.thu_vien = None

    def _init_device_names(self) -> None:
        """Nhận diện tên chi tiết của CPU và GPU từ phần cứng máy."""
        try:
            import system_info
            info = system_info.lay_cau_hinh_he_thong()
            self.cpu_name = info.get("cpu", {}).get("name") or self.cpu_name
            self.gpu_name = info.get("primary_gpu") or self.gpu_name
        except Exception:
            pass

    def get_device_info(self) -> dict:
        """Trả về thông tin thiết bị chi tiết cho giao diện UI."""
        self._init_device_names()
        is_gpu = (self.selected_device == "gpu")
        dev_name = self.gpu_name if is_gpu else self.cpu_name
        return {
            "status": "ok",
            "selected_device": self.selected_device,
            "device_name": dev_name,
            "cpu_name": self.cpu_name,
            "gpu_name": self.gpu_name,
            "device_display": f"{'⚡ GPU' if is_gpu else '💻 CPU'}: {dev_name}",
        }

    def set_device(self, dev: str) -> dict:
        """Chuyển đổi thiết bị xử lý (CPU hoặc GPU)."""
        dev = (dev or "cpu").strip().lower()
        if dev not in ("cpu", "gpu"):
            dev = "cpu"
        self.selected_device = dev
        self._init_device_names()
        is_gpu = (dev == "gpu")
        dev_name = self.gpu_name if is_gpu else self.cpu_name
        self.device = f"{'⚡ GPU' if is_gpu else '💻 CPU'}: {dev_name}"
        log.info("Thiết bị xử lý chuyển sang: %s (%s)", dev.upper(), dev_name)
        return self.get_device_info()

    # ------------------------------------------------------------------ load
    def load(self) -> None:
        """Nạp model. Gọi 1 lần lúc khởi động server."""
        if self._loaded:
            return

        if self.mock:
            log.warning("MOCK MODE — không nạp model thật, âm thanh là sine wave giả lập")
            self._loaded = True
            self.load_time = 0.0
            return

        try:
            import torch
            from omnivoice import OmniVoice
        except ImportError as e:
            log.warning("Không tìm thấy thư viện omnivoice (%s). Tự động chuyển sang chế độ GIẢ LẬP (MOCK MODE).", e)
            self.mock = True
            self._loaded = True
            self.load_time = 0.0
            return

        t0 = time.perf_counter()

        if torch.cuda.is_available():
            self.device = "cuda"
            dtype = torch.float16          # T4 (Turing) không có bf16 tensor core
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            self.device = self.device_torch = "mps"
            dtype = torch.float16
        else:
            self.device = self.device_torch = "cpu"
            dtype = torch.float32
            log.warning("Không có GPU — chạy CPU, sẽ rất chậm")

        log.info("Đang nạp %s trên %s (%s)...", self.model_id, self.device, dtype)

        ung_vien = [self.device, "cuda:0", 0] if self.device.startswith("cuda") else [self.device]
        loi_cuoi = None
        for dm in ung_vien:
            try:
                self.model = OmniVoice.from_pretrained(
                    self.model_id, device_map=dm, dtype=dtype,
                )
                log.info("Nạp được với device_map=%r", dm)
                break
            except (ValueError, RuntimeError, TypeError) as e:
                loi_cuoi = e
                log.warning("device_map=%r không nhận (%s) — thử kiểu khác", dm, e)
        if self.model is None:
            raise RuntimeError(f"Không nạp được model với bất kỳ device_map nào: {loi_cuoi}")

        if torch.cuda.is_available():
            i = torch.cuda.current_device()
            self.device_torch = f"cuda:{i}"
            self.device = f"cuda:{i} · {torch.cuda.get_device_name(i)}"
            log.info("VRAM đã dùng: %.2f GB", torch.cuda.memory_allocated() / 2**30)

        self.sample_rate = int(getattr(self.model, "sampling_rate", 24000))
        self.load_time = time.perf_counter() - t0
        self._loaded = True
        log.info("Nạp xong trong %.1fs | sample_rate=%d", self.load_time, self.sample_rate)
        self._do_api()

    # ---------------------------------------------------------- thư viện giọng
    def nap_prompt(self, voice_id: str):
        """Nạp và lưu cache prompt của giọng đọc."""
        if voice_id in self._prompts:
            return self._prompts[voice_id]

        if self.mock:
            # Chế độ giả lập: không nạp .pt thật, nhưng PHẢI kiểm id có tồn tại
            if self.thu_vien is not None:
                self.thu_vien.duong(voice_id)
            self._prompts[voice_id] = {"mock": True, "voice_id": voice_id}
            return self._prompts[voice_id]

        if self.thu_vien is None:
            raise ValueError("Thư viện giọng chưa sẵn sàng (thiếu voices.py)")

        duong = self.thu_vien.duong(voice_id)      # FileNotFoundError nếu id sai
        from omnivoice import VoiceClonePrompt

        t0 = time.perf_counter()
        prompt = VoiceClonePrompt.load(str(duong))
        prompt = self._chuyen_thiet_bi(prompt)
        self._prompts[voice_id] = prompt
        log.info(
            "Nạp giọng '%s' từ %s (%d KB) trong %.2fs",
            voice_id, duong.name, duong.stat().st_size // 1024, time.perf_counter() - t0,
        )
        return prompt

    def _chuyen_thiet_bi(self, v, sau: int = 0):
        """Đưa mọi tensor bên trong prompt về đúng thiết bị tính toán."""
        if sau > 6:
            return v
        try:
            import torch
        except Exception:
            return v

        dev = self.device_torch or "cpu"
        if isinstance(v, torch.Tensor):
            try:
                return v.to(dev)
            except Exception as e:
                log.warning("Không chuyển được tensor sang %s: %s", dev, e)
                return v
        if isinstance(v, dict):
            return {k: self._chuyen_thiet_bi(x, sau + 1) for k, x in v.items()}
        if isinstance(v, list):
            return [self._chuyen_thiet_bi(x, sau + 1) for x in v]
        if isinstance(v, tuple):
            return tuple(self._chuyen_thiet_bi(x, sau + 1) for x in v)
        # đối tượng có thuộc tính riêng (VoiceClonePrompt, nn.Module…)
        if hasattr(v, "__dict__") and not isinstance(v, type):
            for k, x in list(vars(v).items()):
                if isinstance(x, (torch.Tensor, dict, list, tuple)):
                    try:
                        setattr(v, k, self._chuyen_thiet_bi(x, sau + 1))
                    except Exception:
                        pass
        return v

    def xoa_prompt(self, voice_id: str) -> None:
        """Bỏ prompt khỏi bộ nhớ — bắt buộc sau khi ghi đè hoặc xoá tệp .pt."""
        if self._prompts.pop(voice_id, None) is not None:
            log.info("Đã bỏ prompt '%s' khỏi bộ nhớ", voice_id)

    def _do_api(self) -> None:
        """Kiểm tra chữ ký hàm suy luận và phương thức mô hình."""
        import inspect
        try:
            chu_ky = str(inspect.signature(self.model.generate))
            log.info("generate%s", chu_ky.split(") ->")[0] + ")")
            ten = sorted(n for n in dir(self.model)
                         if any(k in n.lower() for k in ("clone", "prompt", "voice", "instruct")))
            log.info("Hàm liên quan giọng: %s", ", ".join(ten) or "(không có)")
            self._api = {
                "generate": chu_ky,
                "co_clone": any("clone" in n.lower() for n in ten),
                "ham_giong": ten,
            }
        except Exception as e:                     # không được để dò API làm chết load
            log.warning("Không dò được API: %s", e)
            self._api = {}

    # --------------------------------------------------------------- generate
    def _tach_doan(self, text: str, split_mode: str) -> list[str]:
        """Tách văn bản thành các câu hoặc các đoạn để ngắt nghỉ tự nhiên."""
        import re
        text = text.strip()
        if split_mode == "sentence":
            # Tách theo các dấu kết thúc câu (. ? ! ; hoặc xuống dòng)
            raw = re.split(r'([.?!;\n]+)', text)
            chunks = []
            cur = ""
            for p in raw:
                cur += p
                if re.search(r'[.?!;\n]+', p):
                    c = cur.strip()
                    if c:
                        chunks.append(c)
                    cur = ""
            if cur.strip():
                chunks.append(cur.strip())
            return [c for c in chunks if c]
        elif split_mode == "paragraph":
            # Tách theo dòng xuống hàng
            chunks = [p.strip() for p in text.split("\n") if p.strip()]
            return [c for c in chunks if c]
        return [text]

    def _synth_single(
        self,
        text: str,
        mode: str = "tts",
        ref_audio_bytes: Optional[bytes] = None,
        ref_text: Optional[str] = None,
        instruct: Optional[str] = None,
        num_step: int = DEFAULTS["num_step"],
        guidance_scale: float = DEFAULTS["guidance_scale"],
        speed: float = DEFAULTS["speed"],
        voice_id: Optional[str] = None,
    ):
        """Sinh âm thanh cho một câu đơn lẻ, trả về (pcm_float32, gen_time)."""
        if self.mock:
            kq = self._mock_synth(text, mode, num_step, voice_id=voice_id)
            pcm = self._to_pcm(np.frombuffer(kq.wav[44:], dtype=np.int16).astype(np.float32) / 32767.0)
            return pcm, kq.gen_time

        import torch
        num_step = max(1, min(int(num_step), 128))
        guidance_scale = float(guidance_scale)
        speed = float(speed)

        kwargs = dict(
            text=text,
            language=LANG_NAME,
            num_step=num_step,
            guidance_scale=guidance_scale,
            t_shift=DEFAULTS["t_shift"],
            denoise=DEFAULTS["denoise"],
            postprocess_output=DEFAULTS["postprocess_output"],
        )
        if speed != 1.0:
            kwargs["speed"] = speed

        tmp_path = None
        voice_id = (voice_id or "").strip()
        if voice_id:
            kwargs["voice_clone_prompt"] = self.nap_prompt(voice_id)
        elif mode == "clone":
            ref_audio_bytes = self._chuan_hoa_audio_clone(ref_audio_bytes)
            tmp_path = self._write_temp(ref_audio_bytes)
            clone_prompt = self.model.create_voice_clone_prompt(
                ref_audio=tmp_path,
                ref_text=(ref_text or "").strip() or None,
            )
            kwargs["voice_clone_prompt"] = clone_prompt
            self._last_clone_prompt = clone_prompt
        elif mode == "design":
            kwargs["instruct"] = chuan_hoa_instruct(instruct)

        t0 = time.perf_counter()
        try:
            with torch.inference_mode():
                audio = self.model.generate(**kwargs)
        finally:
            if tmp_path:
                try:
                    import os
                    os.unlink(tmp_path)
                except OSError:
                    pass

        gen_time = time.perf_counter() - t0
        pcm = self._to_pcm(audio)
        return pcm, gen_time

    def synth(
        self,
        text: str,
        mode: str = "tts",
        ref_audio_bytes: Optional[bytes] = None,
        ref_text: Optional[str] = None,
        instruct: Optional[str] = None,
        num_step: int = DEFAULTS["num_step"],
        guidance_scale: float = DEFAULTS["guidance_scale"],
        speed: float = DEFAULTS["speed"],
        voice_id: Optional[str] = None,
        split_mode: str = "none",
        pause_sentence: float = 0.5,
        pause_paragraph: float = 1.0,
    ) -> SynthResult:
        """Tổng hợp giọng nói có hỗ trợ tách câu/đoạn và chèn khoảng lặng tự nhiên."""
        import numpy as np
        text = (text or "").strip()
        text = chuan_hoa_the_cam_xuc(text)
        if not text:
            raise ValueError("Văn bản rỗng")
        if mode not in VALID_MODES:
            raise ValueError(f"mode phải là một trong {VALID_MODES}")

        if mode == "clone" and not ref_audio_bytes:
            raise ValueError("Chế độ nhân bản giọng cần file audio mẫu")
        if mode == "design" and not (instruct or "").strip():
            raise ValueError("Chế độ thiết kế giọng cần mô tả giọng (instruct)")

        voice_id = (voice_id or "").strip()
        if not voice_id and mode == "tts":
            voice_id = "Cao_Hung"

        self.load()

        # Kiểm tra tách câu/đoạn
        chunks = self._tach_doan(text, split_mode) if split_mode in ("sentence", "paragraph") else [text]
        if not chunks:
            chunks = [text]

        pause_sec = pause_paragraph if split_mode == "paragraph" else pause_sentence
        pause_sec = max(0.0, min(float(pause_sec), 5.0))
        silence_samples = int(self.sample_rate * pause_sec)

        pcm_list = []
        total_gen_time = 0.0

        for i, chunk in enumerate(chunks):
            pcm, gt = self._synth_single(
                text=chunk, mode=mode, ref_audio_bytes=ref_audio_bytes,
                ref_text=ref_text, instruct=instruct, num_step=num_step,
                guidance_scale=guidance_scale, speed=speed, voice_id=voice_id
            )
            pcm_list.append(pcm)
            total_gen_time += gt
            # Chèn khoảng lặng giữa các đoạn (không chèn sau đoạn cuối cùng)
            if i < len(chunks) - 1 and silence_samples > 0:
                silence_pcm = np.zeros(silence_samples, dtype=np.float32)
                pcm_list.append(silence_pcm)

        full_pcm = np.concatenate(pcm_list) if len(pcm_list) > 1 else pcm_list[0]
        wav = self._to_wav_bytes(full_pcm)
        duration = len(full_pcm) / self.sample_rate

        return SynthResult(
            wav=wav,
            sample_rate=self.sample_rate,
            duration=round(duration, 3),
            gen_time=round(total_gen_time, 3),
            mode=mode,
            params={
                "num_step": num_step,
                "guidance_scale": guidance_scale,
                "speed": speed,
                "voice_id": voice_id,
                "split_mode": split_mode,
                "pause_sentence": pause_sentence,
                "pause_paragraph": pause_paragraph,
                "chunks_count": len(chunks)
            },
        )

    # ------------------------------------------------------------------ utils
    def _chuan_hoa_audio_clone(self, data: bytes) -> bytes:
        """Đảm bảo âm thanh mẫu đưa vào model luôn là định dạng WAV 16-bit PCM mà soundfile đọc được 100%."""
        import io, soundfile as sf
        try:
            sf.read(io.BytesIO(data))
            return data
        except Exception:
            try:
                import av, wave
                container = av.open(io.BytesIO(data))
                stream = container.streams.audio[0]
                sr = stream.rate or 24000
                resampler = av.AudioResampler(format="s16", layout="mono", rate=sr)
                chunks = []
                for frame in container.decode(stream):
                    for rf in resampler.resample(frame):
                        chunks.append(rf.to_ndarray().tobytes())
                pcm_bytes = b"".join(chunks)
                buf = io.BytesIO()
                with wave.open(buf, "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(sr)
                    w.writeframes(pcm_bytes)
                log.info("Đã tự động chuyển đổi file audio mẫu sang chuẩn WAV 16-bit PCM (%d bytes)", len(pcm_bytes))
                return buf.getvalue()
            except Exception as e:
                log.warning("Không thể chuyển đổi audio bằng PyAV: %s", e)
                return data

    def _write_temp(self, data: bytes) -> str:
        import tempfile
        fd, path = tempfile.mkstemp(suffix=".wav")
        with open(fd, "wb") as f:
            f.write(data)
        return path

    def _to_pcm(self, audio):
        """Chuẩn hoá đầu ra generate() về mảng float32 1 chiều trong [-1, 1].

        Chấp nhận: torch.Tensor (bất kỳ shape/dtype), numpy.ndarray,
        list/tuple chứa một trong hai. omnivoice 0.2.1 trả numpy.ndarray.
        """
        import numpy as np

        arr = audio
        # list/tuple lồng: lấy phần tử đầu (mỗi câu 1 phần tử)
        while isinstance(arr, (list, tuple)):
            if len(arr) == 0:
                raise RuntimeError("generate() trả list rỗng — không có audio")
            arr = arr[0]

        kieu = type(arr).__name__
        if hasattr(arr, "detach"):          # torch.Tensor
            arr = arr.detach()
            if getattr(arr, "is_floating_point", lambda: True)():
                arr = arr.float()
            arr = arr.cpu().numpy()
            kieu = f"{kieu} (tensor)"

        arr = np.asarray(arr)
        # PCM số nguyên 16-bit → đưa về [-1, 1] trước khi clip
        if np.issubdtype(arr.dtype, np.integer):
            arr = arr.astype("float32") / 32768.0
        else:
            arr = arr.astype("float32", copy=False)
        arr = arr.reshape(-1)

        if arr.size == 0:
            raise RuntimeError("generate() trả audio rỗng (0 mẫu)")

        log.info(
            "audio: %s → %d mẫu | dtype=%s | min=%.3f max=%.3f",
            kieu, arr.size, arr.dtype,
            float(arr.min()), float(arr.max()),
        )
        return arr

    def _to_wav_bytes(self, pcm) -> bytes:
        """float32 [-1,1] → WAV PCM16 bytes."""
        import numpy as np
        pcm16 = np.clip(np.asarray(pcm, dtype="float32"), -1.0, 1.0)
        pcm16 = (pcm16 * 32767).astype("<i2")
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.sample_rate)
            w.writeframes(pcm16.tobytes())
        return buf.getvalue()

    def _mock_synth(self, text: str, mode: str, num_step: int, voice_id: Optional[str] = None) -> SynthResult:
        """Tổng hợp giọng nói cục bộ đa ngữ điệu."""
        t0 = time.perf_counter()
        sr = self.sample_rate

        VOICE_MAP = {
            "Cao_Hung": ("vi-VN-NamMinhNeural", "-10%", 160.0),
            "Linh_Duc_Tu": ("vi-VN-HoaiMyNeural", "+0%", 280.0),
            "Minh_Nhi": ("vi-VN-HoaiMyNeural", "+12%", 340.0),
            "Minh_Quy": ("vi-VN-NamMinhNeural", "+5%", 210.0),
            "Phuong_Thy": ("vi-VN-HoaiMyNeural", "-5%", 240.0),
            "To_Thanh": ("vi-VN-NamMinhNeural", "-5%", 185.0),
            "Ut_Linh": ("vi-VN-HoaiMyNeural", "-12%", 220.0),
        }

        # Tìm cấu hình giọng tương ứng
        vid = (voice_id or "Cao_Hung").strip()
        prof = VOICE_MAP.get(vid)
        if not prof:
            for k, val in VOICE_MAP.items():
                if k.lower() in vid.lower() or vid.lower() in k.lower():
                    prof = val
                    vid = k
                    break
        if not prof:
            prof = VOICE_MAP["Cao_Hung"]

        voice_name, rate_str, base_freq = prof
        wav_bytes = None
        duration = 0.0

        # Thử tổng hợp tiếng Việt chuẩn bằng edge_tts
        try:
            import asyncio
            import edge_tts
            import soundfile as sf

            async def _run_tts():
                comm = edge_tts.Communicate(text=text, voice=voice_name, rate=rate_str)
                audio_chunks = b""
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        audio_chunks += chunk["data"]
                return audio_chunks

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                        raw = pool.submit(lambda: asyncio.run(_run_tts())).result(timeout=10)
                else:
                    raw = loop.run_until_complete(_run_tts())
            except RuntimeError:
                raw = asyncio.run(_run_tts())

            if raw:
                y, in_sr = sf.read(io.BytesIO(raw))
                if len(y.shape) > 1:
                    y = y.mean(axis=1)
                duration = len(y) / float(in_sr)
                buf = io.BytesIO()
                sf.write(buf, y, self.sample_rate, format="WAV", subtype="PCM_16")
                wav_bytes = buf.getvalue()
        except Exception as e:
            log.warning("Local TTS chuyển sang acoustic fallback: %s", e)

        # Fallback offline: sóng âm acoustic đa hài âm theo đúng tần số của từng giọng
        if not wav_bytes:
            duration = max(0.8, min(len(text) * 0.065, 8.0))
            n = int(sr * duration)
            frames = bytearray()
            for i in range(n):
                env = min(1.0, i / (sr * 0.04), (n - i) / (sr * 0.04))
                s1 = math.sin(2 * math.pi * base_freq * i / sr)
                s2 = 0.35 * math.sin(4 * math.pi * base_freq * i / sr)
                s3 = 0.15 * math.sin(6 * math.pi * base_freq * i / sr)
                v = int(10000 * env * (s1 + s2 + s3))
                frames += struct.pack("<h", max(-32767, min(32767, v)))

            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(sr)
                w.writeframes(bytes(frames))
            wav_bytes = buf.getvalue()

        gen_time = time.perf_counter() - t0
        return SynthResult(
            wav=wav_bytes,
            sample_rate=sr,
            duration=round(duration, 3),
            gen_time=round(gen_time, 3),
            mode=mode,
            params={"num_step": num_step, "voice_id": vid, "local_synth": True},
        )


    def switch_model(self, target: str) -> dict:
        """Chuyển đổi giữa model OmDiOm (Việt hóa) và OmniVoice (gốc)."""
        import os
        import gc
        import time
        target = (target or "omdiom").strip().lower()
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
        for alt in [base_dir, r"D:\OmDiOm\models", r"C:\OmDiOm\models"]:
            if os.path.exists(os.path.join(alt, "omdiom", "model.safetensors")):
                base_dir = alt
                break
        
        if "omdiom" in target:
            target_path = os.path.join(base_dir, "omdiom")
            name = "OmDiOm (Vietnamese Fine-tuned)"
            key_id = "omdiom"
        else:
            target_path = os.path.join(base_dir, "OmniVoice")
            name = "OmniVoice (Base)"
            key_id = "omnivoice"
            
        if not (os.path.isdir(target_path) and os.path.exists(os.path.join(target_path, "model.safetensors"))):
            raise FileNotFoundError(f"Không tìm thấy model tại: {target_path}")

        try:
            active_file = os.path.join(base_dir, "active_model.txt")
            with open(active_file, "w", encoding="utf-8") as f:
                f.write(key_id)
        except Exception as e:
            log.warning("Không thể ghi active_model.txt: %s", e)
            
        log.info("Bắt đầu chuyển sang mô hình: %s (%s)", name, target_path)

        if self.model is not None:
            try:
                if hasattr(self.model, "model"):
                    del self.model.model
                if hasattr(self.model, "audio_tokenizer"):
                    del self.model.audio_tokenizer
            except Exception:
                pass
            del self.model
            self.model = None

        self._prompts.clear()
        self._loaded = False

        for _ in range(3):
            gc.collect()

        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

        try:
            import ctypes
            ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1)
        except Exception:
            pass

        time.sleep(0.5)

        self.model_id = target_path
        self.model_name = name
        self.load()
        return {
            "status": "ok",
            "active_model": key_id,
            "model_name": self.model_name,
            "model_id": self.model_id,
            "load_time": self.load_time,
        }

    # ------------------------------------------------------------------ info
    def info(self) -> dict:
        return {
            "model_id": self.model_id,
            "device": self.device,
            "mock": self.mock,
            "loaded": self._loaded,
            "load_time": self.load_time,
            "sample_rate": self.sample_rate,
            "language": LANG_CODE,
            "defaults": DEFAULTS,
            "api": getattr(self, "_api", {}),
            "voices": (self.thu_vien.thong_ke() if self.thu_vien else {"count": 0, "dir": ""}),
            "prompts_cached": sorted(self._prompts),
        }
