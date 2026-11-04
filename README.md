# Bài tập lớn cuối kỳ – Môn Nhận dạng mẫu
## Nhóm 05 · Đề tài 10: Nhận dạng người nói và phân biệt giọng thật / giọng nhân bản tiếng Việt
### (Speaker Identification & DeepFake Voice Detection)

| Thành viên | MSSV | Lớp | Vai trò phụ trách |
| :--- | :--- | :--- | :--- |
| **Nguyễn Lê Minh Hậu** | `2351267261` | `65-TTNT` | Pipeline dữ liệu, tiền xử lý, trích xuất 75 đặc trưng, thực nghiệm T-A |
| **Phạm Thành Doanh** | `2351267258` | `65-TTNT` | Mô hình phân lớp (SVM, k-NN, GNB, RF), đánh giá chỉ số, phân tích lỗi |
| **Lê Văn Quang** | `2351267277` | `65-TTNT` | Sinh giọng nhân bản (OmniVoice/OmDiOm), giao diện VoiceLab & OmDiOm Studio, báo cáo |

---

## 1. Giới thiệu bài toán & Mục tiêu nghiên cứu

Trong bối cảnh công nghệ tổng hợp và nhân bản giọng nói (Zero-Shot Voice Cloning) bằng học sâu phát triển vượt bậc, âm thanh sinh ra ngày càng tự nhiên và khó phân biệt bằng tai người thường. Đề tài tiếp cận vấn đề dưới góc độ **Nhận dạng mẫu (Pattern Recognition)** thông qua hai bài toán khoa học cốt lõi:

1. **Bài toán A (Nhận dạng người nói - Speaker Identification):** Phân lớp tập đóng 25 mã người nói tiếng Việt từ kho ngữ liệu chuẩn VIVOS. Kiểm chứng xem đặc trưng âm học nào cho phép định danh chính xác người nói.
2. **Bài toán B (Phân loại Thật / Giả - DeepFake Detection / T-A):** Phân loại nhị phân giữa bản ghi âm giọng thật của con người và âm thanh do mạng nơ-ron tổng hợp. Phân chia độc lập người nói (Speaker-independent: 18 người train, 7 người test) để đảm bảo mô hình nhận dạng dấu vết sinh âm thanh chứ không nhận diện người nói.
3. **Thí nghiệm tấn công clone (Clone Mimicry Attack):** Đưa âm thanh tổng hợp từ 3 bộ sinh vào mô hình nhận dạng người nói của Bài toán A để kiểm chứng: *Giọng nhân bản có thực sự đánh lừa được hệ thống nhận dạng để gán đúng vào mã danh tính của người bị clone hay không?*

---

## 2. Kiến trúc 75 chiều đặc trưng âm học ($F_1, F_2, F_3$)

Toàn bộ các tệp âm thanh được quy chuẩn hóa về **16 kHz Mono**, loại bỏ khoảng lặng thừa đầu/cuối bằng VAD trước khi trích xuất vector đặc trưng cố định 75 chiều (`bo_trich_dac_trung.py`):

