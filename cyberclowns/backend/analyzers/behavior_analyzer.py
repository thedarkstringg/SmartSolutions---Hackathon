async def analyze_behavior(behavior_signals: dict) -> dict:
    """
    Analyze browser behavior signals for phishing indicators.

    Args:
        behavior_signals: Dictionary containing:
            - has_hidden_fields (bool)
            - redirect_count (int)
            - has_obfuscated_js (bool)
            - suspicious_cookies (bool)
            - external_resources_ratio (float 0-1)

    Returns:
        Dictionary with score and triggered_signals list
    """
    score = 0.0
    triggered_signals = []

    # Check hidden form fields
    if behavior_signals.get("has_hidden_fields", False):
        score += 0.25
        triggered_signals.append("Hidden form fields detected")

    # Check redirect count
    if behavior_signals.get("redirect_count", 0) > 2:
        score += 0.20
        triggered_signals.append(f"Excessive redirects ({behavior_signals.get('redirect_count', 0)})")

    # Check obfuscated JavaScript
    if behavior_signals.get("has_obfuscated_js", False):
        score += 0.25
        triggered_signals.append("Obfuscated JavaScript detected")

    # Check suspicious cookies
    if behavior_signals.get("suspicious_cookies", False):
        score += 0.15
        triggered_signals.append("Suspicious cookie usage")

    # Check external resources ratio
    if behavior_signals.get("external_resources_ratio", 0) > 0.7:
        score += 0.15
        triggered_signals.append(f"High external resources ratio ({behavior_signals.get('external_resources_ratio', 0):.2f})")

    # Cap score at 1.0
    score = min(score, 1.0)

    return {
        "score": score,
        "triggered_signals": triggered_signals
    }
