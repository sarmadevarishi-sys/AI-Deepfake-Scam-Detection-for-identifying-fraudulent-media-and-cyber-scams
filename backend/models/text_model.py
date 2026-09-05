"""
SatyaKavach — Text / SMS Scam Detection using HuggingFace Transformers
Uses a pretrained phishing / spam classifier.
"""

_pipeline = None

def _get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import pipeline
        print("[TextModel] Loading HuggingFace scam/phishing text classifier...")
        _pipeline = pipeline(
            "text-classification",
            model="mrm8488/bert-tiny-finetuned-sms-spam-detection",
            device=-1  # CPU
        )
        print("[TextModel] Text model loaded successfully.")
    except Exception as e:
        print(f"[TextModel] WARNING: Could not load text model: {e}")
        _pipeline = None
    return _pipeline


# Simple keyword heuristic as fallback
SCAM_KEYWORDS = [
    "urgent", "click here", "verify your account", "you have won",
    "prize", "lottery", "otp", "send money", "bank account",
    "suspend", "limited time", "act now", "free gift", "password",
    "congratulations", "selected", "claim", "kyc", "aadhar",
    "income tax", "refund", "emi", "loan approved"
]

def analyze_text(text: str) -> dict:
    """
    Analyze a text string for scam / phishing indicators.
    Returns risk score, label, and matched patterns.
    """
    pipe = _get_pipeline()
    text_lower = text.lower()

    if pipe is not None:
        # --- Real HuggingFace inference ---
        try:
            results = pipe(text[:512])  # model max length
            # Labels are typically "ham" (safe) or "spam" (scam)
            spam_entry = next((r for r in results if r["label"].lower() in ["spam", "label_1", "1"]), None)
            ham_entry  = next((r for r in results if r["label"].lower() in ["ham",  "label_0", "0"]), None)

            if spam_entry:
                risk_score = round(spam_entry["score"] * 100)
            elif ham_entry:
                risk_score = round((1 - ham_entry["score"]) * 100)
            else:
                risk_score = 50

            matched = [kw for kw in SCAM_KEYWORDS if kw in text_lower]
            return {
                "riskScore": risk_score,
                "label": "HIGH" if risk_score > 60 else ("MEDIUM" if risk_score > 30 else "LOW"),
                "method": "HuggingFace BERT — mrm8488/bert-tiny-finetuned-sms-spam-detection",
                "rawResults": results,
                "matchedKeywords": matched,
                "modelLoaded": True
            }
        except Exception as e:
            pass  # fall through to heuristic

    # --- Fallback: keyword heuristic ---
    matched = [kw for kw in SCAM_KEYWORDS if kw in text_lower]
    risk_score = min(100, len(matched) * 20)
    return {
        "riskScore": risk_score,
        "label": "HIGH" if risk_score > 60 else ("MEDIUM" if risk_score > 30 else "LOW"),
        "method": "Keyword Heuristic (HuggingFace model unavailable)",
        "matchedKeywords": matched,
        "modelLoaded": False
    }
