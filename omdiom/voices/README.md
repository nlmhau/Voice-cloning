# voices/ — Thư viện giọng đã nhân bản

Mỗi tệp `.pt` ở đây là **một giọng đã nhân bản sẵn**, do:

```python
prompt = model.create_voice_clone_prompt(ref_audio="mau.wav", ref_text="lời trong clip")
prompt.save("voices/Linh_Duc_Tu.pt")
```

Tệp chỉ chứa **embedding người nói** (6–16 KB), không chứa model và không chứa
âm thanh gốc. Dùng lại được nhiều phiên.

## Thêm giọng

1. **Máy chủ đang chạy** — mở giao diện → tab **Thư viện giọng** → kéo thả tệp `.pt`.
2. **Kaggle** — gắn một Dataset chứa các tệp `.pt`; notebook tự chép sang
   `/kaggle/working/voices` ở ô 2.

Thả tay vào thư mục này cũng được: máy chủ quét đĩa, không cần sửa `manifest.json`.

## Đặt tên

Tên tệp là tên hiển thị. Được giữ dấu tiếng Việt:

| Tệp                | Tên hiển thị  | id (dùng trong API)  |
|--------------------|---------------|----------------------|
| `Linh_Đức_Tú.pt`   | Linh Đức Tú   | `Linh_Duc_Tu`        |
| `Cao_Hưng.pt`      | Cao Hưng      | `Cao_Hung`           |

`id` bỏ dấu để dùng được trong URL và trong form.

## Quyền riêng tư

Đây là **dấu giọng của người thật** trong nhóm. `voices/*.pt` đã nằm trong
`.gitignore`. Đừng đưa lên kho công khai và đừng nộp kèm ZIP nếu phiếu đồng ý
của người cho giọng không cho phép.
