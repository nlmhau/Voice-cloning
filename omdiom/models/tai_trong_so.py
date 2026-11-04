"""
Script tự động tải và đồng bộ trọng số mô hình lớn (.safetensors) cho OmDiOm & OmniVoice.
Do GitHub giới hạn tệp tối đa 100 MB (trong khi model.safetensors là ~2.45 GB và audio_tokenizer là ~805 MB),
kho mã nguồn đã lưu sẵn 100% tệp cấu hình (config.json, tokenizer.json 11.4MB, chat_template.jinja, audio_tokenizer config).
Script này giúp người dùng tải hoặc liên kết trọng số nhị phân chỉ với 1 click.
"""

import os
import sys
import shutil
import argparse

sys.stdout.reconfigure(encoding='utf-8')

MODELS_DIR = os.path.dirname(os.path.abspath(__file__))
OMDIOM_DIR = os.path.join(MODELS_DIR, "omdiom")
OMNIVOICE_DIR = os.path.join(MODELS_DIR, "OmniVoice")

def kiem_tra_trong_so_hien_co():
    omdiom_ok = os.path.exists(os.path.join(OMDIOM_DIR, "model.safetensors")) and \
                os.path.exists(os.path.join(OMDIOM_DIR, "audio_tokenizer", "model.safetensors"))
    omni_ok = os.path.exists(os.path.join(OMNIVOICE_DIR, "model.safetensors")) and \
              os.path.exists(os.path.join(OMNIVOICE_DIR, "audio_tokenizer", "model.safetensors"))
    return omdiom_ok, omni_ok

def lien_ket_tu_nguon_cuc_bo():
    """Nếu máy tính đã có sẵn thư mục D:\\OmDiOm\\models, tự động sao chép hoặc liên kết"""
    cac_nguon_cuc_bo = [
        r"D:\OmDiOm\models",
        r"C:\OmDiOm\models",
        os.path.expanduser(r"~\OmDiOm\models")
    ]
    for src in cac_nguon_cuc_bo:
        if os.path.isdir(src):
            print(f"[*] Phát hiện kho mô hình cục bộ tại: {src}")
            for model_name in ["omdiom", "OmniVoice"]:
                src_model = os.path.join(src, model_name)
                dst_model = os.path.join(MODELS_DIR, model_name)
                if not os.path.isdir(src_model):
                    continue
                # 1. Trọng số chính
                src_weight = os.path.join(src_model, "model.safetensors")
                dst_weight = os.path.join(dst_model, "model.safetensors")
                if os.path.exists(src_weight) and not os.path.exists(dst_weight):
                    print(f" -> Đang liên kết model.safetensors cho {model_name}...")
                    try:
                        os.link(src_weight, dst_weight)
                        print(f"    ✓ Đã tạo hardlink thành công (không tốn thêm ổ cứng)!")
                    except Exception:
                        shutil.copy2(src_weight, dst_weight)
                        print(f"    ✓ Đã sao chép trọng số {model_name} thành công!")

                # 2. Trọng số audio_tokenizer
                src_tok = os.path.join(src_model, "audio_tokenizer", "model.safetensors")
                dst_tok = os.path.join(dst_model, "audio_tokenizer", "model.safetensors")
                if os.path.exists(src_tok) and not os.path.exists(dst_tok):
                    os.makedirs(os.path.dirname(dst_tok), exist_ok=True)
                    print(f" -> Đang liên kết audio_tokenizer cho {model_name}...")
                    try:
                        os.link(src_tok, dst_tok)
                        print(f"    ✓ Đã tạo hardlink audio_tokenizer thành công!")
                    except Exception:
                        shutil.copy2(src_tok, dst_tok)
                        print(f"    ✓ Đã sao chép audio_tokenizer thành công!")
            return True
    return False

