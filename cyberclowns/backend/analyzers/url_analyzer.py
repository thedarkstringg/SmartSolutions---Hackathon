import google.generativeai as genai
import os
import json
import re
from dotenv import load_dotenv
import logging
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from ml_detector import PhishingMLDetector

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ml_detector = PhishingMLDetector.get_instance()


def extract_url_features(url: str) -> dict:
    """
    Extract features from URL for rule-based analysis.

    Returns dict with:
    - has_ip_address: bool
    - url_length: int
    - num_subdomains: int
    - has_at_symbol: bool
    - has_double_slash_redirect: bool
    - has_hyphen_in_domain: bool
    - suspicious_keywords: list
    - num_special_chars: int
    - is_https: bool
    - domain_length: int
    """
    features = {
        "has_ip_address": False,
        "url_length": len(url),
        "num_subdomains": 0,
        "has_at_symbol": False,
        "has_double_slash_redirect": False,
        "has_hyphen_in_domain": False,
        "suspicious_keywords": [],
        "num_special_chars": 0,
        "is_https": False,
        "domain_length": 0,
    }

    # Check for HTTPS
    features["is_https"] = url.startswith("https://")

    # Check for @ symbol (credential usage)
    features["has_at_symbol"] = "@" in url

    # Check for double slash (redirect technique)
    features["has_double_slash_redirect"] = "//" in url[9:]  # Skip https://

    # Count special characters
    special_chars = set("@!#%&()[]{}=?^~`|\\<>")
    features["num_special_chars"] = sum(1 for c in url if c in special_chars)

    # Extract domain part
    try:
        # Remove protocol
        domain_part = url.split("://")[1] if "://" in url else url
        domain = domain_part.split("/")[0]

        features["domain_length"] = len(domain)

        # Check for IP address (simple check)
        ip_pattern = r"(\d{1,3}\.){3}\d{1,3}"
        features["has_ip_address"] = bool(re.search(ip_pattern, domain))

        # Count subdomains (dots in domain)
        features["num_subdomains"] = domain.count(".")

        # Check for hyphens in domain
        features["has_hyphen_in_domain"] = "-" in domain

        # Check for suspicious keywords
        suspicious_keywords = [
            "login", "secure", "account", "update", "verify", "bank",
            "paypal", "signin", "confirm", "password", "check", "access"
        ]

        url_lower = url.lower()
        for keyword in suspicious_keywords:
            if keyword in url_lower:
                features["suspicious_keywords"].append(keyword)

    except Exception as e:
        logger.warning(f"Error extracting domain features: {e}")

    return features


def rule_based_score(features: dict) -> float:
    """
    Calculate phishing score based on URL features (no API calls).

    Returns float 0.0-1.0
    """
    score = 0.0

    if features["has_ip_address"]:
        score += 0.4

    if features["url_length"] > 75:
        score += 0.1

    if features["num_subdomains"] > 3:
        score += 0.15

    if features["has_at_symbol"]:
        score += 0.3

    if features["has_double_slash_redirect"]:
        score += 0.2

    if len(features["suspicious_keywords"]) > 1:
        score += 0.2

    if not features["is_https"]:
        score += 0.15

    return min(score, 1.0)


async def analyze_url(url: str) -> dict:
    """
    Analyze URL for phishing indicators using hybrid approach:
    1. Fast local rule-based analysis
    2. ML model classification
    3. Optional Gemini AI analysis if rule score is moderate

    Returns dict with score, indicators, features, and metadata
    """
    try:
        # Step 1: Extract features and get rule-based score
        features = extract_url_features(url)
        rule_score = rule_based_score(features)

        indicators = []
        gemini_called = False
        gemini_score = None
        ml_score = None

        # Step 2: Get ML model prediction
        try:
            ml_score = ml_detector.predict(features)
            logger.info(f"ML score for {url}: {ml_score:.2f}")
        except Exception as e:
            logger.warning(f"ML prediction failed: {e}")
            ml_score = None

        # Step 3: Blend scores intelligently
        # If we have both rule and ML scores, use both
        if ml_score is not None:
            # Combine: 50% rule-based, 50% ML
            blended_score = (rule_score * 0.5) + (ml_score * 0.5)
        else:
            blended_score = rule_score

        # Step 4: Only call Gemini if score is moderate
        # Skip if very high confidence (>0.7 already phishing) or very low (<0.1 definitely safe)
        if 0.1 <= blended_score <= 0.7 and GEMINI_API_KEY:
            try:
                gemini_called = True
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-1.5-flash")

                system_prompt = """You are a cybersecurity expert specializing in phishing URL detection.
Analyze the given URL and return ONLY a valid JSON object with NO markdown,
NO explanation, NO backticks. Format:
{"score": <float 0.0-1.0>, "indicators": [<list of specific suspicious elements>]}
Score meaning: 0.0=definitely safe, 1.0=definitely phishing"""

                user_message = f"""Analyze this URL for phishing: {url}

URL features detected: {json.dumps(features)}"""

                response = model.generate_content(f"{system_prompt}\n\n{user_message}")
                response_text = response.text.strip()

                # Remove markdown backticks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                result = json.loads(response_text)
                gemini_score = float(result.get("score", blended_score))
                indicators = result.get("indicators", [])

                # Final blend: 40% Gemini, 30% rule, 30% ML
                final_score = (gemini_score * 0.4) + (rule_score * 0.3)
                if ml_score is not None:
                    final_score = (gemini_score * 0.4) + (rule_score * 0.2) + (ml_score * 0.4)

            except Exception as e:
                logger.warning(f"Gemini analysis failed: {e}")
                final_score = blended_score
                indicators = features.get("suspicious_keywords", [])
        else:
            final_score = blended_score
            # Use features as indicators if no Gemini call
            if features["has_ip_address"]:
                indicators.append("URL contains IP address instead of domain")
            if features["has_at_symbol"]:
                indicators.append("URL contains @ symbol (credential embedding)")
            if features["has_double_slash_redirect"]:
                indicators.append("URL contains double slash redirect pattern")
            if len(features["suspicious_keywords"]) > 0:
                indicators.append(f"Suspicious keywords found: {', '.join(features['suspicious_keywords'])}")
            if not features["is_https"]:
                indicators.append("URL uses HTTP instead of HTTPS")

        return {
            "score": round(final_score, 2),
            "indicators": indicators,
            "features": features,
            "rule_score": round(rule_score, 2),
            "ml_score": round(ml_score, 2) if ml_score else None,
            "gemini_score": round(gemini_score, 2) if gemini_score else None,
            "gemini_called": gemini_called
        }

    except Exception as e:
        logger.error(f"URL analysis error: {e}")
        return {
            "score": 0.5,
            "indicators": [f"Analysis error: {str(e)}"],
            "features": {},
            "rule_score": 0.5,
            "ml_score": None,
            "gemini_score": None,
            "gemini_called": False
        }
