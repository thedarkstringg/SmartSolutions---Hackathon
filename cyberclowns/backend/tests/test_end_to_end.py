"""
CyberClowns Backend End-to-End Test Suite

Run with: python backend/tests/test_end_to_end.py

Tests the backend API against real phishing scenarios and legitimate sites.
No pytest required - just run directly!
"""

import requests
import json
import base64
import time
from PIL import Image
import io
import sys

BACKEND_URL = "http://localhost:8000"

# Color codes for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


def print_header():
    print("\n" + "=" * 60)
    print(f"{BOLD}{BLUE}  CyberClowns Phishing Detector — E2E Test Suite{RESET}")
    print("=" * 60)
    print(f"Backend: {BACKEND_URL}\n")


def print_result(test_name, passed, details=""):
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    print(f"{status} | {test_name}")
    if details:
        print(f"       {details}")


def print_section(title):
    print(f"\n{BOLD}{YELLOW}>>> {title}{RESET}")


def create_dummy_screenshot_base64():
    """Create a simple white 1280x800 image as fake screenshot."""
    img = Image.new("RGB", (1280, 800), color=(255, 255, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


# === TEST 1: Health Check ===
def test_health():
    """Test that backend is running and responding to health checks."""
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=5)
        data = r.json()
        passed = r.status_code == 200 and data.get("status") == "ok"
        print_result(
            "Health Check",
            passed,
            f"Status: {data.get('status')}, Version: {data.get('version')}",
        )
        return passed
    except Exception as e:
        print_result("Health Check", False, f"Error: {str(e)}")
        return False


# === TEST 2: Safe URL (google.com) ===
def test_safe_url():
    """Test analysis of a legitimate site (google.com)."""
    payload = {
        "url": "https://www.google.com",
        "screenshot_base64": create_dummy_screenshot_base64(),
        "dom_snapshot": "<html><body>Google Search</body></html>",
        "behavior_signals": {
            "hidden_field_count": 0,
            "password_field_count": 0,
            "has_hidden_fields": False,
            "redirect_count": 0,
            "redirect_methods": [],
            "has_obfuscated_js": False,
            "obfuscation_patterns": [],
            "pattern_count": 0,
            "cookie_count": 2,
            "has_suspicious_cookies": False,
            "suspicious_cookie_names": [],
            "total_resources": 15,
            "external_resources": 3,
            "external_resources_ratio": 0.2,
            "suspicious_form_actions": [],
            "has_suspicious_external": False,
            "has_urgency_text": False,
            "urgency_phrases": [],
            "has_disabled_right_click": False,
            "has_credential_form": False,
            "favicon_external": False,
            "title": "Google",
            "description": "Search the world's information",
            "referrer": "",
            "url": "https://www.google.com",
            "load_time_ms": 1234,
            "charset": "UTF-8",
        },
    }
    try:
        r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and data.get("verdict") in [
            "safe",
            "suspicious",
        ]
        print_result(
            "Safe URL (google.com)",
            passed,
            f"Verdict: {data.get('verdict')}, Confidence: {data.get('confidence_score')}",
        )
        return passed
    except Exception as e:
        print_result("Safe URL (google.com)", False, f"Error: {str(e)}")
        return False


# === TEST 3: Obvious Phishing URL ===
def test_phishing_url():
    """Test detection of obvious phishing URL with multiple red flags."""
    payload = {
        "url": "http://paypa1-secure-login.verify-account.com/signin/confirm/password",
        "screenshot_base64": create_dummy_screenshot_base64(),
        "dom_snapshot": "<html><body><form action='http://evil.com'><input type='hidden' name='cc'/><input type='password'/></form></body></html>",
        "behavior_signals": {
            "hidden_field_count": 2,
            "password_field_count": 1,
            "has_hidden_fields": True,
            "redirect_count": 4,
            "redirect_methods": ["meta-refresh", "location-assignment"],
            "has_obfuscated_js": True,
            "obfuscation_patterns": ["eval-usage", "atob-decoding"],
            "pattern_count": 6,
            "cookie_count": 0,
            "has_suspicious_cookies": True,
            "suspicious_cookie_names": ["session_token", "auth_id"],
            "total_resources": 20,
            "external_resources": 17,
            "external_resources_ratio": 0.85,
            "suspicious_form_actions": ["http://evil.com"],
            "has_suspicious_external": True,
            "has_urgency_text": True,
            "urgency_phrases": ["verify now", "account suspended", "act now"],
            "has_disabled_right_click": True,
            "has_credential_form": True,
            "favicon_external": True,
            "title": "PayPal - Secure Login",
            "description": "Access your account",
            "referrer": "http://phishing-link.ru",
            "url": "http://paypa1-secure-login.verify-account.com/signin",
            "load_time_ms": 450,
            "charset": "UTF-8",
        },
    }
    try:
        r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and data.get("verdict") in [
            "suspicious",
            "phishing",
        ]
        print_result(
            "Phishing URL Detection",
            passed,
            f"Verdict: {data.get('verdict')}, Confidence: {data.get('confidence_score')}",
        )
        if data.get("warnings"):
            print(f"       Warnings: {', '.join(data['warnings'][:2])}")
        return passed
    except Exception as e:
        print_result("Phishing URL Detection", False, f"Error: {str(e)}")
        return False


# === TEST 4: IP Address URL ===
def test_ip_url():
    """Test detection of suspicious IP-based URLs."""
    payload = {
        "url": "http://192.168.1.105/bank/login/secure/verify",
        "screenshot_base64": create_dummy_screenshot_base64(),
        "dom_snapshot": "<html><body><input type='password'/></body></html>",
        "behavior_signals": {
            "hidden_field_count": 1,
            "password_field_count": 1,
            "has_hidden_fields": True,
            "redirect_count": 1,
            "redirect_methods": [],
            "has_obfuscated_js": False,
            "obfuscation_patterns": [],
            "pattern_count": 0,
            "cookie_count": 0,
            "has_suspicious_cookies": False,
            "suspicious_cookie_names": [],
            "total_resources": 8,
            "external_resources": 2,
            "external_resources_ratio": 0.25,
            "suspicious_form_actions": [],
            "has_suspicious_external": False,
            "has_urgency_text": False,
            "urgency_phrases": [],
            "has_disabled_right_click": False,
            "has_credential_form": True,
            "favicon_external": False,
            "title": "Bank Login",
            "description": "Secure banking portal",
            "referrer": "",
            "url": "http://192.168.1.105/bank",
            "load_time_ms": 890,
            "charset": "UTF-8",
        },
    }
    try:
        r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and data.get("url_score", 0) > 0.3
        print_result(
            "IP Address URL (High Risk)",
            passed,
            f"URL Score: {data.get('url_score')}, Verdict: {data.get('verdict')}",
        )
        return passed
    except Exception as e:
        print_result("IP Address URL", False, f"Error: {str(e)}")
        return False


# === TEST 5: Response Structure ===
def test_response_structure():
    """Test that response contains all required fields."""
    payload = {
        "url": "https://example.com",
        "screenshot_base64": create_dummy_screenshot_base64(),
        "dom_snapshot": "<html><body>Example</body></html>",
        "behavior_signals": {
            "hidden_field_count": 0,
            "password_field_count": 0,
            "has_hidden_fields": False,
            "redirect_count": 0,
            "redirect_methods": [],
            "has_obfuscated_js": False,
            "obfuscation_patterns": [],
            "pattern_count": 0,
            "cookie_count": 1,
            "has_suspicious_cookies": False,
            "suspicious_cookie_names": [],
            "total_resources": 5,
            "external_resources": 1,
            "external_resources_ratio": 0.2,
            "suspicious_form_actions": [],
            "has_suspicious_external": False,
            "has_urgency_text": False,
            "urgency_phrases": [],
            "has_disabled_right_click": False,
            "has_credential_form": False,
            "favicon_external": False,
            "title": "Example",
            "description": "Example site",
            "referrer": "",
            "url": "https://example.com",
            "load_time_ms": 500,
            "charset": "UTF-8",
        },
    }
    try:
        r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
        data = r.json()
        required_fields = [
            "url_score",
            "visual_score",
            "behavior_score",
            "confidence_score",
            "verdict",
            "warnings",
            "scan_timestamp",
            "site_info",
            "features",
        ]
        missing = [f for f in required_fields if f not in data]
        passed = len(missing) == 0
        print_result(
            "Response Structure Validation",
            passed,
            f"Missing: {missing}" if missing else "✓ All required fields present",
        )
        return passed
    except Exception as e:
        print_result("Response Structure Validation", False, f"Error: {str(e)}")
        return False


# === TEST 6: Performance ===
def test_performance():
    """Test that analysis completes within acceptable timeframe."""
    payload = {
        "url": "https://example.com",
        "screenshot_base64": create_dummy_screenshot_base64(),
        "dom_snapshot": "<html><body>Example</body></html>",
        "behavior_signals": {
            "hidden_field_count": 0,
            "password_field_count": 0,
            "has_hidden_fields": False,
            "redirect_count": 0,
            "redirect_methods": [],
            "has_obfuscated_js": False,
            "obfuscation_patterns": [],
            "pattern_count": 0,
            "cookie_count": 1,
            "has_suspicious_cookies": False,
            "suspicious_cookie_names": [],
            "total_resources": 5,
            "external_resources": 1,
            "external_resources_ratio": 0.2,
            "suspicious_form_actions": [],
            "has_suspicious_external": False,
            "has_urgency_text": False,
            "urgency_phrases": [],
            "has_disabled_right_click": False,
            "has_credential_form": False,
            "favicon_external": False,
            "title": "Example",
            "description": "Example site",
            "referrer": "",
            "url": "https://example.com",
            "load_time_ms": 500,
            "charset": "UTF-8",
        },
    }
    try:
        start = time.time()
        r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
        elapsed = time.time() - start
        passed = elapsed < 10  # Should respond within 10 seconds
        print_result(
            "Performance Test (<10s)",
            passed,
            f"Response time: {elapsed:.2f}s",
        )
        return passed
    except Exception as e:
        print_result("Performance Test", False, f"Error: {str(e)}")
        return False


# === TEST 7: Backend Validation ===
def test_verdict_logic():
    """Test that confidence scores map to correct verdicts."""
    test_cases = [
        {
            "expected_verdict": "safe",
            "url": "https://www.google.com",
            "behavior": {
                "hidden_field_count": 0, "password_field_count": 0, "has_hidden_fields": False,
                "redirect_count": 0, "redirect_methods": [], "has_obfuscated_js": False,
                "obfuscation_patterns": [], "pattern_count": 0, "cookie_count": 2,
                "has_suspicious_cookies": False, "suspicious_cookie_names": [],
                "total_resources": 15, "external_resources": 3, "external_resources_ratio": 0.2,
                "suspicious_form_actions": [], "has_suspicious_external": False,
                "has_urgency_text": False, "urgency_phrases": [], "has_disabled_right_click": False,
                "has_credential_form": False, "favicon_external": False,
                "title": "Google", "description": "Search", "referrer": "", "url": "https://www.google.com",
                "load_time_ms": 1000, "charset": "UTF-8",
            }
        },
        {
            "expected_verdict": "suspicious",
            "url": "https://paypa1-account.verify-secure.com/login",  # Multiple suspicious keywords
            "behavior": {
                "hidden_field_count": 1, "password_field_count": 1, "has_hidden_fields": True,
                "redirect_count": 2, "redirect_methods": ["meta-refresh"], "has_obfuscated_js": True,
                "obfuscation_patterns": ["eval-usage"], "pattern_count": 3, "cookie_count": 0,
                "has_suspicious_cookies": True, "suspicious_cookie_names": ["session"],
                "total_resources": 20, "external_resources": 12, "external_resources_ratio": 0.6,
                "suspicious_form_actions": ["http://external.com"], "has_suspicious_external": True,
                "has_urgency_text": True, "urgency_phrases": ["verify"], "has_disabled_right_click": False,
                "has_credential_form": True, "favicon_external": False,
                "title": "Login", "description": "Account", "referrer": "", "url": "https://paypa1-account.verify-secure.com",
                "load_time_ms": 500, "charset": "UTF-8",
            }
        },
        {
            "expected_verdict": "phishing",
            "url": "http://192.168.1.1/bank/login",  # IP address + HTTP + many signals
            "behavior": {
                "hidden_field_count": 3, "password_field_count": 2, "has_hidden_fields": True,
                "redirect_count": 4, "redirect_methods": ["meta-refresh", "location-assignment"], "has_obfuscated_js": True,
                "obfuscation_patterns": ["eval-usage", "atob-decoding"], "pattern_count": 6, "cookie_count": 0,
                "has_suspicious_cookies": True, "suspicious_cookie_names": ["auth", "token"],
                "total_resources": 25, "external_resources": 20, "external_resources_ratio": 0.8,
                "suspicious_form_actions": ["http://evil.ru"], "has_suspicious_external": True,
                "has_urgency_text": True, "urgency_phrases": ["urgent", "verify", "account suspended"], "has_disabled_right_click": True,
                "has_credential_form": True, "favicon_external": True,
                "title": "Login", "description": "Bank", "referrer": "http://spam.ru", "url": "http://192.168.1.1/bank",
                "load_time_ms": 300, "charset": "UTF-8",
            }
        },
    ]

    all_passed = True

    for test_case in test_cases:
        expected_verdict = test_case["expected_verdict"]
        payload = {
            "url": test_case["url"],
            "screenshot_base64": create_dummy_screenshot_base64(),
            "dom_snapshot": "<html><body>Test</body></html>",
            "behavior_signals": test_case["behavior"],
        }

        try:
            r = requests.post(f"{BACKEND_URL}/analyze", json=payload, timeout=30)
            data = r.json()
            passed = data.get("verdict") == expected_verdict
            all_passed = all_passed and passed
            print_result(
                f"  Verdict Logic: {expected_verdict} (confidence: {data.get('confidence_score')})",
                passed,
                f"Got verdict: {data.get('verdict')}",
            )
        except Exception as e:
            print_result(
                f"  Verdict Logic: {expected_verdict}", False, f"Error: {str(e)}"
            )
            all_passed = False

    return all_passed


if __name__ == "__main__":
    print_header()

    results = []

    # Section 1: Connectivity
    print_section("Connectivity Tests")
    results.append(("Health Check", test_health()))

    if not results[0][1]:
        print(
            f"\n{RED}❌ Backend is not running! Start it with:{RESET}"
        )
        print("   cd cyberclowns/backend")
        print("   python main.py")
        print()
        sys.exit(1)

    # Section 2: Core Analysis
    print_section("Core Analysis Tests")
    results.append(("Safe URL", test_safe_url()))
    results.append(("Phishing Detection", test_phishing_url()))
    results.append(("IP Address URL", test_ip_url()))

    # Section 3: API Validation
    print_section("API Validation Tests")
    results.append(("Response Structure", test_response_structure()))
    results.append(("Verdict Logic", test_verdict_logic()))

    # Section 4: Performance
    print_section("Performance Tests")
    results.append(("Performance", test_performance()))

    # Summary
    print("\n" + "=" * 60)
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)

    if passed_count == total_count:
        print(f"{GREEN}{BOLD}✅ All {total_count} tests passed!{RESET}")
        print("Backend is ready for production.")
    else:
        print(
            f"{RED}{BOLD}⚠ {total_count - passed_count}/{total_count} tests failed{RESET}"
        )
        print("Fix the failures before deploying.")

    print("=" * 60 + "\n")

    sys.exit(0 if passed_count == total_count else 1)
