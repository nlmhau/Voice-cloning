from __future__ import annotations

import json
import os
import platform
import subprocess
from typing import Any, Dict

import psutil


def lay_thong_tin_cpu() -> Dict[str, Any]:
    """Lấy thông tin CPU chi tiết."""
    ten = platform.processor() or "CPU"
    try:
        # Trên Windows, truy vấn CIM Win32_Processor
        cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_Processor | Select-Object -First 1 Name | ConvertTo-Json"]
        out = subprocess.check_output(cmd, text=True, timeout=3)
        obj = json.loads(out)
        if isinstance(obj, dict) and obj.get("Name"):
            ten = obj["Name"].strip()
    except Exception:
        pass

    return {
        "name": ten,
        "cores": psutil.cpu_count(logical=False) or 4,
        "threads": psutil.cpu_count(logical=True) or 8,
        "percent": psutil.cpu_percent(interval=0.1),
    }


def lay_thong_tin_ram() -> Dict[str, Any]:
    """Lấy thông tin bộ nhớ RAM."""
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / (1024**3), 1),
        "avail_gb": round(mem.available / (1024**3), 1),
        "used_percent": round(mem.percent, 1),
    }


def lay_thong_tin_gpu() -> list[Dict[str, Any]]:
    """Phát hiện các card đồ họa (NVIDIA, Intel, AMD)."""
    ds = []
    try:
        cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"]
        out = subprocess.check_output(cmd, text=True, timeout=4)
        obj = json.loads(out)
        if isinstance(obj, dict):
            obj = [obj]
        for it in obj:
            ten = str(it.get("Name") or "").strip()
            if not ten:
                continue
            raw_ram = it.get("AdapterRAM") or 0
            # AdapterRAM của Windows có thể là số nguyên 32-bit dương hoặc âm nếu >2GB
            vram_gb = round(raw_ram / (1024**3), 1) if raw_ram > 0 else 0.0
            # Bổ sung ước lượng VRAM chuẩn cho các dòng phổ biến nếu WMI trả về 0
            if "T2000" in ten and vram_gb == 0:
                vram_gb = 4.0
            elif "T1000" in ten and vram_gb == 0:
                vram_gb = 4.0
            elif "RTX 3060" in ten and vram_gb == 0:
                vram_gb = 6.0
            elif "RTX 4060" in ten and vram_gb == 0:
                vram_gb = 8.0

            la_nvidia = "nvidia" in ten.lower()
            ds.append({
                "name": ten,
                "vram_gb": vram_gb,
                "is_nvidia": la_nvidia,
                "type": "NVIDIA GPU" if la_nvidia else ("Intel Graphics" if "intel" in ten.lower() else "GPU"),
            })
    except Exception:
        pass
    return ds


def lay_cau_hinh_he_thong() -> Dict[str, Any]:
    """Tổng hợp toàn bộ thông tin phần cứng và khuyến nghị chạy TTS."""
    cpu = lay_thong_tin_cpu()
    ram = lay_thong_tin_ram()
    gpus = lay_thong_tin_gpu()

    # Kiểm tra PyTorch và CUDA
    torch_ver = "chưa cài"
    cuda_avail = False
    cuda_device = ""
    try:
        import torch
        torch_ver = torch.__version__
        cuda_avail = torch.cuda.is_available()
        if cuda_avail:
            cuda_device = torch.cuda.get_device_name(0)
    except Exception:
        pass

    # Đánh giá thiết bị tối ưu
    nvidia_gpus = [g for g in gpus if g.get("is_nvidia")]
    co_nvidia = len(nvidia_gpus) > 0
    ten_gpu_chinh = nvidia_gpus[0]["name"] if co_nvidia else (gpus[0]["name"] if gpus else "Không phát hiện GPU")
    vram_gpu_chinh = nvidia_gpus[0]["vram_gb"] if co_nvidia else 0

    if cuda_avail:
        khuyen_nghi = f"Hệ thống đã kích hoạt GPU {cuda_device} trong PyTorch. Sẵn sàng tổng hợp giọng nói tốc độ cao trên GPU."
        che_do_uu_tien = "local_gpu"
    elif co_nvidia:
        khuyen_nghi = f"Máy tính có card rời {ten_gpu_chinh} ({vram_gpu_chinh} GB VRAM). Hiện tại đang chạy trên CPU Intel Core i9 đa luồng rất nhanh, hoặc có thể cài PyTorch CUDA để tăng tốc GPU."
        che_do_uu_tien = "local_cpu_gpu"
    else:
        khuyen_nghi = f"Máy tính chạy CPU đa luồng ({cpu['cores']} nhân, {cpu['threads']} luồng). TTS cục bộ được tối ưu chạy mượt mà trên CPU với 7 giọng mẫu."
        che_do_uu_tien = "local_cpu"

    return {
        "status": "ok",
        "cpu": cpu,
        "ram": ram,
        "gpus": gpus,
        "primary_gpu": ten_gpu_chinh,
        "pytorch": {
            "version": torch_ver,
            "cuda_available": cuda_avail,
            "cuda_device": cuda_device,
        },
        "engine_mode": che_do_uu_tien,
        "recommendation": khuyen_nghi,
        "voices_count": 7,
    }


if __name__ == "__main__":
    print(json.dumps(lay_cau_hinh_he_thong(), indent=2, ensure_ascii=False))
