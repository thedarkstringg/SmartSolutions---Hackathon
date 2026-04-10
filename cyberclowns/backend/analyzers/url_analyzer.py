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
    🤖 PRIORITY 1: Gemini AI first (detailed typosquatting/phishing analysis) - 60% weight
    2. ML model classification - 25% weight
    3. Rule-based analysis - 15% weight

    Returns dict with score, indicators, features, and metadata
    """
    try:
        features = extract_url_features(url)
        indicators = []
        gemini_called = False
        gemini_score = None
        gemini_details = ""
        ml_score = None
        rule_score = 0

        # ⭐ PRIORITY 1: Call Gemini FIRST for detailed analysis
        if GEMINI_API_KEY:
            try:
                gemini_called = True
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-1.5-flash")

                system_prompt = """You are a cybersecurity expert specializing in phishing URL detection.
Analyze the given URL CAREFULLY for:
1. TYPOSQUATTING - legitimate domain names with slight misspellings (PayPal→PayPal, Amazon→Amazo)
2. Domain spoofing - lookalike domains mimicking popular sites
3. Suspicious subdomains that don't match legitimate patterns
4. Credential harvesting patterns (login, verify, confirm, update)
5. Obfuscation techniques (IP addresses, encoding, redirects)
6. Brand impersonation
7. Known phishing patterns or suspicious TLDs

Return ONLY a valid JSON object with NO markdown, NO backticks:
{
  "score": <float 0.0-1.0>,
  "risk_level": "safe" | "low" | "medium" | "high" | "critical",
  "indicators": [<list of specific suspicious elements>],
  "typosquatting_analysis": "<detailed analysis of typosquatting attempts>",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<brief explanation>"
}
0.0=definitely safe, 1.0=definitely phishing"""

                user_message = f"""Analyze for PHISHING/TYPOSQUATTING:
URL: {url}
Features: {json.dumps(features, indent=2)}"""

                response = model.generate_content(f"{system_prompt}\n\n{user_message}")
                response_text = response.text.strip()

                # Remove markdown
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

                result = json.loads(response_text)
                gemini_score = float(result.get("score", 0.5))
                indicators = result.get("indicators", [])
                gemini_details = result.get("typosquatting_analysis", "No typosquatting detected")
                risk_level = result.get("risk_level", "medium")

                logger.info(f"\n🤖 GEMINI (1st PRIORITY): {url}")
                logger.info(f"   Score: {gemini_score:.2f} | Risk: {risk_level}")
                logger.info(f"   Typosquatting: {gemini_details[:120]}...")
                logger.info(f"   Reasoning: {result.get('reasoning', 'N/A')}")

            except Exception as e:
                logger.warning(f"Gemini failed: {e} - using fallback")
                gemini_called = False

        # PRIORITY 2: Rule-based analysis
        rule_score = rule_based_score(features)
        logger.info(f"   Rule score: {rule_score:.2f}")

        # PRIORITY 3: ML model
        try:
            ml_score = ml_detector.predict(features)
            logger.info(f"   ML score: {ml_score:.2f}")
        except Exception as e:
            logger.warning(f"ML failed: {e}")
            ml_score = None

        # BLEND with HIGH priority to Gemini
        if gemini_score is not None:
            if ml_score is not None:
                # Gemini: 60%, ML: 25%, Rule: 15%
                final_score = (gemini_score * 0.60) + (ml_score * 0.25) + (rule_score * 0.15)
            else:
                # Gemini: 70%, Rule: 30%
                final_score = (gemini_score * 0.70) + (rule_score * 0.30)
            logger.info(f"✅ USING GEMINI (HIGH PRIORITY) - Final: {final_score:.2f}\n")
        else:
            if ml_score is not None:
                final_score = (ml_score * 0.6) + (rule_score * 0.4)
            else:
                final_score = rule_score
            logger.info(f"⚠️  Gemini failed - using ML/Rule - Final: {final_score:.2f}\n")

        # Add rule indicators if Gemini didn't find enough
        if len(indicators) < 2:
            if features["has_ip_address"]:
                indicators.append("URL contains IP address")
            if features["has_at_symbol"]:
                indicators.append("URL contains @ symbol")
            if not features["is_https"]:
                indicators.append("Uses HTTP (not HTTPS)")
            if len(features["suspicious_keywords"]) > 0:
                indicators.append(f"Suspicious keywords: {', '.join(features['suspicious_keywords'])}")

        return {
            "score": round(final_score, 2),
            "indicators": indicators,
            "gemini_details": gemini_details,
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
