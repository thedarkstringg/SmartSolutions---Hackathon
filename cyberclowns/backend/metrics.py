"""
CyberClowns Metrics & Analytics Module
Tracks detection accuracy, response times, and threat statistics
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

METRICS_FILE = Path(__file__).parent / "data" / "metrics.jsonl"


class MetricsCollector:
    """Centralized metrics collection for analytics dashboard"""

    @staticmethod
    def log_scan(
        url: str,
        verdict: str,
        confidence_score: float,
        url_score: float,
        visual_score: float,
        behavior_score: float,
        response_time_ms: float,
        warnings: List[str],
    ) -> None:
        """
        Log a single scan event in JSONL format (one JSON per line).

        Args:
            url: The analyzed URL
            verdict: Final verdict (safe/suspicious/phishing)
            confidence_score: Overall confidence (0.0-1.0)
            url_score: URL analysis score
            visual_score: Visual analysis score
            behavior_score: Behavior analysis score
            response_time_ms: Total response time in ms
            warnings: List of detected warnings
        """
        try:
            # Ensure data directory exists
            METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)

            event = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "url": url,
                "verdict": verdict,
                "confidence_score": round(confidence_score, 2),
                "url_score": round(url_score, 2),
                "visual_score": round(visual_score, 2),
                "behavior_score": round(behavior_score, 2),
                "response_time_ms": round(response_time_ms, 0),
                "warning_count": len(warnings),
                "warnings": warnings[:3],  # Top 3 warnings only
            }

            # Append to JSONL file
            with open(METRICS_FILE, "a") as f:
                f.write(json.dumps(event) + "\n")

            logger.info(f"Metrics logged: {verdict} for {url}")

        except Exception as e:
            logger.error(f"Failed to log metrics: {e}")

    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        """
        Compute statistics from all scans.

        Returns:
            Dict with: total_scans, verdict_counts, avg_confidence, response_time_avg, etc.
        """
        try:
            if not METRICS_FILE.exists():
                return {
                    "total_scans": 0,
                    "verdict_distribution": {"safe": 0, "suspicious": 0, "phishing": 0},
                    "avg_confidence": 0.0,
                    "avg_response_time_ms": 0.0,
                    "top_warnings": [],
                }

            # Read all events
            events = []
            with open(METRICS_FILE, "r") as f:
                for line in f:
                    if line.strip():
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            if not events:
                return {
                    "total_scans": 0,
                    "verdict_distribution": {"safe": 0, "suspicious": 0, "phishing": 0},
                    "avg_confidence": 0.0,
                    "avg_response_time_ms": 0.0,
                    "top_warnings": [],
                }

            # Calculate statistics
            verdict_dist = {"safe": 0, "suspicious": 0, "phishing": 0}
            total_confidence = 0.0
            total_response_time = 0.0
            warning_counts = {}

            for event in events:
                verdict = event.get("verdict", "unknown")
                if verdict in verdict_dist:
                    verdict_dist[verdict] += 1
                total_confidence += event.get("confidence_score", 0.5)
                total_response_time += event.get("response_time_ms", 0)

                # Track warnings
                for warning in event.get("warnings", []):
                    warning_counts[warning] = warning_counts.get(warning, 0) + 1

            # Sort warnings by frequency
            top_warnings = sorted(warning_counts.items(), key=lambda x: x[1], reverse=True)[
                :5
            ]

            return {
                "total_scans": len(events),
                "verdict_distribution": verdict_dist,
                "phishing_detection_rate": round(
                    verdict_dist["phishing"] / len(events) * 100, 1
                )
                if events
                else 0.0,
                "avg_confidence": round(total_confidence / len(events), 2) if events else 0.0,
                "avg_response_time_ms": round(total_response_time / len(events), 0) if events else 0,
                "top_warnings": [{"warning": w, "count": c} for w, c in top_warnings],
                "latest_scans": [e for e in events[-10:]],  # Last 10 scans
            }

        except Exception as e:
            logger.error(f"Failed to compute statistics: {e}")
            return {}

    @staticmethod
    def get_threat_timeline() -> List[Dict[str, Any]]:
        """
        Get timeline of phishing/suspicious detections for dashboard charts.

        Returns:
            List of hourly buckets with detection counts
        """
        try:
            if not METRICS_FILE.exists():
                return []

            events = []
            with open(METRICS_FILE, "r") as f:
                for line in f:
                    if line.strip():
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            # Bucket by hour
            hourly_buckets = {}
            for event in events:
                timestamp = event.get("timestamp", "")
                hour_key = timestamp[:13]  # YYYY-MM-DDTHH

                if hour_key not in hourly_buckets:
                    hourly_buckets[hour_key] = {"safe": 0, "suspicious": 0, "phishing": 0}

                verdict = event.get("verdict", "unknown")
                if verdict in hourly_buckets[hour_key]:
                    hourly_buckets[hour_key][verdict] += 1

            # Convert to sorted list
            timeline = [
                {
                    "time": hour,
                    **stats,
                }
                for hour, stats in sorted(hourly_buckets.items())
            ]

            return timeline

        except Exception as e:
            logger.error(f"Failed to get threat timeline: {e}")
            return []
