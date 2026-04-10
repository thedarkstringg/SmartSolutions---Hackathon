#!/usr/bin/env python3
"""
Quick test script to verify dashboard is fully functional
"""
import json
from pathlib import Path

def test_metrics_file():
    """Test that metrics file exists and has valid data"""
    metrics_file = Path(__file__).parent / "data" / "metrics.jsonl"

    print("=" * 60)
    print("Testing Metrics File")
    print("=" * 60)

    if not metrics_file.exists():
        print("[FAIL] Metrics file not found")
        return False

    print("[OK] Metrics file exists")

    try:
        with open(metrics_file, "r") as f:
            lines = f.readlines()

        if not lines:
            print("[FAIL] Metrics file is empty")
            return False

        print("[OK] Metrics file has {} records".format(len(lines)))

        metrics = []
        for line in lines:
            if line.strip():
                metric = json.loads(line)
                metrics.append(metric)

        verdicts = {}
        for metric in metrics:
            v = metric.get("verdict", "unknown")
            verdicts[v] = verdicts.get(v, 0) + 1

        print("[OK] Distribution: {}".format(verdicts))

        sample = metrics[0]
        required_fields = ["timestamp", "url", "verdict", "confidence_score", "response_time_ms"]
        for field in required_fields:
            if field not in sample:
                print("[FAIL] Missing field: {}".format(field))
                return False

        print("[OK] All required fields present")
        print("\nSample metric:\n  URL: {}\n  Verdict: {}\n  Confidence: {}".format(
            sample['url'], sample['verdict'], sample['confidence_score']))

        return True

    except Exception as e:
        print("[FAIL] Error reading metrics: {}".format(e))
        return False


def test_imports():
    """Test that all backend modules can be imported"""
    print("\n" + "=" * 60)
    print("Testing Backend Imports")
    print("=" * 60)

    try:
        from metrics import MetricsCollector
        print("[OK] MetricsCollector imported")

        from main import app
        print("[OK] FastAPI app imported")

        from splunk_logger import SplunkLogger
        print("[OK] SplunkLogger imported")

        return True
    except Exception as e:
        print("[FAIL] Import error: {}".format(e))
        return False


def test_endpoints():
    """Test that API endpoints are defined"""
    print("\n" + "=" * 60)
    print("Testing API Endpoints")
    print("=" * 60)

    try:
        from main import app

        endpoints = [
            ("/api/metrics", "GET"),
            ("/api/analytics/stats", "GET"),
            ("/api/analytics/timeline", "GET"),
            ("/analyze", "POST"),
            ("/health", "GET"),
            ("/dashboard", "GET"),
        ]

        for path, method in endpoints:
            found = False
            for route in app.routes:
                if hasattr(route, "path") and route.path == path:
                    if hasattr(route, "methods") and method in route.methods:
                        print("[OK] {} {}".format(method, path))
                        found = True

            if not found:
                print("[FAIL] Endpoint not found: {} {}".format(method, path))
                return False

        return True
    except Exception as e:
        print("[FAIL] Endpoint error: {}".format(e))
        return False


def main():
    print("\n")
    print("=" * 60)
    print(" CyberClowns Dashboard Test Suite ".center(60))
    print("=" * 60)

    results = {
        "Metrics File": test_metrics_file(),
        "Imports": test_imports(),
        "Endpoints": test_endpoints(),
    }

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test, result in results.items():
        status = "PASS" if result else "FAIL"
        print("[{}] {}".format(status, test))

    print("\nTotal: {}/{} passed".format(passed, total))

    if passed == total:
        print("\n[SUCCESS] All tests passed! Dashboard is ready to use.")
        print("\nNext steps:")
        print("1. Start backend: cd cyberclowns/backend && python -m uvicorn main:app --reload")
        print("2. Open dashboard: http://localhost:8000/dashboard")
        print("3. Load extension: chrome://extensions > Load unpacked > cyberclowns/extension")
        return 0
    else:
        print("\n[WARNING] Some tests failed. Check output above.")
        return 1


if __name__ == "__main__":
    exit(main())
