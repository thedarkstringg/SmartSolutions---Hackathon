"""
CyberClowns Splunk Integration
Sends all phishing detection events and analytics to Splunk HEC (HTTP Event Collector)
"""

import json
import logging
import aiohttp
import os
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Splunk Configuration
SPLUNK_HOST = os.getenv("SPLUNK_HOST", "34.200.46.182")
SPLUNK_PORT = os.getenv("SPLUNK_PORT", "8088")
SPLUNK_TOKEN = os.getenv("SPLUNK_TOKEN", "08467373-6f2b-4d5c-a099-222c25412616")
SPLUNK_URL = f"https://{SPLUNK_HOST}:{SPLUNK_PORT}/services/collector/event"

# Disable SSL verification for self-signed certs (development only!)
VERIFY_SSL = os.getenv("VERIFY_SSL", "false").lower() == "true"


class SplunkLogger:
    """Async Splunk HEC logger for real-time events"""

    @staticmethod
    async def send_event(
        event_type: str,
        data: Dict[str, Any],
        sourcetype: str = "cyberclowns:detection"
    ) -> bool:
        """
        Send an event to Splunk HEC.

        Args:
            event_type: Type of event (detection, warning, analysis, etc.)
            data: Event data to send
            sourcetype: Splunk sourcetype

        Returns:
            True if successful, False otherwise
        """
        try:
            payload = {
                "event": {
                    "type": event_type,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    **data,
                },
                "sourcetype": sourcetype,
            }

            headers = {
                "Authorization": f"Splunk {SPLUNK_TOKEN}",
                "Content-Type": "application/json",
            }

            # Use aiohttp for async requests
            timeout = aiohttp.ClientTimeout(total=10)
            connector = aiohttp.TCPConnector(ssl=VERIFY_SSL)

            async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                async with session.post(
                    SPLUNK_URL,
                    json=payload,
                    headers=headers,
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Splunk event sent: {event_type}")
                        return True
                    else:
                        text = await response.text()
                        logger.warning(
                            f"Splunk error ({response.status}): {text}"
                        )
                        return False

        except Exception as e:
            logger.error(f"Failed to send Splunk event: {e}")
            return False

    @staticmethod
    async def log_phishing_detection(
        url: str,
        verdict: str,
        confidence: float,
        url_score: float,
        visual_score: float,
        behavior_score: float,
        warnings: list,
        response_time_ms: float,
        source: str = "browser_extension"
    ) -> bool:
        """
        Log a phishing detection event to Splunk.

        Args:
            url: Analyzed URL
            verdict: Detection verdict (safe/suspicious/phishing)
            confidence: Confidence score (0.0-1.0)
            All score components and warnings
            source: Source of the detection (browser_extension/api/ml_model)

        Returns:
            True if sent successfully
        """
        return await SplunkLogger.send_event(
            event_type="phishing_detection",
            data={
                "url": url,
                "verdict": verdict,
                "confidence_score": round(confidence, 2),
                "url_score": round(url_score, 2),
                "visual_score": round(visual_score, 2),
                "behavior_score": round(behavior_score, 2),
                "warning_count": len(warnings),
                "warnings": warnings[:5],  # Top 5 warnings
                "response_time_ms": round(response_time_ms, 0),
                "source": source,
                "severity": "critical" if verdict == "phishing" else "warning" if verdict == "suspicious" else "info",
            },
            sourcetype="cyberclowns:detection",
        )

    @staticmethod
    async def log_warning_dismissed(
        url: str,
        verdict: str,
        user_action: str  # "proceed", "leave", "dismiss"
    ) -> bool:
        """
        Log when user interacts with warning overlay.

        Args:
            url: The URL being warned about
            verdict: Original verdict
            user_action: What the user did

        Returns:
            True if sent successfully
        """
        return await SplunkLogger.send_event(
            event_type="warning_interaction",
            data={
                "url": url,
                "verdict": verdict,
                "user_action": user_action,
                "action_severity": "risky" if user_action == "proceed" else "safe",
            },
            sourcetype="cyberclowns:user_interaction",
        )

    @staticmethod
    async def log_analytics_update(
        total_scans: int,
        phishing_count: int,
        suspicious_count: int,
        safe_count: int,
        avg_confidence: float,
        phishing_rate: float
    ) -> bool:
        """
        Log analytics summary to Splunk.

        Args:
            Analytics data from dashboard

        Returns:
            True if sent successfully
        """
        return await SplunkLogger.send_event(
            event_type="analytics_summary",
            data={
                "total_scans": total_scans,
                "phishing_detections": phishing_count,
                "suspicious_detections": suspicious_count,
                "safe_sites": safe_count,
                "avg_confidence_score": round(avg_confidence, 2),
                "phishing_detection_rate_percent": round(phishing_rate, 1),
            },
            sourcetype="cyberclowns:analytics",
        )

    @staticmethod
    async def log_extension_event(
        event_name: str,
        url: str,
        details: Dict[str, Any]
    ) -> bool:
        """
        Log extension-specific events (loaded, error, etc.).

        Args:
            event_name: Name of the event (loaded, error, tab_analyzed, etc.)
            url: URL context
            details: Additional details

        Returns:
            True if sent successfully
        """
        return await SplunkLogger.send_event(
            event_type=f"extension_{event_name}",
            data={
                "url": url,
                **details,
            },
            sourcetype="cyberclowns:extension_event",
        )


async def test_splunk_connection() -> bool:
    """Test connectivity to Splunk HEC."""
    logger.info("🧪 Testing Splunk connection...")
    result = await SplunkLogger.send_event(
        event_type="health_check",
        data={
            "message": "CyberClowns Splunk integration test",
            "status": "connected",
        },
        sourcetype="cyberclowns:health_check",
    )
    if result:
        logger.info("✅ Splunk connection successful!")
    else:
        logger.warning("⚠️  Splunk connection failed - logs will not be sent")
    return result