```text
               TỔNG HỢP 75 CHIỀU ĐẶC TRƯNG ÂM HỌC
┌──────────────────────────────────────────────────────────────────┐
│ F₁ (52 chiều): MFCC & Delta                                     │
│  • 13 hệ số MFCC bậc 0-12 (Mean + Std = 26 chiều)                │
│  • 13 hệ số Delta bậc 1 (Mean + Std = 26 chiều)                  │
├──────────────────────────────────────────────────────────────────┤
│ F₂ (18 chiều): Cấu trúc phổ âm thanh (Spectral Features)        │
│  • Trọng tâm phổ (Centroid Mean + Std = 2 chiều)                 │
│  • Băng thông phổ (Bandwidth Mean + Std = 2 chiều)               │
│  • Tần số Rolloff 95% (Mean + Std = 2 chiều)                     │
│  • Độ phẳng phổ (Flatness Mean + Std = 2 chiều)                  │
│  • Tỷ lệ năng lượng 5 dải phổ (Sub-bands 0-8kHz = 10 chiều)      │
├──────────────────────────────────────────────────────────────────┤
│ F₃ (5 chiều): Năng lượng & Nhịp điệu (Energy & Temporal)         │
│  • Thời lượng clip sau cắt (Duration = 1 chiều)                  │
│  • Tỷ lệ khoảng lặng VAD (Silence Ratio = 1 chiều)               │
│  • Độ biến thiên khung âm lượng (Frame RMS Std = 1 chiều)        │
│  • Tần số đổi dấu sóng âm (ZCR Mean + Std = 2 chiều)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Dữ liệu thực nghiệm & 3 Bộ sinh giọng đối chứng

* **Dữ liệu thật (Ground Truth):** 25 người nói từ bộ dữ liệu **VIVOS** (AILAB - ĐH Khoa học Tự nhiên TP.HCM, giấy phép CC BY-NC-SA 4.0), mỗi người có ít nhất 6 câu chuẩn âm sắc.
* **3 Bộ sinh giọng nhân bản đối chứng (Synthetic Generators):**
  1. `OmniVoice` (k2-fsa): Mô hình nền tảng Flow Matching ODE Zero-Shot mã nguồn mở (Apache-2.0).
  2. `OmDiOm-ft-4000`: Phiên bản OmniVoice được tinh chỉnh (fine-tuned) 4.000 bước trên ngữ liệu tiếng Việt.
  3. `VieNeu-TTS`: Mô hình âm thanh tiếng Việt dựa trên kiến trúc nơ-ron đối chứng độc lập.
* **Quy mô tập mẫu T-A:** 370 nhóm câu hoàn chỉnh $\times$ 4 nguồn = **1.480 clip âm thanh**.

---

## 4. Kết quả thực nghiệm chính

### 4.1. Phân biệt giọng Thật / Giả (Bài toán B - Bước 3 & Bước 7a)
Phân chia độc lập theo người nói (18 người train, 7 người test - 420 clip test):

| Mô hình phân loại | Tập kiểm thử | Accuracy | Balanced Acc | Macro Precision | Macro Recall | Macro F1 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **SVM RBF ($C=1$, Balanced)** ★ | **Toàn bộ 420 clip test** | **96,19%** | **95,24%** | **95,84%** | **95,24%** | **94,95%** |
| Random Forest (150 trees) | Toàn bộ 420 clip test | 94,05% | 91,43% | 93,52% | 91,43% | 92,27% |
| Gaussian Naive Bayes | Toàn bộ 420 clip test | 91,90% | 89,52% | 90,01% | 89,52% | 89,76% |
| k-Nearest Neighbors ($k=5$) | Toàn bộ 420 clip test | 93,57% | 90,95% | 92,84% | 90,95% | 91,73% |

> **Nhận xét:** SVM với hàm nhân RBF đạt hiệu quả phân loại tối ưu trên không gian 75 chiều đặc trưng, ma trận nhầm lẫn cho thấy khả năng phát hiện mẫu giả đạt độ chính xác gần như tuyệt đối ($>98\%$).

### 4.2. Nhận dạng người nói & Thử nghiệm tấn công Clone (Bài toán A - Bước 6)
Huấn luyện trên 295 câu thật của 25 người, kiểm thử trên 75 câu thật (3 câu/người) và 225 câu nhân bản:

* **Độ chính xác nhận dạng trên giọng thật:** **Gaussian Naive Bayes** đạt **93,33% (70/75 câu đúng)** trên tập test độc lập, vượt qua k-NN (88,00%) và SVM RBF (89,33%).
* **Tỷ lệ gán đúng mã người nói khi đưa giọng Clone vào (Attack Accuracy):**
  * `OmDiOm-ft-4000`: **61,33%** clip clone bị bộ nhận dạng gán vào đúng người được nhân bản.
  * `OmniVoice gốc`: **54,67%** clip clone bị gán đúng mã người nói.
  * `VieNeu-TTS`: **37,33%** clip clone bị gán đúng mã.

> **Kết luận:** Mô hình tinh chỉnh tiếng Việt `OmDiOm` tái tạo đặc trưng âm sắc người nói tốt nhất, khiến bộ nhận dạng cổ điển bị đánh lừa với tỷ lệ cao nhất (61,33%).

### 4.3. Kiểm định chủ quan (Nghe mù - Bước 4) & Chẩn đoán lỗi (Bước 5)
* Tiến hành nghe mù 14 bộ câu ẩn danh $\times$ 3 bộ sinh trên giao diện web độc lập.
* Chẩn đoán nguyên nhân các trường hợp OmniVoice đọc nuốt từ/sai dấu thanh do hiện tượng trôi pha trong quá trình giải phương trình vi phân Euler ODE.

---

## 5. Cấu trúc thư mục repository

```text
Voice-cloning/
├── README.md                      # Báo cáo chính thức Đề tài 10 · Phương án 2
├── requirements.txt               # Danh sách thư viện Python cần thiết
├── .gitignore                     # Bộ lọc loại trừ tệp rác, cache, checkpoint
├── chay_lab.ps1 (chay_lab.bat)    # Script khởi chạy nhanh VoiceLab Studio (Port 8765)
├── chay_omdiom.ps1 (.bat)         # Script khởi chạy nhanh OmDiOm Studio (Port 8000)
├── chay_tat_ca.ps1                # Khởi động đồng thời cả 2 hệ thống với 1 click
├── tai_model.bat                  # Script 1-click tải/đồng bộ trọng số mô hình TTS
│
├── voicelab/                      # [HỆ THỐNG 1] ỨNG DỤNG NHẬN DẠNG & PHÂN TÍCH ÂM HỌC
│   ├── app.py                     # Máy chủ backend Python (Port 8765, hỗ trợ 120MB, ffmpeg)
│   ├── index.html                 # Giao diện Web VoiceLab chuẩn Lab Studio (Sóng âm thời gian thực)
│   ├── bo_trich_dac_trung.py      # Bộ trích xuất 75 chiều đặc trưng âm học
│   ├── chay_demo.ps1              # Script chạy riêng cho VoiceLab
│   ├── THONG_TIN_MO_HINH.json     # Siêu dữ liệu mô hình & mã băm SHA-256
│   ├── models/                    # Trọng số mô hình Machine Learning đã huấn luyện
│   │   ├── svm_TA_tai_tao.joblib      # SVM RBF (75 chiều) - Phân loại Thật / Giả
│   │   └── nhan_dang_25_nguoi.joblib  # Gaussian NB (52 chiều) - Nhận dạng 25 người nói
│   └── examples/                  # Clip âm thanh mẫu thử nghiệm nhanh
│       ├── vivos_that.flac        # Mẫu giọng thật VIVOS
│       └── omdiom_gia.flac        # Mẫu giọng nhân bản OmDiOm
│
├── omdiom/                        # [HỆ THỐNG 2] MÁY CHỦ TỔNG HỢP & NHÂN BẢN GIỌNG NÓI GPU
│   ├── models/                    # Thư mục cấu hình mô hình & Codec âm học (OmDiOm & OmniVoice)
│   │   ├── omdiom/                # Kiến trúc, config, tokenizer (11.4MB), HiggsAudioV2 codec
│   │   ├── OmniVoice/             # Kiến trúc gốc, config, tokenizer, HiggsAudioV2 codec
│   │   ├── active_model.txt       # Cấu hình kích hoạt mô hình mặc định
│   │   └── tai_trong_so.py (.bat) # Script đồng bộ / tải trọng số nhị phân
│   ├── kaggle/                    # Notebook chạy backend OmDiOm trên Kaggle GPU miễn phí
│   │   └── OmDiOm.ipynb           # Khởi động server Cloudflare Tunnel kết nối UI
│   ├── server/                    # FastAPI Backend (Port 8000)
│   │   ├── app.py                 # API Router, streaming âm thanh
│   │   ├── engine.py              # Động cơ OmniVoice Flow Matching ODE (Tự động dò trọng số)
│   │   ├── system_info.py         # Giám sát phần cứng GPU/CPU/RAM
│   │   └── voices.py              # Quản lý giọng tham chiếu
│   ├── UI/                        # Giao diện Web Studio phân vai & nhân bản
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   └── voices/                    # Thư viện 7 giọng tham chiếu tiếng Việt chuẩn
│       ├── manifest.json          # Danh mục 7 giọng đọc (Bắc - Trung - Nam)
│       ├── __init__.py            # Bộ điều phối nạp prompt âm học
│       └── *.pt                   # 7 tệp vector prompt âm học (Cao Hùng, Út Linh, Tô Thành...)
│
└── nghien-cuu/                    # [NGHIÊN CỨU & THỰC NGHIỆM] Pipeline 9 bước trên Kaggle
    ├── notebooks/                 # Toàn bộ Jupyter Notebooks (Bước 1 -> Bước 7a)
    │   ├── Buoc1_SinhDuLieu_PA2_v2.ipynb
    │   ├── Buoc1_PhuHoi_SinhBu_TuDong.ipynb
    │   ├── Buoc2_TrichDacTrung_NhanDang_TuDong.ipynb
    │   ├── Buoc2_CaiTien_DoBen_TuDong.ipynb
    │   ├── Buoc3_TA_VIVOS_ThatGia_TuDong.ipynb
    │   ├── Buoc4_TA_PhanTich_NgheMu_TuDong.ipynb
    │   ├── Buoc5_ChanDoan_OmniVoice_TuDong.ipynb
    │   ├── Buoc6_NhanDangNguoiNoi_ThuClone_TuDong.ipynb
    │   └── Buoc7a_SoSanhThatGia_TuDong.ipynb
    ├── du-lieu-ho-tro/            # Dữ liệu CSV phục vụ tái lập thực nghiệm
    │   ├── 300_CAU_6_THANH_VIET.csv
    │   ├── DU_LIEU_DAU_VAO_BUOC6.zip
    │   └── DU_LIEU_DAU_VAO_BUOC7.zip
    └── ma-nguon/                  # Module trích đặc trưng phục vụ kiểm thử
        └── bo_trich_dac_trung.py
