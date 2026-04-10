import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
from datetime import datetime
from urllib.parse import urlparse
import logging

from analyzers.url_analyzer import analyze_url
from analyzers.visual_analyzer import analyze_visual
from analyzers.behavior_analyzer import analyze_behavior
from utils.confidence import aggregate_scores

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CyberClowns Phishing Detector",
    description="Backend API for phishing detection",
    version="1.0"
)

# Add CORS middleware to allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    url: str
    screenshot_base64: Optional[str] = None
    dom_snapshot: Optional[str] = None
    behavior_signals: dict


class AnalysisResponse(BaseModel):
    url_score: float
    visual_score: float
    behavior_score: float
    confidence_score: float
    verdict: str
    warnings: List[str]
    url_indicators: List[str] = []
    features: Dict[str, Any] = {}
    scan_timestamp: str
    site_info: Dict[str, Any]


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    """
    Analyze a URL and associated signals for phishing indicators.

    Args:
        request: AnalysisRequest with url, screenshot_base64, dom_snapshot, behavior_signals

    Returns:
        AnalysisResponse with scores, verdict, warnings, and analysis metadata
    """
    # Log incoming analysis request
    logger.info(f"Analyzing URL: {request.url}")

    try:
        # Handle missing screenshot gracefully
        screenshot_base64 = request.screenshot_base64 or ""

        # Run all analyses concurrently with individual error handling
        try:
            url_result = await analyze_url(request.url)
        except Exception as e:
            logger.error(f"URL analysis failed: {e}")
            url_result = {
                "score": 0.5,
                "indicators": [f"URL analysis error: {str(e)}"],
                "features": {},
                "rule_score": 0.5,
                "gemini_score": None,
                "gemini_called": False,
            }

        try:
            visual_result = await analyze_visual(screenshot_base64, request.url)
        except Exception as e:
            logger.error(f"Visual analysis failed: {e}")
            visual_result = {
                "score": 0.5,
                "matched_site": None,
                "hash_distance": -1,
                "verdict": "error",
            }

        try:
            behavior_result = await analyze_behavior(request.behavior_signals or {})
        except Exception as e:
            logger.error(f"Behavior analysis failed: {e}")
            behavior_result = {"score": 0.5, "triggered_signals": []}

        url_score = url_result.get("score", 0.5)
        visual_score = visual_result.get("score", 0.5)
        behavior_score = behavior_result.get("score", 0.5)

        # Aggregate scores
        confidence_score = aggregate_scores(url_score, visual_score, behavior_score)

        # Determine verdict
        if confidence_score < 0.35:
            verdict = "safe"
        elif confidence_score < 0.65:
            verdict = "suspicious"
        else:
            verdict = "phishing"

        # Collect warnings
        warnings = (
            url_result.get("indicators", [])
            + behavior_result.get("triggered_signals", [])
        )

        if visual_result.get("matched_site"):
            verdict_type = visual_result.get("verdict", "")
            if verdict_type == "clone_detected":
                warnings.insert(
                    0,
                    f"⚠️ VISUAL CLONE: Page mimics {visual_result.get('matched_site')} login interface",
                )
            elif verdict_type == "suspicious":
                warnings.append(
                    f"Visual similarity to {visual_result.get('matched_site')} (distance: {visual_result.get('hash_distance')})"
                )

        # Extract site info
        parsed_url = urlparse(request.url)
        site_info = {
            "domain": parsed_url.netloc or "unknown",
            "is_https": parsed_url.scheme == "https",
            "url_length": len(request.url),
        }

        # Get timestamp
        scan_timestamp = datetime.utcnow().isoformat() + "Z"

        # Log result
        logger.info(f"Analysis complete for {request.url}: verdict={verdict}, confidence={confidence_score}")

        return AnalysisResponse(
            url_score=round(url_score, 2),
            visual_score=round(visual_score, 2),
            behavior_score=round(behavior_score, 2),
            confidence_score=confidence_score,
            verdict=verdict,
            warnings=warnings,
            url_indicators=url_result.get("indicators", []),
            features=url_result.get("features", {}),
            scan_timestamp=scan_timestamp,
            site_info=site_info,
        )

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint for extension integration."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
