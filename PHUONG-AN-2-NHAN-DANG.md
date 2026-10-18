# Phương án 2: Nhận dạng người nói và phân biệt giọng thật với giọng nhân bản (tiếng Việt)

**Nhóm 05 · Đề tài 10: Voice cloning** · Dữ liệu âm thanh · **Phân lớp**

## 1\. Bài toán và mục tiêu

Công nghệ nhân bản giọng nói ngày càng giống người thật. Nhóm xem đây là bài toán **nhận dạng mẫu**: các bộ phân lớp cổ điển có nhận ra giọng nhân bản là của ai, và có phân biệt được giọng nhân bản với giọng thật không?

* **Đối tượng cần nhận dạng:** đoạn âm thanh giọng nói tiếng Việt.
* **Bài toán A, nhận dạng người nói:** phân lớp theo người nói (65 lớp) trên giọng thật.
* **Bài toán B, phân biệt thật và giả:** phân lớp hai lớp (giọng thật / giọng nhân bản), có mất cân bằng lớp.
* **Ý nghĩa:** đánh giá mức độ giọng nhân bản giống người thật, và khả năng phát hiện giọng giả mạo.
* **Phạm vi:** chỉ tiếng Việt, mục đích học thuật phi thương mại.

**Câu hỏi nghiên cứu**

1. Đặc trưng và thuật toán nào nhận dạng người nói tiếng Việt hiệu quả nhất?
2. Giọng nhân bản bằng OmniVoice có bị nhận thành đúng người được nhân bản không, và có phân biệt được với giọng thật không?

## 2\. Tập dữ liệu

### 2.1 Dữ liệu thật: VIVOS (AILAB, ĐH Khoa học Tự nhiên TP.HCM)