```

---

## 6. Hướng dẫn cài đặt & Khởi chạy trực tiếp

### 6.1. Yêu cầu môi trường
* Hệ điều hành: Windows 10/11 hoặc Linux (Ubuntu 20.04+).
* Python: 3.10 – 3.12 (khuyến nghị Python 3.11/3.12).
* Đã cài đặt **FFmpeg** trên hệ thống (dùng để giải mã âm thanh từ micro WebM/Opus, MP3, FLAC).

### 6.2. Cài đặt thư viện
Mở PowerShell hoặc Terminal tại thư mục gốc của repository:

```bash
# Tạo môi trường ảo (tùy chọn nhưng khuyến khích)
python -m venv venv
# Kích hoạt trên Windows:
.\venv\Scripts\Activate.ps1
# Kích hoạt trên Linux:
# source venv/bin/activate

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

*(Tùy chọn cho GPU TTS)*: Nếu máy có GPU NVIDIA và muốn chạy tổng hợp giọng nói thật:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install omnivoice
```

---

### 6.3. Khởi chạy 2 giao diện Web

Bạn có thể chạy riêng từng hệ thống hoặc chạy đồng thời cả hai:

#### Cách 1: Khởi động cả 2 hệ sinh thái cùng lúc (Khuyến nghị)
Nhấp đúp vào `chay_tat_ca.ps1` (hoặc chạy trong PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\chay_tat_ca.ps1
```
Trình duyệt sẽ tự động mở đồng thời cả 2 giao diện:
1. **VoiceLab Studio**: `http://127.0.0.1:8765`
2. **OmDiOm Studio**: `http://127.0.0.1:8000`

