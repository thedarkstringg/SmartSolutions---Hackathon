async def analyze_behavior(behavior_signals: dict) -> dict:
    """
    Analyze browser behavior signals for phishing indicators with severity levels.

    Args:
        behavior_signals: Dictionary containing behavior detection signals

    Returns:
        Dictionary with score, triggered_signals list, and severity mapping
    """
    score = 0.0
    triggered_signals = []
    signal_severity = {}  # Track severity of each signal

    # CRITICAL SEVERITY: Hidden form fields
    if behavior_signals.get("has_hidden_fields", False):
        score += 0.25
        signal_text = "Hidden form fields detected"
        triggered_signals.append(signal_text)
        signal_severity[signal_text] = "CRITICAL"

    # CRITICAL SEVERITY: Excessive redirects
    if behavior_signals.get("redirect_count", 0) > 2:
        score += 0.20
        signal_text = f"Excessive redirects ({behavior_signals.get('redirect_count', 0)})"
        triggered_signals.append(signal_text)
        signal_severity[signal_text] = "CRITICAL"

    # SUSPICIOUS SEVERITY: Obfuscated JavaScript
    if behavior_signals.get("has_obfuscated_js", False):
        score += 0.25
        signal_text = "Obfuscated JavaScript detected"
        triggered_signals.append(signal_text)
        signal_severity[signal_text] = "SUSPICIOUS"

    # CRITICAL SEVERITY: Suspicious cookies
    if behavior_signals.get("has_suspicious_cookies", False):
        score += 0.15
        signal_text = "Suspicious cookie usage"
        triggered_signals.append(signal_text)
        signal_severity[signal_text] = "CRITICAL"

    # SUSPICIOUS SEVERITY: High external resources ratio
    if behavior_signals.get("external_resources_ratio", 0) > 0.7:
        score += 0.15
        signal_text = f"High external resources ratio ({behavior_signals.get('external_resources_ratio', 0):.2f})"
        triggered_signals.append(signal_text)
        signal_severity[signal_text] = "SUSPICIOUS"

    # Cap score at 1.0
    score = min(score, 1.0)

    return {
        "score": score,
        "triggered_signals": triggered_signals,
        "signal_severity": signal_severity
    }