|Thông tin|Chi tiết|
|-|-|
|**Link dữ liệu**|[https://huggingface.co/datasets/AILAB-VNUHCM/vivos](https://huggingface.co/datasets/AILAB-VNUHCM/vivos)|
|**Nguồn gốc**|AILAB, ĐH Khoa học Tự nhiên TP.HCM. DOI: [https://doi.org/10.5281/zenodo.7068130](https://doi.org/10.5281/zenodo.7068130) · Bài báo: [https://aclanthology.org/W16-5207/](https://aclanthology.org/W16-5207/)|
|Quy mô|15 giờ, 12.420 câu (train 11.660 câu của 46 người; test 760 câu của 19 người), tổng 65 người đọc|
|Nhãn|`speaker\_id` (mã người nói ẩn danh, ví dụ `VIVOSSPK01`), kèm lời đọc|
|Âm thanh|16 kHz, thu trong phòng yên tĩnh bằng micro chất lượng cao, mỗi người đọc từng câu|
|Dung lượng|khoảng 1,47 GB|
|Giấy phép|CC-BY-NC-SA-4.0|
|Điều khoản|Không cố xác định danh tính thật của người đọc. Nhóm chỉ phân lớp theo mã `speaker\_id` ẩn danh|

**Lưu ý về cách chia tập.** Tập train và test chính thức của VIVOS có **người nói khác nhau** (46 và 19 người). Với bài toán nhận dạng người nói (các lớp phải xuất hiện ở cả hai tập), nhóm sẽ gộp dữ liệu rồi **chia theo câu trong từng người**. Số câu mỗi người không đều (trung bình khoảng 253 câu/người ở tập train và 40 câu/người ở tập test chính thức), nên cần thống kê mất cân bằng lớp ở phần EDA.

**Cách truy cập:** bản trên Hugging Face dùng script nạp dữ liệu nên có thể không chạy với `datasets` bản mới; nhóm sẽ tải trực tiếp từ trang gốc (DOI ở trên) khi thực hiện.

### 2.2 Dữ liệu giọng nhân bản (nhóm tự sinh)

Với mỗi người nói trong VIVOS, nhóm lấy một đoạn mẫu 3–10 giây làm giọng tham chiếu, rồi dùng **OmniVoice** (mô hình nhân bản giọng mã nguồn mở) đọc một số câu khác của người đó. Số lượng cụ thể sẽ chốt khi thực hiện. Đây là dữ liệu sinh từ mô hình, không phải dữ liệu thu từ người thật, và được gán nhãn "giả" để dùng cho bài toán B.

### Hạn chế

|#|Hạn chế|Hướng xử lý|
|-|-|-|
|1|Giấy phép NC-SA, chỉ dùng học thuật|Ghi rõ trong báo cáo; chia sẻ lại cùng giấy phép nếu công bố|
|2|Số câu mỗi người không đều|Thống kê; dùng macro-F1; so sánh có và không cân bằng lớp|
|3|Thu trong phòng thu, ít tạp âm|Nêu rõ phạm vi kết luận; có thể thêm nhiễu để kiểm tra độ bền|
|4|Giọng nhân bản phụ thuộc mô hình sinh|Ghi rõ mô hình, phiên bản, tham số|

## 3\. Tiền xử lý và biểu diễn dữ liệu

1. Đọc âm thanh, chuyển mono, đưa về cùng tần số lấy mẫu; cắt khoảng lặng đầu cuối.
2. Chuẩn hoá biên độ.
3. **Trích đặc trưng MFCC** (kèm đạo hàm bậc một nếu cần), rồi tổng hợp theo câu bằng trung bình và độ lệch chuẩn để mỗi câu là một vector cố định chiều.
4. Chuẩn hoá đặc trưng (z-score), xem xét giảm chiều bằng PCA.
5. Chia tập huấn luyện, kiểm định, kiểm thử theo câu trong từng người; cố định seed; tách riêng các câu dùng làm mẫu tham chiếu để không rò rỉ dữ liệu.
6. EDA: số câu mỗi người, phân bố độ dài, phân bố đặc trưng, mất cân bằng lớp.

## 4\. Mô hình

|Mô hình|Vai trò|
|-|-|
|**k-NN**|Thuật toán nền tảng|
|**SVM** (tuyến tính và RBF)|Thuật toán nền tảng|
|**Naive Bayes** (Gaussian)|Thuật toán nền tảng|
|(Tuỳ chọn) GMM theo từng người nói|Nếu môn đã học|
|(Mở rộng, tuỳ chọn) Embedding người nói tiền huấn luyện|Phương pháp hiện đại ngoài môn, để so sánh|

Phần lý thuyết sẽ giải thích nguyên lý và cơ sở toán của từng mô hình, và lý do chọn.

## 5\. Đánh giá và so sánh

* **Chỉ số:** accuracy, precision, recall, F1 (macro), ma trận nhầm lẫn.
* **Bài toán A:** so sánh k-NN, SVM, Naive Bayes trên giọng thật.
* **Bài toán B:** phân biệt thật/giả, báo cáo theo từng mô hình; xử lý mất cân bằng.
* **Thí nghiệm chính:** đưa giọng nhân bản vào bộ phân lớp của bài toán A và đo tỉ lệ bị nhận đúng người được nhân bản.
* **Phân tích lỗi:** các câu và người bị nhận nhầm nhiều nhất, nguyên nhân.
* **Chọn mô hình** dựa trên bằng chứng thực nghiệm.

## 6\. Kiểm tra thực nghiệm (demo)

Giao diện web đơn giản: tải lên một đoạn âm thanh, hiển thị dự đoán người nói, xác suất, và kết luận giọng thật hay giọng nhân bản. Chương trình dùng đúng mô hình đã thực nghiệm. Giao diện cũng có chức năng nhân bản giọng và đọc văn bản để tạo mẫu thử.

## 7\. Điểm thưởng nhóm hướng tới

* **Sáng tạo:** dùng mô hình sinh hiện đại (OmniVoice) và khảo sát khả năng bị nhận nhầm; có thể thêm embedding người nói.
* **Sản phẩm:** giao diện web trực quan cho cả nhận dạng và nhân bản giọng.

## 8\. Phân công (dự kiến)

|Thành viên|Phụ trách|
|-|-|
|`<Nguyễn Lê Minh Hậu>`|Dữ liệu, tiền xử lý, trích đặc trưng, EDA|
|`<Phạm Thành Doanh>`|Mô hình phân lớp, đánh giá, phân tích lỗi|
|`<Lê Văn Quang>`|Sinh giọng nhân bản, giao diện demo, báo cáo, slide|

## 9\. Mô hình, công cụ và tài liệu tham khảo

|Thành phần|Nguồn|Giấy phép|
|-|-|-|
|VIVOS|[https://huggingface.co/datasets/AILAB-VNUHCM/vivos](https://huggingface.co/datasets/AILAB-VNUHCM/vivos)|CC-BY-NC-SA-4.0|
|OmniVoice (sinh giọng nhân bản)|[https://github.com/k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice) · [https://huggingface.co/k2-fsa/OmniVoice](https://huggingface.co/k2-fsa/OmniVoice)|Apache-2.0|
|scikit-learn, librosa|thư viện mã nguồn mở|theo trang gốc|

1. Luong, H.-T. và Vu, H.-Q. (2016). *A non-expert Kaldi recipe for Vietnamese Speech Recognition System*. WLSI/OIAF4HLT 2016. [https://aclanthology.org/W16-5207/](https://aclanthology.org/W16-5207/)
2. k2-fsa. *OmniVoice*. [https://github.com/k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice)

