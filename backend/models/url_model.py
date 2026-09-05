"""
SatyaKavach - URL Media Analyzer
Downloads video/audio from any public URL (Instagram, YouTube, TikTok, Twitter, etc.)
using yt-dlp, extracts frames with OpenCV, then runs the full ensemble detection:
  - Deepfake detection (face-swap)
  - AI-generated content detection (Sora, Runway, MidJourney videos)
  - Audio analysis via Librosa (voice cloning, AI music)
  - EXIF/metadata heuristic
"""
import os
import io
import uuid
import tempfile
import traceback
import numpy as np
from PIL import Image


# ── Frame extraction using OpenCV ──────────────────────────────────────────────
def extract_frames(video_path: str, max_frames: int = 8) -> list:
    import cv2
    frames = []
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return frames
    step = max(1, total // max_frames)
    for i in range(0, total, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(Image.fromarray(rgb))
        if len(frames) >= max_frames:
            break
    cap.release()
    return frames


# ── yt-dlp download ────────────────────────────────────────────────────────────
def download_media(url: str, out_dir: str) -> dict:
    import yt_dlp
    import shutil

    uid = uuid.uuid4().hex[:8]
    video_tmpl = os.path.join(out_dir, f"media_{uid}.%(ext)s")

    ffmpeg_available = shutil.which("ffmpeg") is not None

    if ffmpeg_available:
        # Best quality: separate video+audio merged via FFmpeg
        fmt = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        postprocessors = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }]
        keepvideo = True
    else:
        # No FFmpeg: download best pre-merged single file (slightly lower quality but works)
        fmt = "best[ext=mp4]/best[ext=webm]/best"
        postprocessors = []
        keepvideo = False

    ydl_opts = {
        "format": fmt,
        "outtmpl": video_tmpl,
        "quiet": True,
        "no_warnings": True,
        "merge_output_format": "mp4" if ffmpeg_available else None,
        "postprocessors": postprocessors,
        "keepvideo": keepvideo,
        "socket_timeout": 30,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title      = info.get("title", "Unknown")
        platform   = info.get("extractor_key", "Unknown")
        duration   = info.get("duration", 0)
        uploader   = info.get("uploader", "Unknown")
        view_count = info.get("view_count", 0)

    video_path = None
    audio_path = None
    for fname in os.listdir(out_dir):
        full = os.path.join(out_dir, fname)
        if fname.startswith(f"media_{uid}"):
            ext = fname.rsplit(".", 1)[-1].lower()
            if ext in ("mp4", "webm", "mkv", "avi", "mov"):
                video_path = full
            elif ext in ("wav", "m4a", "mp3", "aac", "ogg"):
                audio_path = full

    return {
        "videoPath": video_path,
        "audioPath": audio_path,
        "title": title,
        "platform": platform,
        "duration": duration,
        "uploader": uploader,
        "viewCount": view_count,
        "ffmpegUsed": ffmpeg_available
    }


# ── Main URL analysis function ─────────────────────────────────────────────────
def analyze_url(url: str) -> dict:
    from models.image_model import analyze_image
    from models.audio_model import analyze_audio

    with tempfile.TemporaryDirectory() as tmp:
        # Step 1: Download
        try:
            media = download_media(url, tmp)
        except Exception as e:
            return {
                "riskScore": 50,
                "label": "MEDIUM",
                "method": "Download failed",
                "error": str(e),
                "modelLoaded": False
            }

        frame_scores = []
        audio_result = None

        # Step 2: Analyze video frames
        if media["videoPath"] and os.path.exists(media["videoPath"]):
            try:
                frames = extract_frames(media["videoPath"], max_frames=8)
                for i, frame in enumerate(frames):
                    buf = io.BytesIO()
                    frame.save(buf, format="JPEG", quality=85)
                    result = analyze_image(buf.getvalue())
                    frame_scores.append({
                        "frameIndex": i,
                        "riskScore": result["riskScore"],
                        "label": result["label"],
                        "method": result.get("method", ""),
                        "breakdown": result.get("breakdown", {})
                    })
            except Exception as e:
                print(f"[URLModel] Frame analysis error: {e}")
                traceback.print_exc()

        # Step 3: Analyze audio (only if FFmpeg extracted it)
        if media["audioPath"] and os.path.exists(media["audioPath"]):
            try:
                with open(media["audioPath"], "rb") as af:
                    audio_bytes = af.read()
                audio_result = analyze_audio(audio_bytes, filename=media["audioPath"])
            except Exception as e:
                print(f"[URLModel] Audio analysis error: {e}")

    # Step 4: Combine scores
    scores = []

    if frame_scores:
        max_frame = max(frame_scores, key=lambda x: x["riskScore"])
        avg_frame = round(sum(f["riskScore"] for f in frame_scores) / len(frame_scores))
        video_score = round(max_frame["riskScore"] * 0.7 + avg_frame * 0.3)
        scores.append((video_score, 0.70, "Visual Frame Analysis"))

    if audio_result and "riskScore" in audio_result:
        scores.append((audio_result["riskScore"], 0.30, "Audio Librosa"))

    if not scores:
        final = 50
        method = "No media could be extracted"
    else:
        total_w = sum(w for _, w, _ in scores)
        final   = round(sum(s * w for s, w, _ in scores) / total_w)
        final   = min(100, max(0, final))
        method  = "URL Ensemble: " + " + ".join(n for _, _, n in scores)

    return {
        "riskScore":        final,
        "label":            "HIGH" if final > 60 else ("MEDIUM" if final > 30 else "LOW"),
        "method":           method,
        "platform":         media.get("platform",   "Unknown"),
        "title":            media.get("title",       "Unknown"),
        "uploader":         media.get("uploader",    "Unknown"),
        "duration":         media.get("duration",    0),
        "framesAnalyzed":   len(frame_scores),
        "frameScores":      frame_scores,
        "audioAnalysis":    audio_result,
        "ffmpegUsed":       media.get("ffmpegUsed",  False),
        "modelLoaded":      True,
        "resolution":       frame_scores[0]["breakdown"].get("resolution", "N/A") if frame_scores else "N/A"
    }
