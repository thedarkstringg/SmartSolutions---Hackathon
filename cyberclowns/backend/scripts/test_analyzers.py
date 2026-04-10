"""
Test script for CyberClowns analyzers.
Tests url_analyzer and behavior_analyzer without requiring screenshots.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from analyzers.url_analyzer import analyze_url
from analyzers.behavior_analyzer import analyze_behavior


async def test_url_analyzer():
    """Test URL analyzer with 3 test cases."""
    print("\n" + "="*70)
    print("🔍 URL ANALYZER TESTS")
    print("="*70)

    test_urls = [
        "https://google.com",
        "http://paypa1.com/signin/secure/login/verify",
        "http://192.168.1.1/bank/login"
    ]

    for idx, url in enumerate(test_urls, 1):
        print(f"\n[Test {idx}] Analyzing: {url}")
        print("-" * 70)

        result = await analyze_url(url)

        print(f"  Score:           {result['score']:.2f}")
        print(f"  Rule Score:      {result['rule_score']:.2f}")
        print(f"  Gemini Called:   {result['gemini_called']}")
        if result.get('gemini_score'):
            print(f"  Gemini Score:    {result['gemini_score']:.2f}")

        print(f"\n  Features:")
        features = result.get('features', {})
        print(f"    - Has IP Address:        {features.get('has_ip_address', False)}")
        print(f"    - URL Length:            {features.get('url_length', 0)} chars")
        print(f"    - Subdomains:            {features.get('num_subdomains', 0)}")
        print(f"    - HTTPS:                 {features.get('is_https', False)}")
        print(f"    - Domain Length:         {features.get('domain_length', 0)}")
        print(f"    - @ Symbol:              {features.get('has_at_symbol', False)}")
        print(f"    - Double Slash Redirect: {features.get('has_double_slash_redirect', False)}")
        print(f"    - Special Chars:         {features.get('num_special_chars', 0)}")

        keywords = features.get('suspicious_keywords', [])
        if keywords:
            print(f"\n  🚨 Suspicious Keywords: {', '.join(keywords)}")

        indicators = result.get('indicators', [])
        if indicators:
            print(f"\n  Indicators:")
            for indicator in indicators:
                print(f"    • {indicator}")


def test_behavior_analyzer():
    """Test behavior analyzer with mock signals."""
    print("\n" + "="*70)
    print("⚙️ BEHAVIOR ANALYZER TESTS")
    print("="*70)

    # Create test case with all suspicious signals
    test_signals = {
        "has_hidden_fields": True,
        "redirect_count": 5,
        "has_obfuscated_js": True,
        "suspicious_cookies": True,
        "external_resources_ratio": 0.9
    }

    print("\nTest: All Suspicious Signals")
    print("-" * 70)
    print(f"  Input signals:")
    print(f"    - has_hidden_fields:       {test_signals['has_hidden_fields']}")
    print(f"    - redirect_count:          {test_signals['redirect_count']}")
    print(f"    - has_obfuscated_js:       {test_signals['has_obfuscated_js']}")
    print(f"    - suspicious_cookies:      {test_signals['suspicious_cookies']}")
    print(f"    - external_resources_ratio: {test_signals['external_resources_ratio']}")

    # Run analysis
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(analyze_behavior(test_signals))

    print(f"\n  Result:")
    print(f"    Score: {result['score']:.2f}")

    signals = result.get('triggered_signals', [])
    if signals:
        print(f"\n  🚨 Triggered Signals:")
        for signal in signals:
            print(f"    • {signal}")
    else:
        print(f"\n  ✓ No suspicious signals triggered")


async def main():
    """Run all tests."""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*15 + "🤡 CyberClowns Analyzer Tests" + " "*23 + "║")
    print("╚" + "="*68 + "╝")

    # Test URL analyzer
    await test_url_analyzer()

    # Test Behavior analyzer
    test_behavior_analyzer()

    print("\n" + "="*70)
    print("✅ All tests completed!")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
