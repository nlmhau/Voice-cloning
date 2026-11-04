# THƯ MỤC MÔ HÌNH VÀ BỘ MÃ HÓA ÂM THANH (OMDIOM & OMNIVOICE)

Thư mục này quản lý toàn bộ các mô hình tổng hợp tiếng nói tiếng Việt, mô hình nền tảng OmniVoice và các bộ mã hóa âm thanh (Audio Tokenizer/Codec).

---

## 1. Cấu trúc thư mục

```
omdiom/models/
├── active_model.txt               # Chỉ định mô hình đang kích hoạt mặc định ("omdiom" hoặc "omnivoice")
├── tai_trong_so.py                # Script tự động đồng bộ / tải trọng số nhị phân lớn
├── tai_trong_so.bat               # File chạy nhanh 1-click trên Windows
│
├── omdiom/                        # Mô hình OmDiOm tinh chỉnh (Vietnamese Fine-tuned Checkpoint 4000)
│   ├── config.json                # Cấu hình kiến trúc mạng
│   ├── tokenizer.json (11.4 MB)   # Bộ từ vựng và mã hóa ngôn ngữ
│   ├── tokenizer_config.json      # Siêu tham số tokenizer
│   ├── chat_template.jinja        # Mẫu prompt ngữ cảnh
│   └── audio_tokenizer/           # HiggsAudioV2 Audio Tokenizer (Codec)
│       ├── config.json
│       ├── preprocessor_config.json
│       └── README.md
│
└── OmniVoice/                     # Mô hình nền tảng OmniVoice gốc
    ├── config.json
    ├── tokenizer.json (11.4 MB)
    ├── tokenizer_config.json
    ├── chat_template.jinja
    └── audio_tokenizer/
        ├── config.json
        └── preprocessor_config.json
```

---

## 2. Lưu ý về Trọng số Nhị phân (.safetensors)

- **Tại sao không đưa trực tiếp file `model.safetensors` vào Git?**
  Mỗi tệp `model.safetensors` có kích thước **~2,45 GB** và codec `audio_tokenizer/model.safetensors` là **~805 MB**. GitHub có giới hạn nghiêm ngặt **tối đa 100 MB / tệp** (gói Git LFS miễn phí chỉ hỗ trợ tối đa 1 GB lưu trữ toàn bộ repo), do đó việc commit file 2,45 GB sẽ bị máy chủ GitHub từ chối.
- **Giải pháp:**
  Toàn bộ 100% tệp kiến trúc, cấu hình, mã hóa từ điển (`tokenizer.json` 11,4 MB), bộ mã hóa âm thanh và mẫu sinh **đã được lưu trữ sẵn trong repo**.
  Để nạp trọng số nhị phân:
  1. **Chạy tự động:** Nhấp đúp vào `tai_model.bat` ở thư mục gốc hoặc chạy `python omdiom/models/tai_trong_so.py`. Script sẽ tự động phát hiện nếu máy bạn đã có thư mục `D:\OmDiOm\models` và tạo liên kết tức thì (không tốn thêm dung lượng ổ cứng), hoặc tải trực tiếp từ Hugging Face Hub (`k2-fsa/OmniVoice`).
  2. **Chạy trên Kaggle GPU (Không cần tải về máy):** Mở notebook `omdiom/kaggle/OmDiOm.ipynb` trên Kaggle, bật GPU T4 và chạy để khởi động server TTS đám mây. Giao diện OmDiOm và VoiceLab trên máy tính của bạn sẽ kết nối vào GPU Kaggle thông qua đường hầm Cloudflare Tunnel.
