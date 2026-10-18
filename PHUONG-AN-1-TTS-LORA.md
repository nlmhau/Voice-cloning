# Phương án 1: Tổng hợp và nhân bản giọng nói tiếng Việt bằng tinh chỉnh LoRA

**Nhóm 05 · Đề tài 10: Voice cloning** · Dữ liệu âm thanh · Sinh dữ liệu (tổng hợp tiếng nói)

## 1\. Bài toán và mục tiêu

Xây dựng hệ thống tiếng Việt có hai chức năng:

* **Chuyển văn bản thành giọng nói** (Text-to-Speech): văn bản vào, âm thanh ra.
* **Nhân bản giọng nói** (Voice Cloning): văn bản kèm một đoạn âm thanh mẫu ngắn vào, âm thanh đọc văn bản bằng giọng mẫu ra.

Dùng mô hình mã nguồn mở OmniVoice làm **mô hình nền** (giữ nguyên), tinh chỉnh bằng **LoRA** trên dữ liệu tiếng Việt để tạo **mô hình sau tinh chỉnh**, rồi so sánh hai mô hình.

**Câu hỏi nghiên cứu**

1. Tinh chỉnh LoRA bằng lượng dữ liệu nhỏ có cải thiện độ rõ lời và độ ổn định giọng so với mô hình nền không?
2. Việc lọc và kiểm định dữ liệu trước khi huấn luyện ảnh hưởng thế nào đến kết quả?

**Chỉ số:** WER (đo bằng Whisper), RTF (thời gian sinh chia thời lượng âm thanh), điểm nghe mù từ 1 đến 5.

## 2\. Tập dữ liệu: InfoRe Technology, bộ giọng đọc tiếng Việt số 1 (25 giờ)

|Thông tin|Chi tiết|
|-|-|
|**Link dữ liệu** (tải, nghe thử)|[https://huggingface.co/datasets/doof-ferb/infore1\_25hours](https://huggingface.co/datasets/doof-ferb/infore1_25hours)|
|**Nguồn gốc**|InfoRe Technology (công bố: [https://www.facebook.com/groups/j2team.community/permalink/1010834009248719/](https://www.facebook.com/groups/j2team.community/permalink/1010834009248719/)).|
|Quy mô|14.935 mẫu, khoảng 25 giờ, định dạng parquet, 7,83 GB|
|Thời lượng mỗi câu|khoảng 2,6 – 11,8 giây|
|Cột dữ liệu|`audio`, `transcription`|
|Người đọc|Một người đọc, thu theo kịch bản|
|Giấy phép|CC-BY-4.0 theo metadata trên Hugging Face|
|Quyền truy cập|Công khai, không cần xin quyền|

**Cách truy cập** (đọc theo luồng, không cần tải toàn bộ):

```python
# pip install -q "datasets\[audio]"
from datasets import load\_dataset
ds = load\_dataset("doof-ferb/infore1\_25hours", split="train", streaming=True)
for ex in ds.take(3):
    print(ex\["transcription"])
```

### Hạn chế của dữ liệu

|#|Hạn chế|Hướng xử lý|
|-|-|-|
|1|Bản sao không chính thức; giấy phép gốc chưa xác minh|Trích dẫn cả InfoRe và bản sao; chỉ dùng học thuật|
|2|Văn bản chưa kiểm lỗi chính tả (trang dữ liệu ghi chú "check misspelling")|Đối chiếu với Whisper, loại cặp có WER > 0,3|
|3|Văn bản viết thường, không dấu câu|Đánh giá cả câu có và không có dấu câu|
|4|Một số câu có nội dung nhạy cảm|Lọc bằng danh sách từ khoá|
|5|Chỉ một giọng, thu trong phòng thu|Nêu rõ phạm vi kết luận|

## 3\. Tiền xử lý và biểu diễn dữ liệu

1. Giải mã, chuyển mono, lấy mẫu lại 24 kHz.
2. Chuẩn hoá văn bản (Unicode NFC, khoảng trắng, ký tự lạ).
3. Lọc theo độ dài, tốc độ đọc (ký tự/giây), clipping, độ ồn; lọc câu nhạy cảm.
4. Đối chiếu lời với Whisper, loại cặp có WER cao.
5. EDA: phân bố độ dài, tốc độ đọc, số mẫu bị loại theo từng lý do.
6. Chia tập huấn luyện và tập đánh giá (cố định seed).

## 4\. Mô hình

|Mô hình|Mô tả|
|-|-|
|Mô hình nền|OmniVoice giữ nguyên|
|Mô hình sau tinh chỉnh|OmniVoice + adapter LoRA huấn luyện trên dữ liệu đã lọc|

So sánh trên cùng câu và cùng seed, ở hai điều kiện: không giọng mẫu, và nhân bản từ cùng một đoạn mẫu.

## 5\. Đánh giá và demo

* Bảng WER, RTF của hai mô hình; đường cong loss; ví dụ đọc đúng và đọc sai, phân tích lỗi (số, tên riêng, từ mượn).
* Demo: giao diện web nhập văn bản và (tuỳ chọn) âm thanh mẫu, chọn mô hình nền hoặc tinh chỉnh, nghe và so sánh.

## 6\. Điểm xin ý kiến cô

Đây là bài toán **sinh** âm thanh, không có nhãn lớp nên không có ma trận nhầm lẫn. Nhóm xin cô cho ý kiến về cách đánh giá phù hợp với yêu cầu "ít nhất 2 mô hình, trong đó có một thuật toán nền tảng" của môn.

## 7\. Phân công (dự kiến)

|Thành viên|Phụ trách|
|-|-|
|`<Nguyễn Lê Minh Hậu>`|Dữ liệu, tiền xử lý, EDA|
|`<Phạm Thành Doanh>`|Huấn luyện, đánh giá|
|`<Lê Văn Quang>`|Giao diện demo, báo cáo, slide|

## 8\. Mô hình, công cụ và tài liệu tham khảo

|Thành phần|Nguồn|Giấy phép|
|-|-|-|
|OmniVoice (mô hình nền)|[https://github.com/k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice) · [https://huggingface.co/k2-fsa/OmniVoice](https://huggingface.co/k2-fsa/OmniVoice)|Apache-2.0|
|Whisper large-v3-turbo (đối chiếu, đo WER)|OpenAI, qua Hugging Face|theo trang gốc|

1. InfoRe Technology. *Bộ dữ liệu giọng đọc tiếng Việt số 1 (25 giờ)*, qua bản sao `doof-ferb/infore1\_25hours`, Hugging Face.
2. k2-fsa. *OmniVoice*.
3. Hu và cộng sự (2021). *LoRA: Low-Rank Adaptation of Large Language Models*. arXiv:2106.09685.
4. Radford và cộng sự (2022). *Robust Speech Recognition via Large-Scale Weak Supervision*. arXiv:2212.04356.

