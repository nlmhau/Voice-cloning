# -*- coding: utf-8 -*-
import sys
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

"""
VoiceLab Demo Bước 7b — Nâng cấp toàn diện:
- Bộ soi giọng Thật / Giả (SVM RBF 75 đặc trưng F1, F2, F3) với điểm tin cậy & khoảng cách siêu phẳng
- Nhận dạng người nói (Gaussian Naive Bayes 25 mã VIVOS) với Top 5 xác suất
- Trích xuất & hiển thị chi tiết 75 chiều đặc trưng âm học phục vụ nghiên cứu & báo cáo
- Kết nối linh hoạt với Server TTS thật (Cục bộ 127.0.0.1:8000 hoặc Kaggle GPU Tunnel)
- Tùy chỉnh tham số sinh giọng cao cấp: num_step (8, 16, 32), guidance_scale (CFG), speed
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
import tempfile, json, os, sys, logging, time, subprocess
import numpy as np
import soundfile as sf
import joblib
from bo_trich_dac_trung import dac_trung_mot

ROOT = Path(__file__).resolve().parent
MAX_UPLOAD = 120 * 1024 * 1024      # 120 MB
MAX_TTS_AUDIO = 120 * 1024 * 1024   # 120 MB

# Cấu hình server TTS mặc định (có thể đổi trực tiếp trên UI)
TTS_URL = os.getenv('TTS_SERVER_URL', 'http://127.0.0.1:8000').strip().rstrip('/')
TTS_KEY = os.getenv('TTS_API_KEY', '').strip()
HOST = os.getenv('DEMO_HOST', '127.0.0.1')
PORT = int(os.getenv('DEMO_PORT', '8765'))

try:
    detect = joblib.load(ROOT / 'models' / 'svm_TA_tai_tao.joblib')
    speaker = joblib.load(ROOT / 'models' / 'nhan_dang_25_nguoi.joblib')
    if len(detect['feature_names']) != 75 or len(speaker['feature_names']) != 52 or len(speaker['speakers']) != 25:
        raise ValueError('Sai cấu trúc hoặc số chiều đặc trưng trong tệp mô hình.')
    # Tương thích đa phiên bản scikit-learn
    for step_name, step_obj in speaker['model'].steps:
        if hasattr(step_obj, '_fit_dtype') and not hasattr(step_obj, '_fill_dtype'):
            step_obj._fill_dtype = step_obj._fit_dtype
        elif hasattr(step_obj, '_fill_dtype') and not hasattr(step_obj, '_fit_dtype'):
            step_obj._fit_dtype = step_obj._fill_dtype
except Exception as e:
    raise SystemExit(f'Lỗi tải mô hình nhận dạng từ thư mục models: {e}')

class AppError(Exception):
    def __init__(self, message, status=400):
        self.message = message
        self.status = status

def form_parts(content_type, body):
    if not content_type.lower().startswith('multipart/form-data'):
        raise AppError('Yêu cầu phải có tệp âm thanh đính kèm (multipart/form-data).')
    msg = BytesParser(policy=default).parsebytes(('Content-Type: ' + content_type + '\r\nMIME-Version: 1.0\r\n\r\n').encode('utf8') + body)
    if not msg.is_multipart():
        raise AppError('Không đọc được dữ liệu tải lên.')
    parts = {}
    for part in msg.iter_parts():
        name = part.get_param('name', header='content-disposition')
        raw = part.get_payload(decode=True)
        if name and name not in parts:
            parts[name] = (part.get_filename(), raw or b'')
    return parts

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20.0, 20.0)))

def chuan_hoa_am_thanh(raw, max_duration=30.0):
    """
    Chuyển đổi mọi định dạng âm thanh (WAV, WebM mic, MP3, FLAC, OGG, M4A...)
    về tệp WAV Mono 16 kHz hợp chuẩn.
    Nếu tệp dài hơn 60 giây, tự động trích đoạn đầu (30 giây) để mô hình phân tích.
    Trả về: (duong_dan_wav_chuan, thoi_luong_goc, thoi_luong_phan_tich, tan_so_goc, so_kenh_goc, ghi_chu)
    """
    with tempfile.NamedTemporaryFile(suffix='.audio_in', delete=False) as tmp_in:
        in_path = Path(tmp_in.name)
        tmp_in.write(raw)
    
    out_path = in_path.with_suffix('.wav_16k.wav')
    
    try:
        thoi_luong_goc = 0.0
        tan_so_goc = 16000
        so_kenh_goc = 1
        try:
            info = sf.info(str(in_path))
            thoi_luong_goc = float(info.duration)
            tan_so_goc = int(info.samplerate)
            so_kenh_goc = int(info.channels)
        except Exception:
            try:
                probe = subprocess.run([
                    'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1', str(in_path)
                ], capture_output=True, text=True, timeout=5)
                thoi_luong_goc = float(probe.stdout.strip())
            except Exception:
                thoi_luong_goc = 0.0

        ghi_chu = None
        cmd = ['ffmpeg', '-y']
        if thoi_luong_goc > 60.0:
            cmd.extend(['-t', str(max_duration)])
            mins = int(thoi_luong_goc // 60)
            secs = int(thoi_luong_goc % 60)
            time_str = f"{mins:02d}:{secs:02d}"
            ghi_chu = f'Tệp gốc dài {time_str} ({thoi_luong_goc:.1f}s > 60s). Hệ thống đã tự động trích đoạn {max_duration:.0f} giây đầu để trích xuất 75 đặc trưng và nhận dạng.'
        elif thoi_luong_goc > 0 and thoi_luong_goc < 0.2:
            raise AppError('Đoạn âm thanh quá ngắn (dưới 0.2 giây). Vui lòng chọn đoạn âm thanh dài hơn.')
        
        cmd.extend(['-i', str(in_path), '-ac', '1', '-ar', '16000', str(out_path)])
        
        run_res = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if run_res.returncode != 0:
            raise AppError('Không thể giải mã âm thanh. Hãy tải tệp WAV, FLAC, OGG, MP3 hoặc ghi âm micro hợp lệ.')
        
        info_out = sf.info(str(out_path))
        if info_out.duration < 0.2:
            raise AppError('Đoạn âm thanh sau khi giải mã quá ngắn (dưới 0.2 giây).')
            
        if thoi_luong_goc <= 0.0:
            thoi_luong_goc = info_out.duration
            
        return out_path, thoi_luong_goc, info_out.duration, tan_so_goc, so_kenh_goc, ghi_chu
    finally:
        in_path.unlink(missing_ok=True)

def phan_tich_audio(raw):
    if not raw or len(raw) > MAX_UPLOAD:
        raise AppError('Tệp âm thanh rỗng hoặc vượt quá 120 MB.')
    
    out_path, thoi_luong_goc, thoi_luong_phan_tich, tan_so_goc, so_kenh_goc, ghi_chu = chuan_hoa_am_thanh(raw)
    
    try:
        row = {'id_clip': 'tep_tai_len', 'duong_dan_input': str(out_path), 'sr': 16000}
        features, error = dac_trung_mot(row)
        if error:
            raise AppError('Lỗi trích đặc trưng: ' + error['loi'])
        
        def data_for(obj):
            v = np.array([[features[x] for x in obj['feature_names']]], dtype=float)
            if not np.isfinite(v).all():
                raise AppError('Đặc trưng âm thanh tính toán chứa giá trị NaN hoặc Vô hạn.')
            return v
        
        # 1. Dự đoán Thật / Giả qua SVM RBF
        x_detect = data_for(detect)
        label = int(detect['model'].predict(x_detect)[0])
        decision_score = float(detect['model'].decision_function(x_detect)[0])
        
        # Tính xác suất hiệu chỉnh từ khoảng cách siêu phẳng
        prob_gia = float(sigmoid(decision_score) * 100.0)
        prob_that = float(100.0 - prob_gia)
        
        # 2. Dự đoán người nói qua Gaussian Naive Bayes (Top 5)
        x_speaker = data_for(speaker)
        pred_spk = str(speaker['model'].predict(x_speaker)[0])
        
        speaker_top5 = []
        if hasattr(speaker['model'], 'predict_proba'):
            probs = speaker['model'].predict_proba(x_speaker)[0]
            classes = speaker['model'].classes_
            spk_list = sorted(zip(classes, probs), key=lambda x: x[1], reverse=True)
            for s, p in spk_list[:5]:
                speaker_top5.append({'id': str(s), 'prob': round(float(p), 4)})
        else:
            speaker_top5.append({'id': pred_spk, 'prob': 1.0})
        
        # 3. Gom nhóm đặc trưng để hiển thị trực quan
        f1_keys = [k for k in features if k.startswith('F1_')]
        f2_keys = [k for k in features if k.startswith('F2_')]
        f3_keys = [k for k in features if k.startswith('F3_')]
        
        summary = {
            'f1_count': len(f1_keys),
            'f2_count': len(f2_keys),
            'f3_count': len(f3_keys),
            'centroid_mean': round(features.get('F2_centroid_hz_mean', 0.0), 1),
            'bandwidth_mean': round(features.get('F2_bandwidth_hz_mean', 0.0), 1),
            'rolloff_mean': round(features.get('F2_rolloff95_hz_mean', 0.0), 1),
            'flatness_mean': round(features.get('F2_flatness_mean', 0.0), 5),
            'subbands': {
                '0_500': round(features.get('F2_band_0_500_mean', 0.0) * 100, 2),
                '500_1000': round(features.get('F2_band_500_1000_mean', 0.0) * 100, 2),
                '1000_2000': round(features.get('F2_band_1000_2000_mean', 0.0) * 100, 2),
                '2000_4000': round(features.get('F2_band_2000_4000_mean', 0.0) * 100, 2),
                '4000_8001': round(features.get('F2_band_4000_8001_mean', 0.0) * 100, 2),
            },
            'silence_ratio': round(features.get('F3_silence_fraction', 0.0), 4),
            'zcr_mean': round(features.get('F3_zcr_mean', 0.0), 4),
            'frame_rms_std': round(features.get('F3_frame_rms_std', 0.0), 4),
        }
        
        # Danh sách chi tiết 75 đặc trưng
        features_full = []
        for k, v in features.items():
            if k == 'id_clip': continue
            group = 'F1' if k.startswith('F1_') else ('F2' if k.startswith('F2_') else 'F3')
            features_full.append({
                'name': k,
                'group': group,
                'value': round(float(v), 5)
            })
        
        return {
            'du_doan_that_gia': 'Giả / tổng hợp' if label == 1 else 'Thật / tự nhiên',
            'la_gia': bool(label == 1),
            'decision_score': round(decision_score, 4),
            'prob_gia': round(prob_gia, 2),
            'prob_that': round(prob_that, 2),
            'confidence_pct': round(prob_that if label == 0 else prob_gia, 1),
            'ma_nguoi': pred_spk,
            'speaker_top5': speaker_top5,
            'thoi_luong': round(thoi_luong_phan_tich, 2),
            'thoi_luong_goc': round(thoi_luong_goc, 2),
            'tan_so_goc': tan_so_goc,
            'so_kenh': so_kenh_goc,
            'ghi_chu': ghi_chu,
            'summary': summary,
            'features_full': features_full,
            'luu_y': 'Dự đoán nghiên cứu học thuật tập đóng; nhận dạng người nói chọn trong 25 mã VIVOS.'
        }
    finally:
        out_path.unlink(missing_ok=True)

def backend_call(path, payload=None, timeout=60):
    global TTS_URL, TTS_KEY
    if not TTS_URL:
        raise AppError('Chưa cấu hình URL server TTS.', 503)
    headers = {}
    if TTS_KEY:
        headers['X-API-Key'] = TTS_KEY
    if payload is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    
    t0 = time.perf_counter()
    req = Request(TTS_URL + path, data=payload, headers=headers, method='POST' if payload is not None else 'GET')
    try:
        with urlopen(req, timeout=timeout) as r:
            body = r.read(MAX_TTS_AUDIO + 1)
            if len(body) > MAX_TTS_AUDIO:
                raise AppError('Dữ liệu phản hồi từ server TTS vượt quá giới hạn dung lượng.', 502)
            latency = round((time.perf_counter() - t0) * 1000, 1)
            return body, r.headers.get_content_type(), latency
    except HTTPError as e:
        raise AppError(f'Server TTS báo lỗi HTTP {e.code}. Kiểm tra trạng thái máy chủ.', 502)
    except (URLError, TimeoutError, OSError) as e:
        raise AppError(f'Không kết nối được server TTS tại {TTS_URL}: {e}', 503)

def get_tts_status():
    global TTS_URL, TTS_KEY
    if not TTS_URL:
        return {
            'configured': False,
            'ready': False,
            'url': '',
            'message': 'Chưa cấu hình Server TTS.'
        }
    try:
        raw_health, _, lat = backend_call('/health', timeout=5)
        health = json.loads(raw_health)
        
        # Thử lấy thêm thông tin phần cứng nếu server có /api/system
        hw_info = {'device': 'cpu', 'gpu': 'Không phát hiện GPU'}
        try:
            raw_sys, _, _ = backend_call('/api/system', timeout=3)
            hw_info = json.loads(raw_sys)
        except Exception:
            pass
        
        raw_voices, _, _ = backend_call('/api/voices', timeout=5)
        data_voices = json.loads(raw_voices)
        voices = data_voices.get('voices', [])
        safe_voices = [{'id': str(v.get('id', '')), 'name': str(v.get('name', ''))} for v in voices if isinstance(v, dict) and v.get('id')]
        
        return {
            'configured': True,
            'ready': True,
            'url': TTS_URL,
            'latency_ms': lat,
            'model': str(health.get('model', 'OmniVoice CFM')),
            'hardware': hw_info,
            'voices': safe_voices,
            'message': f'Đã kết nối Server TTS ({lat} ms).'
        }
    except AppError as e:
        return {'configured': True, 'ready': False, 'url': TTS_URL, 'message': e.message}
    except Exception as e:
        return {'configured': True, 'ready': False, 'url': TTS_URL, 'message': f'Lỗi đọc trạng thái: {e}'}

class Handler(BaseHTTPRequestHandler):
    server_version = 'VoiceLab-Studio/2.0'
    
    def log_message(self, fmt, *args):
        logging.info('%s - %s', self.address_string(), fmt % args)
        
    def send_data(self, status, data, ctype='application/json; charset=utf-8'):
        if isinstance(data, dict):
            data = json.dumps(data, ensure_ascii=False).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/':
            return self.send_data(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        if path == '/api/status':
            return self.send_data(200, {
                'detect': True,
                'speaker': True,
                'mo_hinh_that_gia': 'SVM RBF (75 chiều)',
                'mo_hinh_speaker': 'Gaussian Naive Bayes (52 chiều)',
                'so_nguoi': 25,
                'features_count': 75
            })
        if path == '/api/tts-status':
            return self.send_data(200, get_tts_status())
        if path in ('/examples/vivos_that.flac', '/examples/omdiom_gia.flac'):
            return self.send_data(200, (ROOT / path.lstrip('/')).read_bytes(), 'audio/flac')
        self.send_data(404, {'error': 'Không tìm thấy trang yêu cầu.'})

    def do_POST(self):
        global TTS_URL, TTS_KEY
        path = urlparse(self.path).path
        try:
            try:
                n = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                raise AppError('Kích thước yêu cầu không hợp lệ.')
            
            if n <= 0:
                raise AppError('Dữ liệu yêu cầu rỗng.', 400)
            if n > MAX_UPLOAD + 65536:
                try:
                    self.rfile.read(min(n, 1048576))
                except Exception:
                    pass
                raise AppError('Tệp tải lên quá lớn (vượt quá 120 MB).', 413)
            
            raw = self.rfile.read(n)
            if len(raw) != n:
                raise AppError('Dữ liệu yêu cầu chưa nhận đủ.', 400)
            
            # Đổi URL Server TTS động từ giao diện
            if path == '/api/tts-config':
                try:
                    data = json.loads(raw.decode('utf-8'))
                except Exception:
                    raise AppError('Dữ liệu cấu hình JSON không hợp lệ.')
                new_url = str(data.get('url', '')).strip().rstrip('/')
                new_key = str(data.get('key', '')).strip()
                if new_url:
                    parsed = urlparse(new_url)
                    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
                        raise AppError('URL máy chủ phải bắt đầu bằng http:// hoặc https://.')
                    TTS_URL = new_url
                if 'key' in data:
                    TTS_KEY = new_key
                return self.send_data(200, get_tts_status())
            
            # Phân tích âm thanh Thật/Giả & Nhận dạng người nói
            if path == '/api/phan-tich':
                parts = form_parts(self.headers.get('Content-Type', ''), raw)
                if 'audio' not in parts:
                    raise AppError('Vui lòng chọn hoặc ghi âm một đoạn âm thanh.')
                return self.send_data(200, phan_tich_audio(parts['audio'][1]))
            
            # Sinh giọng nói qua GPU Server TTS
            if path == '/api/tts':
                try:
                    o = json.loads(raw.decode('utf-8'))
                except Exception:
                    raise AppError('Dữ liệu JSON yêu cầu không hợp lệ.')
                
                text = str(o.get('text', '')).strip()
                voice = str(o.get('voice_id', '')).strip()
                num_step = str(o.get('num_step', '16')).strip()
                guidance_scale = str(o.get('guidance_scale', '2.0')).strip()
                speed = str(o.get('speed', '1.0')).strip()
                
                if not text or len(text) > 1000:
                    raise AppError('Văn bản tiếng Việt cần từ 1 đến 1.000 ký tự.')
                if not voice:
                    raise AppError('Vui lòng chọn một giọng nói mẫu trên server.')
                
                form_payload = urlencode({
                    'text': text,
                    'voice_id': voice,
                    'num_step': num_step,
                    'guidance_scale': guidance_scale,
                    'speed': speed
                }).encode()
                
                audio, ctype, lat = backend_call('/api/tts', form_payload, timeout=300)
                if ctype not in ('audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream') or not audio.startswith((b'RIFF', b'RF64')):
                    raise AppError('Server không trả về tệp âm thanh WAV hợp lệ.', 502)
                return self.send_data(200, audio, 'audio/wav')
                
            raise AppError('Không tìm thấy chức năng API.', 404)
        except AppError as e:
            self.send_data(e.status, {'error': e.message})
        except Exception:
            logging.exception('Lỗi xử lý yêu cầu')
            self.send_data(500, {'error': 'Lỗi nội bộ máy chủ khi xử lý.'})

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s', datefmt='%H:%M:%S')
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'\n===============================================================', flush=True)
    print(f'  VOICELAB STUDIO v2.0 - HE THONG NHAN DANG & SINH GIONG GPU', flush=True)
    print(f'===============================================================', flush=True)
    print(f'  Trinh duyet: http://{HOST}:{PORT}', flush=True)
    print(f'  Server TTS : {TTS_URL or "(Chua cau hinh)"}', flush=True)
    print(f'  Ctrl+C de dung may chu.', flush=True)
    print(f'===============================================================\n', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nDa dung may chu Demo.')
    finally:
        httpd.server_close()
