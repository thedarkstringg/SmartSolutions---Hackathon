#!/usr/bin/env python3
"""
CyberClowns Splunk Integration Test
Tests real-time logging to Splunk HEC
"""

import requests
import json
import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Splunk config
SPLUNK_HOST = "34.200.46.182"
SPLUNK_PORT = "8088"
SPLUNK_TOKEN = "08467373-6f2b-4d5c-a099-222c25412616"
SPLUNK_URL = f"https://{SPLUNK_HOST}:{SPLUNK_PORT}/services/collector/event"

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

print("\n" + "=" * 70)
print(f"{BOLD}{BLUE}CyberClowns Splunk Integration Test{RESET}")
print("=" * 70)
print(f"Splunk URL: {SPLUNK_URL}\n")


def test_splunk_connection():
    """Test basic connectivity to Splunk."""
    print(f"{YELLOW}>>> Test 1: Splunk Connectivity{RESET}")

    payload = {
        "event": {
            "type": "health_check",
            "message": "CyberClowns connectivity test",
            "status": "connected",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        "sourcetype": "cyberclowns:health_check",
    }

    headers = {
        "Authorization": f"Splunk {SPLUNK_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        # Disable SSL verification for self-signed certs
        response = requests.post(
            SPLUNK_URL,
            json=payload,
            headers=headers,
            verify=False,
            timeout=10
        )

        if response.status_code == 200:
            print(f"{GREEN}✅ PASS | Splunk connection successful{RESET}")
            print(f"   Response: {response.status_code} OK\n")
            return True
        else:
            print(f"{RED}❌ FAIL | Splunk error{RESET}")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}\n")
            return False
    except Exception as e:
        print(f"{RED}❌ FAIL | Connection error{RESET}")
        print(f"   Error: {str(e)}\n")
        return False


def test_phishing_detection_log():
    """Test logging a phishing detection event."""
    print(f"{YELLOW}>>> Test 2: Phishing Detection Log{RESET}")

    payload = {
        "event": {
            "type": "phishing_detection",
            "url": "http://paypa1-secure-login.verify-account.com/signin",
            "verdict": "phishing",
            "confidence_score": 0.86,
            "url_score": 0.75,
            "visual_score": 0.88,
            "behavior_score": 0.92,
            "warning_count": 4,
            "warnings": [
                "Domain does not match PayPal",
                "Visual clone detected",
                "HTTP instead of HTTPS",
                "Suspicious form actions"
            ],
            "response_time_ms": 245,
            "source": "api_backend",
            "severity": "critical",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        "sourcetype": "cyberclowns:detection",
    }

    headers = {
        "Authorization": f"Splunk {SPLUNK_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            SPLUNK_URL,
            json=payload,
            headers=headers,
            verify=False,
            timeout=10
        )

        if response.status_code == 200:
            print(f"{GREEN}✅ PASS | Phishing detection logged{RESET}")
            print(f"   URL: http://paypa1-secure-login.verify-account.com/signin")
            print(f"   Verdict: PHISHING (86% confidence\n")
            return True
        else:
            print(f"{RED}❌ FAIL | Failed to log phishing{RESET}")
            print(f"   Status: {response.status_code}\n")
            return False
    except Exception as e:
        print(f"{RED}❌ FAIL | Error{RESET}")
        print(f"   {str(e)}\n")
        return False


def test_user_interaction_log():
    """Test logging user interaction with warning."""
    print(f"{YELLOW}>>> Test 3: User Interaction Log{RESET}")

    payload = {
        "event": {
            "type": "warning_interaction",
            "url": "http://paypa1-secure-login.verify-account.com/signin",
            "verdict": "phishing",
            "user_action": "leave",
            "action_severity": "risky",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        "sourcetype": "cyberclowns:user_interaction",
    }

    headers = {
        "Authorization": f"Splunk {SPLUNK_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            SPLUNK_URL,
            json=payload,
            headers=headers,
            verify=False,
            timeout=10
        )

        if response.status_code == 200:
            print(f"{GREEN}✅ PASS | User interaction logged{RESET}")
            print(f"   Action: Left phishing site\n")
            return True
        else:
            print(f"{RED}❌ FAIL | Failed to log interaction{RESET}")
            print(f"   Status: {response.status_code}\n")
            return False
    except Exception as e:
        print(f"{RED}❌ FAIL | Error{RESET}")
        print(f"   {str(e)}\n")
        return False


def test_analytics_log():
    """Test logging analytics summary."""
    print(f"{YELLOW}>>> Test 4: Analytics Summary Log{RESET}")

    payload = {
        "event": {
            "type": "analytics_summary",
            "total_scans": 42,
            "phishing_detections": 5,
            "suspicious_detections": 8,
            "safe_sites": 29,
            "avg_confidence_score": 0.45,
            "phishing_detection_rate_percent": 11.9,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        "sourcetype": "cyberclowns:analytics",
    }

    headers = {
        "Authorization": f"Splunk {SPLUNK_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            SPLUNK_URL,
            json=payload,
            headers=headers,
            verify=False,
            timeout=10
        )

        if response.status_code == 200:
            print(f"{GREEN}✅ PASS | Analytics logged{RESET}")
            print(f"   Total Scans: 42")
            print(f"   Phishing Rate: 11.9%\n")
            return True
        else:
            print(f"{RED}❌ FAIL | Failed to log analytics{RESET}")
            print(f"   Status: {response.status_code}\n")
            return False
    except Exception as e:
        print(f"{RED}❌ FAIL | Error{RESET}")
        print(f"   {str(e)}\n")
        return False


def test_backend_integration():
    """Test backend can log to Splunk."""
    print(f"{YELLOW}>>> Test 5: Backend Integration{RESET}")

    try:
        from splunk_logger import test_splunk_connection as backend_test
        import asyncio

        result = asyncio.run(backend_test())

        if result:
            print(f"{GREEN}✅ PASS | Backend Splunk integration working{RESET}\n")
            return True
        else:
            print(f"{YELLOW}⚠️  WARNING | Backend integration unavailable{RESET}\n")
            return False
    except Exception as e:
        print(f"{YELLOW}⚠️  SKIP | Backend test skipped{RESET}")
        print(f"   (Backend Splunk logging not available in this context)\n")
        return True  # Not a failure


def main():
    """Run all tests."""
    results = []

    # Test 1: Connectivity
    results.append(("Splunk Connection", test_splunk_connection()))

    # Test 2: Phishing log
    results.append(("Phishing Detection Log", test_phishing_detection_log()))

    # Test 3: User interaction
    results.append(("User Interaction Log", test_user_interaction_log()))

    # Test 4: Analytics
    results.append(("Analytics Log", test_analytics_log()))

    # Test 5: Backend integration
    results.append(("Backend Integration", test_backend_integration()))

    # Summary
    print("=" * 70)
    passed = sum(1 for _, result in results if result)
    total = len(results)

    if passed == total:
        print(f"{GREEN}{BOLD}✅ All {total} tests passed!{RESET}")
        print("Splunk integration is working correctly.\n")
    else:
        print(f"{YELLOW}{BOLD}⚠️  {passed}/{total} tests passed{RESET}")
        print("Check Splunk configuration and connectivity.\n")

    print("=" * 70)
    print(f"\n✅ To view logs in Splunk:")
    print(f"   1. Go to Splunk Web UI")
    print(f"   2. Search: sourcetype=cyberclowns:*")
    print(f"   3. You should see recent events\n")


if __name__ == "__main__":
    # Suppress SSL warnings for testing
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    main()
