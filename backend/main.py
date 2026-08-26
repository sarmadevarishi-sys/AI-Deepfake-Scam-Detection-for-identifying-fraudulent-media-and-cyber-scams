"""
SatyaKavach — FastAPI Backend Server
Provides real AI inference endpoints for the frontend website.
Run with:  uvicorn main:app --reload --port 8000
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(
    title="SatyaKavach API",
    description="Real AI backend for deepfake and scam detection",
    version="1.0.0"
)

# Allow the local HTML file to call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check — frontend pings this to know if the server is running."""
    return {"status": "ok", "server": "SatyaKavach API v1.0"}


@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze an uploaded image for deepfake indicators.
    Uses HuggingFace ViT model.
    """
    try:
        file_bytes = await file.read()
        from models.image_model import analyze_image as run_image
        result = run_image(file_bytes)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/audio")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Analyze an uploaded audio file for voice cloning / TTS artifacts.
    Uses Librosa spectral analysis.
    """
    try:
        file_bytes = await file.read()
        from models.audio_model import analyze_audio as run_audio
        result = run_audio(file_bytes, filename=file.filename)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/text")
async def analyze_text(text: str = Form(...)):
    """
    Analyze a text string for phishing / scam patterns.
    Uses HuggingFace BERT spam classifier.
    """
    try:
        from models.text_model import analyze_text as run_text
        result = run_text(text)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/url")
async def analyze_url(url: str = Form(...)):
    """
    Download and analyze any public video URL (Instagram, YouTube, TikTok, Twitter, etc.)
    Uses yt-dlp to download, OpenCV to extract frames, then runs the full ensemble:
      - HuggingFace deepfake detector on each frame
      - HuggingFace AI-generated content detector (SDXL) on each frame
      - Librosa audio analysis on the audio track
      - EXIF metadata heuristic
    """
    try:
        from models.url_model import analyze_url as run_url
        result = run_url(url)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

