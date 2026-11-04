# HƯỚNG DẪN CÀI ĐẶT VÀ VẬN HÀNH HỆ THỐNG
## VoiceLab Studio & OmDiOm VN Studio (Đề tài 10 · Nhận dạng mẫu)

Tài liệu này cung cấp hướng dẫn chi tiết từng bước để cài đặt môi trường, chuẩn bị trọng số mô hình `OmDiOm-ft-4000` / `OmniVoice` và vận hành toàn bộ 2 giao diện đồ họa phục vụ nghiên cứu và trải nghiệm thực tế.

---

## MỤC LỤC
1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Yêu cầu môi trường & Runtime tương thích](#2-yêu-cầu-môi-trường--runtime-tương-thích)
3. [Chuẩn bị Trọng số Mô hình (Model Checkpoints)](#3-chuẩn-bị-trọng-số-mô-hình-model-checkpoints)
4. [Phương thức Khởi chạy 1: Chạy cục bộ hoàn toàn (Local GPU / CPU)](#4-phương-thức-khởi-chạy-1-chạy-cục-bộ-hoàn-toàn-local-gpu--cpu)
5. [Phương thức Khởi chạy 2: Chạy qua Kaggle GPU T4 miễn phí (Khuyến nghị)](#5-phương-thức-khởi-chạy-2-chạy-qua-kaggle-gpu-t4-miễn-phí-khuyến-nghị)
6. [Cẩm nang sử dụng Giao diện 1: VoiceLab Studio (Port 8765)](#6-cẩm-nang-sử-dụng-giao-diện-1-voicelab-studio-port-8765)
7. [Cẩm nang sử dụng Giao diện 2: OmDiOm Studio (Port 8000)](#7-cẩm-nang-sử-dụng-giao-diện-2-omdiom-studio-port-8000)
8. [Xử lý sự cố thường gặp (Troubleshooting)](#8-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Tổng quan hệ thống

Kho mã nguồn tích hợp 2 phân hệ độc lập nhưng tương hỗ chặt chẽ:

| Phân hệ | Cổng (Port) | Nhiệm vụ chính | Mô hình / Công nghệ |
|:---|:---:|:---|:---|
| **VoiceLab Studio** | `8765` | • Phát hiện giọng thật / giả (Deepfake Detection)<br>• Định danh 25 người nói VIVOS (Speaker Identification)<br>• Trích xuất 75 chiều đặc trưng âm học ($F_1, F_2, F_3$)<br>• Trực quan hóa sóng âm & phổ thời gian thực | • SVM RBF (75 chiều)<br>• Gaussian Naive Bayes (52 chiều)<br>• Librosa + SoundFile DSP |
| **OmDiOm Studio** | `8000` | • Tổng hợp giọng nói tiếng Việt Zero-Shot<br>• Nhân bản giọng nói theo tệp mẫu bất kỳ<br>• Điều khiển biểu cảm ngữ âm tiếng Việt<br>• Thiết kế giọng nói tùy biến theo yêu cầu | • OmniVoice Flow Matching ODE<br>• OmDiOm-ft (Checkpoint 4000)<br>• HiggsAudioV2 Codec (DAC + HuBERT) |

---

## 2. Yêu cầu môi trường & Runtime tương thích

### 2.1. Cấu hình đề nghị
- **Hệ điều hành:** Windows 10/11 (64-bit) hoặc Ubuntu 20.04/22.04 LTS.
- **Python:** Phiên bản **`3.10`**, **`3.11`** hoặc **`3.12`** (64-bit).
- **Phần cứng:**
  - *Để chạy VoiceLab (Phân tích & Nhận dạng):* Bất kỳ máy tính nào có CPU Intel/AMD, RAM tối thiểu 4 GB.
  - *Để chạy OmDiOm TTS cục bộ:* Card đồ họa NVIDIA có **VRAM ≥ 6 GB** (GTX 1660 Ti, RTX 2060, RTX 3060, T4,...) cùng driver CUDA 11.8 hoặc CUDA 12.1+.
  - *Nếu không có GPU NVIDIA:* Sử dụng **Phương thức 2 (Kaggle GPU miễn phí)** bên dưới.

### 2.2. Cài đặt thư viện Python

Mở Terminal / PowerShell tại thư mục dự án `Voice-cloning`:

```bash
# 1. Tạo môi trường ảo (Khuyến nghị để tránh xung đột)
python -m venv venv

# Kích hoạt trên Windows:
.\venv\Scripts\activate
# Kích hoạt trên Linux / macOS:
# source venv/bin/activate

# 2. Cài đặt các gói cốt lõi cho VoiceLab & Giao diện Web
pip install -r requirements.txt

# 3. NẾU BẠN CHẠY SINH GIỌNG TTS CỤC BỘ (Cần PyTorch CUDA):
# Với card NVIDIA CUDA 12.1+:
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
# Với card NVIDIA CUDA 11.8:
# pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
# Nếu chỉ chạy CPU:
# pip install torch torchaudio

# Cài đặt thư viện động cơ OmniVoice:
pip install omnivoice==0.2.1 transformers>=4.44 accelerate
```

---

## 3. Chuẩn bị Trọng số Mô hình (Model Checkpoints)

Toàn bộ **100% tệp cấu hình, mẫu sinh, từ điển và bộ mã hóa âm thanh (Audio Tokenizer/Codec)** đã được đính kèm sẵn trong kho mã nguồn:
- `omdiom/models/omdiom/` (Kiến trúc OmDiOm-ft, `config.json`, `tokenizer.json` 11,4 MB, `chat_template.jinja`, `audio_tokenizer/`)
- `omdiom/models/OmniVoice/` (Kiến trúc OmniVoice Base)
- `voicelab/models/` (`svm_TA_tai_tao.joblib`, `nhan_dang_25_nguoi.joblib`)

### Vì sao tệp `.safetensors` không đưa trực tiếp lên Git?
Tệp trọng số mô hình có kích thước **~2,45 GB** (`model.safetensors`) và **~805 MB** (`audio_tokenizer/model.safetensors`). Do GitHub giới hạn dung lượng **100 MB/tệp**, các tệp nhị phân lớn này được quản lý qua script tải về hoặc chia sẻ liên kết ngoài.

### Cách lấy tệp trọng số:
1. **Tự động tải bản gốc (OmniVoice Base):**
   Chạy tệp `tai_model.bat` ở thư mục gốc (hoặc chạy lệnh `python omdiom/models/tai_trong_so.py`). Script sẽ tự động kết nối Hugging Face Hub (`k2-fsa/OmniVoice`) và tải đầy đủ 2 tệp `.safetensors` vào đúng thư mục `omdiom/models/OmniVoice/`.
2. **Đối với mô hình OmDiOm-ft-4000 (Fine-tuned Tiếng Việt):**
   - Đặt tệp `model.safetensors` của checkpoint 4000 vào thư mục:
     `omdiom/models/omdiom/model.safetensors`
   - Đặt tệp codec vào:
     `omdiom/models/omdiom/audio_tokenizer/model.safetensors` (tệp này dùng chung với codec của OmniVoice Base).
   - *Mẹo:* Nếu máy bạn đã chạy đồ án trước đó và có thư mục `D:\OmDiOm\models`, script `tai_model.bat` sẽ tự động nhận diện và tạo liên kết (hardlink) trong 1 giây mà không cần tải lại!

---

## 4. Phương thức Khởi chạy 1: Chạy cục bộ hoàn toàn (Local GPU / CPU)

Sau khi cài đặt thư viện và chuẩn bị trọng số:

```bash
# Lựa chọn A: Khởi động cả 2 hệ sinh thái cùng lúc
.\chay_tat_ca.ps1

# Lựa chọn B: Khởi động bằng file .bat (Double-click trên Windows)
chay_omdiom.bat   # Mở OmDiOm Studio tại http://localhost:8000
chay_lab.bat      # Mở VoiceLab Studio tại http://localhost:8765
```

- Mở trình duyệt truy cập:
  - **VoiceLab:** [http://localhost:8765](http://localhost:8765)
  - **OmDiOm Studio:** [http://localhost:8000](http://localhost:8000)

---

## 5. Phương thức Khởi chạy 2: Chạy qua Kaggle GPU T4 miễn phí (Khuyến nghị)

Nếu máy tính cá nhân của bạn không có card đồ họa NVIDIA rời mạnh (ví dụ chỉ có card Intel Onboard, máy Mac, hoặc GPU yếu dưới 6 GB VRAM), bạn hoàn toàn có thể chạy backend trên **GPU Tesla T4 miễn phí của Kaggle**:

### Các bước thực hiện:
1. Truy cập [Kaggle](https://www.kaggle.com/) và tạo một Notebook mới.
2. Nhấn **File** → **Import Notebook** → Tải lên tệp:
   `omdiom/kaggle/OmDiOm.ipynb` (có sẵn trong repo này).
3. Trong bảng điều khiển bên phải của Kaggle Notebook:
   - **Accelerator:** Chọn **GPU T4 × 2** (hoặc GPU T4 × 1).
   - **Internet:** Bật **On** (bắt buộc để tải thư viện và mở tunnel).
4. Nhấn **Run All** (hoặc chạy lần lượt các ô từ 0 đến 9).
5. Cuộn xuống **Ô 6 & Ô 7**: Bạn sẽ thấy một đường hầm Cloudflared Tunnel công khai được tạo tự động:
   ```text
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 🚀 MÁY CHỦ OMDIOM BACKEND ĐANG HOẠT ĐỘNG TRÊN KAGGLE GPU TESLA T4      │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 🌐 URL KẾT NỐI: https://random-subdomain.trycloudflare.com              │
   │ 🔑 MÃ PIN BẢO MẬT: 123456 (hoặc hiển thị trên màn hình)                 │
   └────────────────────────────────────────────────────────────────────────┘
   ```
6. **Kết nối vào Giao diện trên máy bạn:**
   - Mở giao diện VoiceLab ([http://localhost:8765](http://localhost:8765)) hoặc OmDiOm ([http://localhost:8000](http://localhost:8000)).
   - Tại thanh cấu hình Server TTS, dán đường dẫn Cloudflare URL vừa nhận được vào ô URL và nhập API Key / PIN.
   - Bấm **Kiểm tra kết nối** → Đèn báo sẽ chuyển sang **Xanh lá (☁️ Đã kết nối Kaggle GPU T4)**. Mọi tác vụ sinh giọng sẽ được xử lý siêu tốc trên GPU của Kaggle và phát ngay trên máy tính của bạn!

---

## 6. Cẩm nang sử dụng Giao diện 1: VoiceLab Studio (Port 8765)

VoiceLab là công cụ phân tích âm học và giám định tính xác thực của giọng nói dựa trên không gian đặc trưng 75 chiều:

```
+-------------------------------------------------------------------------+
| [LOGO] OMDIOM LAB STUDIO           Đèn trạng thái: Đã kết nối Cổng 8765 |
+-------------------------------------------------------------------------+
|  [Tab Tải tệp]   [Tab Micro]                                            |
|  +-------------------------------------------------------------------+  |
|  |           Kéo thả tệp âm thanh (WAV, FLAC, MP3, OGG)              |  |
|  |           Hỗ trợ tệp tới 120 MB - Tự động cắt 30s phân tích       |  |
|  +-------------------------------------------------------------------+  |
|  [ Nút: Phân tích mẫu giọng & Nhận dạng 75 chiều ]                      |
|                                                                         |
|  KẾT QUẢ GIÁM ĐỊNH:                                                     |
|  +-------------------------------+  +--------------------------------+  |
|  | PHÂN LOẠI: THẬT / GIẢ (DEEPFAKE)|  | ĐỊNH DANH NGƯỜI NÓI (TOP 5)   |  |
|  | SVM RBF: 98.4% Thật           |  | Gaussian NB: VIVOSSPK01 (89%)  |  |
|  +-------------------------------+  +--------------------------------+  |
|  SÓNG ÂM TƯƠNG TÁC THỜI GIAN THỰC & BẢNG 75 CHIỀU ĐẶC TRƯNG ÂM HỌC       |
+-------------------------------------------------------------------------+
```

### Các bước thao tác:
1. **Nạp âm thanh:**
   - Cách A: Kéo thả một tệp âm thanh (WAV, FLAC, MP3, WebM) vào khung tải tệp.
   - Cách B: Chọn tab **Thu âm Micro**, bấm nút ghi âm trực tiếp giọng nói của bạn trong 3–10 giây.
   - Cách C: Nhấp vào các mẫu âm thanh có sẵn (*Mẫu giọng thật VIVOS* hoặc *Mẫu giọng nhân bản OmDiOm*).
2. **Phân tích:** Nhấn nút **Phân tích mẫu giọng & Nhận dạng**.
3. **Đọc kết quả:**
   - **Thẻ Kết luận Thật / Giả (Deepfake Detection):** Hiển thị nhãn phân loại (THẬT hay GIẢ MẠO), kèm thang đo xác suất (%) tính từ khoảng cách hình học tới siêu phẳng phân cách của mô hình SVM RBF.
   - **Thẻ Nhận dạng Người nói (Speaker ID):** Dự đoán danh tính của người nói trong số 25 người nói tiếng Việt thuộc tập chuẩn VIVOS, kèm bảng xếp hạng xác suất Top-5.
   - **Sóng âm động & Phổ âm thanh:** Canvas trực quan hóa biên độ sóng âm thực tế chuyển động đồng bộ theo thời gian phát âm thanh.
   - **Bảng 75 chiều đặc trưng âm học:** Nhấn nút **Xem toàn bộ 75 chiều đặc trưng** để tra cứu chi tiết giá trị của từng hệ số:
     - 39 chiều MFCC + Delta + Delta-Delta.
     - 24 chiều Spectral (Centroid, Rolloff 85%, Rolloff 95%, Flatness, Octave Contrast).
     - 12 chiều Prosody & Energy (RMS Energy, ZCR, Pitch $F_0$, Voice Activity).

---

## 7. Cẩm nang sử dụng Giao diện 2: OmDiOm Studio (Port 8000)

OmDiOm Studio là trạm điều khiển tổng hợp và nhân bản giọng nói chuyên nghiệp:

### 7.1. Chế độ 1: Tổng hợp giọng chuẩn (Text-to-Speech)
1. Chọn một trong **7 giọng tham chiếu tiếng Việt chuẩn**:
   - `Cao_Hùng` (Nam miền Bắc, truyền cảm, tin tức)
   - `Út_Linh` (Nữ miền Nam, ngọt ngào, kể chuyện)
   - `Linh_Dục_Tú` (Nữ miền Bắc, thanh thoát)
   - `Minh_Quý` (Nam miền Nam, ấm áp)
   - `Phương_Thy` (Nữ miền Trung, dịu dàng)
   - `Tô_Thành` (Nam miền Bắc, chững chạc)
   - `Minh_Nhí` (Nam miền Nam, hoạt bát)
2. Nhập văn bản tiếng Việt cần đọc vào ô nội dung.
3. Chèn các **Thẻ cảm xúc tiếng Việt** để biểu đạt sắc thái tự nhiên:
   - `[cười]` / `[cuoi]`: Thêm tiếng cười khúc khích tự nhiên.
   - `[thở dài]` / `[tho dai]`: Thể hiện tiếng thở dài trầm lắng.
   - `[ngạc nhiên]` / `[tram tro]`: Ngữ điệu trầm trồ, ngạc nhiên.
   - `[nghi vấn]` / `[thắc mắc]`: Ngữ điệu thắc mắc, hỏi han.
4. Điều chỉnh thanh trượt:
   - **Tốc độ đọc (Speed):** 0.8× (chậm) đến 1.5× (nhanh).
   - **Độ định hướng (Guidance Scale):** 1.5 – 3.0 (càng cao giọng càng bám sát phong cách mẫu).
   - **Số bước khuếch tán (Steps):** 8 bước (tốc độ cao) hoặc 16–32 bước (chất lượng studio).
5. Bấm **Tạo âm thanh ngay** để nhận bản thu.

### 7.2. Chế độ 2: Nhân bản giọng nói Zero-Shot (Voice Cloning)
1. Chuyển sang thẻ **Nhân bản giọng (Clone Voice)**.
2. Tải lên một đoạn ghi âm giọng mẫu của bất kỳ ai (chỉ cần từ **3 đến 10 giây**, ghi âm rõ tiếng, ít tạp âm).
3. Nhập câu văn bản mới mà bạn muốn người đó nói.
4. Bấm **Nhân bản giọng nói**: Hệ thống sẽ trích xuất mã âm học (prompt embedding) của giọng mẫu trong tích tắc và tổng hợp nội dung mới đúng âm sắc, ngữ điệu và cao độ của người đó.

### 7.3. Chế độ 3: Thiết kế giọng nói (Voice Design)
- Tự tạo ra một chất giọng chưa từng tồn tại bằng cách nhập mô tả bằng văn bản tiếng Việt hoặc tiếng Anh (ví dụ: *"giọng nữ trẻ, thanh thiếu niên, tông cao, thì thầm"* hoặc *"male, elderly, low pitch"*).

---

## 8. Xử lý sự cố thường gặp (Troubleshooting)

### ❓ Lỗi 1: Giao diện báo `Failed to fetch` màu đỏ
- **Nguyên nhân:**
  1. Bạn đang mở giao diện bằng cách nhấp đúp trực tiếp vào tệp `index.html` (đường dẫn dạng `file:///C:/...`). Trình duyệt chặn gọi API từ tệp tĩnh.
  2. Hoặc máy chủ backend chưa được khởi chạy.
- **Khắc phục:**
  - Khởi động server bằng cách chạy `chay_lab.bat` (hoặc `chay_omdiom.bat`).
  - Mở trình duyệt và truy cập đúng địa chỉ: [http://localhost:8765](http://localhost:8765) hoặc [http://localhost:8000](http://localhost:8000).

### ❓ Lỗi 2: `FileNotFoundError: Không tìm thấy model.safetensors`
- **Nguyên nhân:** Thiếu tệp trọng số nhị phân lớn trong thư mục `omdiom/models/`.
- **Khắc phục:**
  - Chạy tệp `tai_model.bat` ở thư mục gốc để nạp trọng số.
  - Hoặc nếu máy bạn có sẵn `D:\OmDiOm\models`, script sẽ tự động liên kết ngay lập tức.
  - Hoặc sử dụng giải pháp chạy trên Kaggle GPU (Mục 5).

### ❓ Lỗi 3: `CUDA out of memory` (Tràn bộ nhớ VRAM card đồ họa)
- **Nguyên nhân:** Mô hình OmniVoice cần khoảng 4–5 GB VRAM để suy luận với float16. Nếu bạn mở ứng dụng nặng khác hoặc VRAM card dưới 6 GB sẽ bị tràn bộ nhớ.
- **Khắc phục:**
  - Giảm tham số `Số bước (Steps)` xuống `16` hoặc `8`.
  - Giảm độ dài câu văn bản (chia nhỏ văn bản thành các câu dưới 200 ký tự).
  - Hoặc chuyển sang sử dụng Kaggle GPU T4 miễn phí (VRAM 16 GB).

### ❓ Lỗi 4: Không giải mã được âm thanh MP3/M4A lạ
- **Nguyên nhân:** Máy tính chưa cài đặt `ffmpeg`.
- **Khắc phục:** Cài đặt FFmpeg trên Windows bằng lệnh winget: `winget install Gyan.FFmpeg` hoặc tải bản zip từ [ffmpeg.org](https://ffmpeg.org/) và thêm vào biến môi trường PATH.

---
*Nhóm 05 · Môn Nhận dạng mẫu · Phân hiệu Đại học Thủy Lợi - TP.HCM*
