# Bài tập lớn cuối kỳ – Môn Nhận dạng mẫu

## Nhóm 05 · Đề tài 10: Voice cloning

### Tái tạo giọng nói và chuyển đổi văn bản thành giọng nói (tiếng Việt)

|Thành viên|MSSV|Lớp|
|-|-|-|
|`Phạm Thành Doanh`|`2351267258`|`65-TTNT`|
|`Nguyễn Lê Minh Hậu`|`2351267261`|`65-TTNT`|
|`Lê Văn Quang`|`2351267277`|`65-TTNT`|



\---

## Nhóm đề xuất hai phương án, xin cô chọn một

||**Phương án 1: Tổng hợp và nhân bản giọng (tinh chỉnh LoRA)**|**Phương án 2: Nhận dạng người nói và phân biệt giọng thật/giọng nhân bản**|
|-|-|-|
|Loại bài toán|Dữ liệu âm thanh · Sinh dữ liệu|Dữ liệu âm thanh · **Phân lớp**|
|Dữ liệu chính|InfoRe 25 giờ (một giọng)|VIVOS, 65 người đọc, có nhãn người nói|
|Mô hình|Mô hình nền và mô hình tinh chỉnh LoRA (OmniVoice)|**k-NN, SVM, Naive Bayes** (nền tảng) + OmniVoice để sinh giọng nhân bản|
|Chỉ số|WER, RTF, nghe mù|Accuracy, precision, recall, F1, **ma trận nhầm lẫn**|
|Mức khớp thang điểm môn|Cần cô góp ý|Khớp trực tiếp các mục 1–5 trong yêu cầu của cô |
|Tài liệu|[PHUONG-AN-1-TTS-LORA.md](PHUONG-AN-1-TTS-LORA.md)|[PHUONG-AN-2-NHAN-DANG.md](PHUONG-AN-2-NHAN-DANG.md)|

Cả hai phương án đều dùng chung mô hình **OmniVoice** (k2-fsa, Apache-2.0) làm công cụ tạo giọng; nguồn được ghi rõ trong từng tài liệu.

> Tập dữ liệu có link nguồn nên \*\*không\*\* tải trực tiếp lên repo (quá lớn).