def tai_tu_huggingface():
    """Tải trọng số gốc k2-fsa/OmniVoice từ Hugging Face Hub"""
    print("\n[*] Đang kiểm tra và tải trọng số từ Hugging Face (k2-fsa/OmniVoice)...")
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("[!] Chưa cài đặt huggingface_hub. Đang tự động cài đặt...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
        from huggingface_hub import hf_hub_download

    repo_id = "k2-fsa/OmniVoice"
    files = [
        ("model.safetensors", os.path.join(OMNIVOICE_DIR, "model.safetensors")),
        ("audio_tokenizer/model.safetensors", os.path.join(OMNIVOICE_DIR, "audio_tokenizer", "model.safetensors"))
    ]

    for filename, dest in files:
        if os.path.exists(dest) and os.path.getsize(dest) > 100 * 1024 * 1024:
            print(f" ✓ Đã có sẵn: {filename} ({os.path.getsize(dest)/(1024*1024):.1f} MB)")
            continue
        print(f" -> Đang tải {filename} từ {repo_id} (~2.4 GB / 800 MB)...")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        down_path = hf_hub_download(repo_id=repo_id, filename=filename)
        shutil.copy2(down_path, dest)
        print(f" ✓ Tải hoàn tất: {filename}")

    # Nếu omdiom chưa có trọng số, có thể dùng trọng số gốc hoặc hướng dẫn
    dst_omdiom = os.path.join(OMDIOM_DIR, "model.safetensors")
    dst_omni = os.path.join(OMNIVOICE_DIR, "model.safetensors")
    if not os.path.exists(dst_omdiom) and os.path.exists(dst_omni):
        print("\n[*] Ghi chú cho OmDiOm (Vietnamese Fine-tuned):")
        print("    Mô hình OmDiOm-ft được tinh chỉnh trên ngữ liệu VIVOS (checkpoint-4000).")
        print("    Bạn có thể dùng chung trọng số OmniVoice gốc để chạy TTS ngay lập tức,")
        print("    hoặc đặt tệp model.safetensors của checkpoint-4000 vào thư mục omdiom/models/omdiom/.")

def main():
    print("=" * 70)
    print("  BỘ QUẢN LÝ VÀ ĐỒNG BỘ TRỌNG SỐ MÔ HÌNH (OMDIOM & OMNIVOICE)")
    print("=" * 70)

    omdiom_ok, omni_ok = kiem_tra_trong_so_hien_co()
    print(f"Trạng thái hiện tại:")
    print(f" - OmDiOm (Fine-tuned): {'✓ ĐÃ CÓ ĐỦ TRỌNG SỐ' if omdiom_ok else 'Chưa có file safetensors (>2.4GB)'}")
    print(f" - OmniVoice (Base):    {'✓ ĐÃ CÓ ĐỦ TRỌNG SỐ' if omni_ok else 'Chưa có file safetensors (>2.4GB)'}")

    if omdiom_ok and omni_ok:
        print("\n✓ Tất cả trọng số đã sẵn sàng! Bạn có thể khởi chạy hệ thống ngay qua 'chay_omdiom.bat' hoặc 'chay_lab.bat'.")
        return

    # 1. Thử liên kết từ kho cục bộ nếu có
    if lien_ket_tu_nguon_cuc_bo():
        omdiom_ok, omni_ok = kiem_tra_trong_so_hien_co()
        if omdiom_ok and omni_ok:
            print("\n✓ Đã đồng bộ thành công từ nguồn máy tính!")
            return

    # 2. Tải từ Hugging Face
    try:
        tai_tu_huggingface()
    except Exception as e:
        print(f"\n[!] Lỗi khi tải từ Hugging Face: {e}")
        print("Gợi ý: Bạn có thể chạy trên Kaggle GPU miễn phí qua notebook 'omdiom/kaggle/OmDiOm.ipynb'")
        print("hoặc sao chép thủ công 'model.safetensors' vào thư mục 'omdiom/models/'.")

if __name__ == "__main__":
    main()
