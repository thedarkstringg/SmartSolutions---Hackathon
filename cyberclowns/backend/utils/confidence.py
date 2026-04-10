def aggregate_scores(url_score: float, visual_score: float, behavior_score: float) -> float:
    """
    Aggregate three scores with weighted average.

    Args:
        url_score: Score from URL analysis (0.0-1.0)
        visual_score: Score from visual analysis (0.0-1.0)
        behavior_score: Score from behavior analysis (0.0-1.0)

    Returns:
        Weighted confidence score rounded to 2 decimal places
    """
    confidence = (url_score * 0.4) + (visual_score * 0.35) + (behavior_score * 0.25)
    return round(confidence, 2)
