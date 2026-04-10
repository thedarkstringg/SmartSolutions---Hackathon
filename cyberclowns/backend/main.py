import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
from datetime import datetime, timedelta
from urllib.parse import urlparse
import logging
import time
import hashlib
import secrets
import jwt
import json
from pathlib import Path

from analyzers.url_analyzer import analyze_url
from analyzers.visual_analyzer import analyze_visual
from analyzers.behavior_analyzer import analyze_behavior
from utils.confidence import aggregate_scores
from metrics import MetricsCollector
from splunk_logger import SplunkLogger, test_splunk_connection

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Tilloff - Advanced Phishing Analyzer",
    description="Backend API for advanced phishing detection",
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

# Mount static files
app.mount("/", StaticFiles(directory=".", html=True), name="static")

# Authentication Models
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None

# User Storage (File-based for demo, would be Supabase in production)
USERS_FILE = Path(__file__).parent / "data" / "users.json"

def load_users():
    """Load users from file"""
    try:
        if USERS_FILE.exists():
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading users: {e}")
    return {}

def save_users(users):
    """Save users to file"""
    try:
        USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving users: {e}")

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_obj.hex()}"

def verify_password(password: str, hash_str: str) -> bool:
    """Verify password against hash"""
    try:
        salt, hashed = hash_str.split('$')
        hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return hash_obj.hex() == hashed
    except:
        return False

def generate_token(user_id: str, email: str) -> str:
    """Generate JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=30),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, 'your-secret-key-change-in-production', algorithm='HS256')

@app.get("/auth")
async def serve_auth():
    """Serve the authentication page."""
    from fastapi.responses import FileResponse
    return FileResponse("auth.html", media_type="text/html")


@app.get("/dashboard")
async def serve_dashboard():
    """Serve the analytics dashboard HTML."""
    from fastapi.responses import FileResponse
    return FileResponse("dashboard.html", media_type="text/html")


@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new user"""
    users = load_users()

    # Validate input
    if not request.name or len(request.name) < 2:
        return AuthResponse(success=False, message="Name must be at least 2 characters")

    if not request.email or '@' not in request.email:
        return AuthResponse(success=False, message="Invalid email address")

    if not request.password or len(request.password) < 8:
        return AuthResponse(success=False, message="Password must be at least 8 characters")

    # Check if user exists
    if request.email in users:
        return AuthResponse(success=False, message="Email already registered")

    # Create user
    user_id = secrets.token_hex(8)
    hashed_password = hash_password(request.password)

    users[request.email] = {
        'id': user_id,
        'name': request.name,
        'email': request.email,
        'password_hash': hashed_password,
        'created_at': datetime.utcnow().isoformat(),
        'scans': 0
    }

    save_users(users)

    # Generate token
    token = generate_token(user_id, request.email)

    logger.info(f"User registered: {request.email}")

    return AuthResponse(
        success=True,
        message="Registration successful",
        token=token,
        user={
            'id': user_id,
            'name': request.name,
            'email': request.email
        }
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Log in a user"""
    users = load_users()

    # Validate input
    if not request.email or not request.password:
        return AuthResponse(success=False, message="Email and password required")

    # Find user
    if request.email not in users:
        return AuthResponse(success=False, message="Email or password incorrect")

    user = users[request.email]

    # Verify password
    if not verify_password(request.password, user['password_hash']):
        return AuthResponse(success=False, message="Email or password incorrect")

    # Generate token
    token = generate_token(user['id'], user['email'])

    logger.info(f"User logged in: {request.email}")

    return AuthResponse(
        success=True,
        message="Login successful",
        token=token,
        user={
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'scans': user.get('scans', 0)
        }
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
    start_time = time.time()
    logger.info(f"Analyzing URL: {request.url}")

    # Whitelist of known safe domains - skip detailed analysis
    WHITELIST = [
        'localhost', '127.0.0.1', '192.168', '10.0',
        'chrome://', 'about:',
        'google.com', 'github.com', 'microsoft.com', 'apple.com',
        'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
        'linkedin.com', 'reddit.com', 'stackoverflow.com', 'amazon.com',
        'cloudflare.com', 'aws.amazon.com'
    ]

    # Check if URL is whitelisted
    is_whitelisted = any(domain in request.url for domain in WHITELIST)

    if is_whitelisted:
        logger.info(f"[✅ WHITELISTED] {request.url}")
        parsed_url = urlparse(request.url)
        site_info = {
            "domain": parsed_url.netloc or "unknown",
            "is_https": parsed_url.scheme == "https",
            "url_length": len(request.url),
        }

        response = AnalysisResponse(
            url_score=0.0,
            visual_score=0.0,
            behavior_score=0.0,
            confidence_score=1.0,
            verdict="safe",
            warnings=[],  # No warnings for whitelisted sites
            url_indicators=[],
            features={},
            scan_timestamp=datetime.utcnow().isoformat() + "Z",
            site_info=site_info,
        )

        # Log metrics
        MetricsCollector.log_scan(
            url=request.url,
            verdict="safe",
            confidence_score=1.0,
            url_score=0.0,
            visual_score=0.0,
            behavior_score=0.0,
            response_time_ms=(time.time() - start_time) * 1000,
            warnings=[],
        )

        return response

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

        # Calculate response time
        response_time_ms = (time.time() - start_time) * 1000

        # Log result
        logger.info(f"Analysis complete for {request.url}: verdict={verdict}, confidence={confidence_score}")

        # Log metrics for analytics
        MetricsCollector.log_scan(
            url=request.url,
            verdict=verdict,
            confidence_score=confidence_score,
            url_score=url_score,
            visual_score=visual_score,
            behavior_score=behavior_score,
            response_time_ms=response_time_ms,
            warnings=warnings,
        )

        # 🆕 Send to Splunk in background (don't block response)
        asyncio.create_task(
            SplunkLogger.log_phishing_detection(
                url=request.url,
                verdict=verdict,
                confidence=confidence_score,
                url_score=url_score,
                visual_score=visual_score,
                behavior_score=behavior_score,
                warnings=warnings,
                response_time_ms=response_time_ms,
                source="api_backend",
            )
        )

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
        "service": "Tilloff - Advanced Phishing Analyzer",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/analytics/stats")
async def get_analytics_stats():
    """Get overall analytics statistics."""
    return MetricsCollector.get_statistics()


@app.get("/api/analytics/timeline")
async def get_threat_timeline():
    """Get threat timeline for charts."""
    return MetricsCollector.get_threat_timeline()


@app.post("/api/test/splunk")
async def test_splunk():
    """Test Splunk connectivity."""
    result = await test_splunk_connection()
    return {
        "status": "connected" if result else "disconnected",
        "result": result,
    }


@app.get("/api/metrics")
async def get_metrics():
    """Get all raw metrics for dashboard visualization."""
    try:
        from pathlib import Path
        import json

        metrics_file = Path(__file__).parent / "data" / "metrics.jsonl"
        metrics = []

        if metrics_file.exists():
            with open(metrics_file, "r") as f:
                for line in f:
                    if line.strip():
                        try:
                            metrics.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

        return metrics
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return []


@app.on_event("startup")
async def startup_event():
    """Test Splunk connection on startup."""
    logger.info("🚀 Tilloff - Advanced Phishing Analyzer Starting...")
    await test_splunk_connection()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
