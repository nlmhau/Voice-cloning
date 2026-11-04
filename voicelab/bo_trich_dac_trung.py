import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, stft
from scipy.fft import dct
SR_DICH=16000
# Ô 3 · MÃ TRÍCH ĐẶC TRƯNG — 16 kHz, CÙNG QUY TRÌNH CHO 3 BỘ SINH
# Tự triển khai STFT + thang mel + DCT bằng numpy/scipy; không cần TTS hay GPU.
def _mel_filters(sr=16000,nfft=512,nmels=40):
    # Thang mel HTK và dải tam giác; tính một lần mỗi tiến trình.
    hz=np.linspace(0,sr/2,nfft//2+1)
    mel=lambda h:2595*np.log10(1+h/700)
    inv=lambda m:700*(10**(m/2595)-1)
    edges=inv(np.linspace(mel(0),mel(sr/2),nmels+2))
    flt=np.zeros((nmels,len(hz)),dtype=np.float64)
    for k in range(nmels):
        left=(hz-edges[k])/(edges[k+1]-edges[k]+1e-12)
        right=(edges[k+2]-hz)/(edges[k+2]-edges[k+1]+1e-12)
        flt[k]=np.maximum(0,np.minimum(left,right))
    return flt
MEL=_mel_filters()

def dac_trung_mot(row):
    from math import gcd
    try:
        y,sr=sf.read(row["duong_dan_input"],dtype="float32",always_2d=True)
        if sr<=0 or not y.size:raise ValueError("âm rỗng hoặc sample rate không hợp lệ")
        if int(sr)!=int(row["sr"]):raise ValueError(f"sample rate thực {sr} khác manifest {row['sr']}")
        y=y.mean(axis=1).astype(np.float64)
        if not np.isfinite(y).all():raise ValueError("âm có NaN/Inf")
        if sr!=SR_DICH:
            g=gcd(int(sr),SR_DICH);y=resample_poly(y,SR_DICH//g,int(sr)//g)
        if len(y)<int(0.2*SR_DICH):raise ValueError("clip dưới 0,2s")
        raw_rms=float(np.sqrt(np.mean(y*y)))
        if raw_rms<1e-8:raise ValueError("âm hoàn toàn im lặng")
        # Chuẩn hóa RMS clip để giảm sự phụ thuộc vào âm lượng đầu ra.
        y=y/raw_rms
        _,_,Z=stft(y,fs=SR_DICH,window="hann",nperseg=400,noverlap=240,nfft=512,boundary="zeros",padded=True)
        power=np.abs(Z)**2+1e-20
        logmel=np.log(MEL@power+1e-12)
        m=dct(logmel,type=2,axis=0,norm="ortho")[:13]
        dm=np.gradient(m,axis=1) if m.shape[1]>1 else np.zeros_like(m)
        f={}
        for name,A in [("mfcc",m),("delta",dm)]:
            for i in range(13):
                f[f"F1_{name}{i:02d}_mean"]=float(np.mean(A[i]))
                f[f"F1_{name}{i:02d}_std"]=float(np.std(A[i]))
        freq=np.linspace(0,SR_DICH/2,power.shape[0]);total=power.sum(axis=0)+1e-20
        centroid=(freq[:,None]*power).sum(axis=0)/total
        bandwidth=np.sqrt(((freq[:,None]-centroid)**2*power).sum(axis=0)/total)
        roll=freq[(np.cumsum(power,axis=0)>=.95*total).argmax(axis=0)]
        flat=np.exp(np.log(power).mean(axis=0))/(power.mean(axis=0)+1e-20)
        for name,v in [("centroid_hz",centroid),("bandwidth_hz",bandwidth),("rolloff95_hz",roll),("flatness",flat)]:
            f[f"F2_{name}_mean"]=float(np.mean(v));f[f"F2_{name}_std"]=float(np.std(v))
        for a,b in [(0,500),(500,1000),(1000,2000),(2000,4000),(4000,8001)]:
            ratio=power[(freq>=a)&(freq<b)].sum(axis=0)/total
            f[f"F2_band_{a}_{b}_mean"]=float(np.mean(ratio))
            f[f"F2_band_{a}_{b}_std"]=float(np.std(ratio))
        n=400;hop=160
        yp=np.pad(y,(n//2,n//2));fr=np.lib.stride_tricks.sliding_window_view(yp,n)[::hop]
        er=np.sqrt(np.mean(fr*fr,axis=1));zc=np.mean((fr[:,:-1]*fr[:,1:])<0,axis=1)
        threshold=max(float(er.max())*0.1,1e-12)
        f.update({"F3_duration_s":float(len(y)/SR_DICH),"F3_silence_fraction":float(np.mean(er<threshold)),
                  "F3_frame_rms_std":float(np.std(er)),"F3_zcr_mean":float(np.mean(zc)),"F3_zcr_std":float(np.std(zc))})
        if not all(np.isfinite(v) for v in f.values()):raise ValueError("Đặc trưng có NaN/Inf")
        return {"id_clip":row["id_clip"],**f},None
    except Exception as e:
        return None,{"id_clip":row["id_clip"],"duong_dan":row["duong_dan_input"],"loi":f"{type(e).__name__}: {str(e)[:300]}"}
print("F1: MFCC + delta (mean/std); F2: phổ; F3: thời lượng và nhịp. Không trích F0.")
