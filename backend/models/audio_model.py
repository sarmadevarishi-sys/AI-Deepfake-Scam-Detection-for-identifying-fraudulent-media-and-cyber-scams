"""
SatyaKavach — Audio Forensics using Librosa
Extracts real spectral features from audio to detect voice cloning / TTS artifacts.
"""
import io
import numpy as np

def analyze_audio(file_bytes: bytes, filename: str = "audio.wav") -> dict:
    """
    Analyze audio bytes using Librosa for voice cloning / TTS artifact detection.
    Returns spectral features and a risk score.
    """
    try:
        import librosa

        # Load audio from bytes
        audio_data, sample_rate = librosa.load(io.BytesIO(file_bytes), sr=None, mono=True)
        duration = float(librosa.get_duration(y=audio_data, sr=sample_rate))

        # --- Feature extraction ---
        # 1. MFCCs (Mel-Frequency Cepstral Coefficients) — captures timbre
        mfccs = librosa.feature.mfcc(y=audio_data, sr=sample_rate, n_mfcc=13)
        mfcc_mean = mfccs.mean(axis=1).tolist()
        mfcc_std = mfccs.std(axis=1).tolist()

        # 2. Spectral centroid — where the "center of mass" of the spectrum is
        spectral_centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sample_rate)
        centroid_mean = float(spectral_centroid.mean())

        # 3. Zero Crossing Rate — how often the signal crosses zero (TTS tends to be smoother)
        zcr = librosa.feature.zero_crossing_rate(audio_data)
        zcr_mean = float(zcr.mean())

        # 4. Spectral rolloff
        rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sample_rate)
        rolloff_mean = float(rolloff.mean())

        # 5. RMS energy (loudness over time)
        rms = librosa.feature.rms(y=audio_data)
        rms_std = float(rms.std())

        # --- Heuristic scoring ---
        # TTS/cloned voices tend to:
        #   - have very low ZCR variance (too smooth)
        #   - have unnaturally consistent RMS (no natural breath variation)
        #   - have spectral centroid concentrated in a narrow band

        zcr_score = max(0, min(100, int((1 - min(zcr_mean * 200, 1)) * 50)))
        rms_score = max(0, min(50, int((1 - min(rms_std * 100, 1)) * 50)))
        risk_score = zcr_score + rms_score

        return {
            "riskScore": risk_score,
            "label": "HIGH" if risk_score > 60 else ("MEDIUM" if risk_score > 30 else "LOW"),
            "method": "Librosa Spectral Analysis",
            "duration": round(duration, 2),
            "sampleRate": sample_rate,
            "features": {
                "mfccMean": [round(v, 3) for v in mfcc_mean],
                "spectralCentroid": round(centroid_mean, 2),
                "zeroCrossingRate": round(zcr_mean, 6),
                "spectralRolloff": round(rolloff_mean, 2),
                "rmsStd": round(rms_std, 6)
            },
            "modelLoaded": True
        }

    except Exception as e:
        return {
            "riskScore": 50,
            "label": "MEDIUM",
            "method": f"Librosa unavailable: {str(e)}",
            "modelLoaded": False,
            "error": str(e)
        }