---

#### Cách 2: Chạy riêng từng giao diện

* **Chạy VoiceLab Studio (Máy soi Thật/Giả & Nhận dạng 25 người):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\chay_lab.ps1
  # Hoặc nhấp đúp tệp chay_lab.bat
  ```
  Truy cập: **`http://127.0.0.1:8765`**
  * Tải file WAV/FLAC/MP3 bất kỳ (hỗ trợ đến 120 MB) hoặc ghi âm trực tiếp qua Micro.
  * Xem biểu đồ sóng âm thật (Real Waveform) chuyển động theo thời gian thực và click tua phát âm thanh.
  * Bấm *Phân tích mẫu giọng* để nhận kết quả phân loại SVM RBF Thật/Giả và mã người nói Gaussian NB.
  * Bấm nút xem chi tiết bảng 75 chiều đặc trưng âm học ($F_1, F_2, F_3$).

* **Chạy OmDiOm Studio (Máy chủ Neural TTS & Zero-Shot Cloning):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\chay_omdiom.ps1
  # Hoặc nhấp đúp tệp chay_omdiom.bat
  ```
  Truy cập: **`http://127.0.0.1:8000`**
  * Giao diện studio phát thanh, chọn 1 trong 7 giọng đọc 3 miền chuẩn.
  * Tải clip mẫu để nhân bản giọng zero-shot tức thì.
  * Kết nối trực tiếp với VoiceLab Studio qua nút đưa clip vừa sinh lên máy soi giọng ở cổng 8765.

---

## 7. Tái lập thực nghiệm trên Kaggle (Bước 1 – Bước 7a)

Nếu bạn muốn chạy lại toàn bộ quy trình huấn luyện và đánh giá trên Kaggle:
1. Mở Kaggle Notebooks, tải các tệp `.ipynb` trong thư mục `nghien-cuu/notebooks/`.
2. Đối với **Bước 6** và **Bước 7a**:
   * Giải nén tệp `DU_LIEU_DAU_VAO_BUOC6.zip` hoặc `DU_LIEU_DAU_VAO_BUOC7.zip` trong `nghien-cuu/du-lieu-ho-tro/`.
   * Tạo một **Kaggle Dataset** chứa các tệp CSV bên trong.
   * Gắn dataset vào Input của notebook, chọn môi trường CPU và bấm **Run All**.
3. Notebook sẽ tự động kiểm tra mã băm SHA-256 của từng file đầu vào, chạy huấn luyện, xuất bảng chỉ số và sinh báo cáo HTML tự chứa trong `/kaggle/working/`.

---

## 8. Giấy phép & Cam kết học thuật

* Ngữ liệu âm thanh **VIVOS**: Thuộc bản quyền của AILAB, ĐH Khoa học Tự nhiên TP.HCM, phân phối theo giấy phép [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
* Mô hình **OmniVoice**: Bản quyền của k2-fsa, phân phối theo giấy phép mã nguồn mở [Apache-2.0](https://github.com/k2-fsa/OmniVoice/blob/main/LICENSE).
* **Đạo đức nghiên cứu:** Đề tài được thực hiện nghiêm túc cho mục đích học thuật trong khuôn khổ môn học Nhận dạng mẫu. Không sử dụng các mô hình và dữ liệu để mạo danh hay xâm phạm quyền riêng tư của cá nhân.
