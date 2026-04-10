# 🚨 CyberClowns Splunk Real-Time Logging

## Overview

CyberClowns now sends **all phishing detection events** in real-time to your Splunk instance for monitoring, analytics, and alerting.

## Architecture

```
┌─────────────────┐
│  Browser        │
│  Extension      │──┐
└─────────────────┘  │
                     │  Splunk HEC
┌─────────────────┐  │  (HTTP Event Collector)
│  Backend        │──┼──────────────────────────► Splunk
│  (FastAPI)      │  │
└─────────────────┘  │
                     │
  Metrics jsonl ────┘
```

## Events Sent to Splunk

### 1. **Phishing Detection** (sourcetype: `cyberclowns:detection`)
```json
{
  "type": "phishing_detection",
  "url": "http://paypa1-secure.com/login",
  "verdict": "phishing",
  "confidence_score": 0.86,
  "url_score": 0.75,
  "visual_score": 0.88,
  "behavior_score": 0.92,
  "warning_count": 4,
  "warnings": ["Visual clone detected", "HTTP instead of HTTPS"],
  "response_time_ms": 245,
  "source": "api_backend",
  "severity": "critical"
}
```

### 2. **User Interaction** (sourcetype: `cyberclowns:user_interaction`)
```json
{
  "type": "warning_interaction",
  "url": "http://paypa1-secure.com",
  "verdict": "phishing",
  "user_action": "leave",  // or "dismiss", "proceed"
  "action_severity": "risky"
}
```

### 3. **Analytics Summary** (sourcetype: `cyberclowns:analytics`)
```json
{
  "type": "analytics_summary",
  "total_scans": 42,
  "phishing_detections": 5,
  "suspicious_detections": 8,
  "safe_sites": 29,
  "avg_confidence_score": 0.45,
  "phishing_detection_rate_percent": 11.9
}
```

### 4. **Extension Events** (sourcetype: `cyberclowns:extension_event`)
```json
{
  "type": "extension_loaded",
  "version": "1.0.0",
  "message": "CyberClowns extension initialized"
}
```

### 5. **Health Checks** (sourcetype: `cyberclowns:health_check`)
```json
{
  "type": "health_check",
  "message": "Server is running",
  "status": "connected"
}
```

## Setup

### 1. Configure Backend

Update `backend/.env`:

```bash
SPLUNK_HOST=34.200.46.182
SPLUNK_PORT=8088
SPLUNK_TOKEN=08467373-6f2b-4d5c-a099-222c25412616
VERIFY_SSL=false
```

### 2. Start Backend

```bash
cd cyberclowns/backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will:
- ✅ Test Splunk connectivity on startup
- ✅ Send all detection events automatically
- ✅ Log to both local `metrics.jsonl` AND Splunk

### 3. Load Extension

```bash
chrome://extensions → Load unpacked → cyberclowns/extension
```

The extension will:
- ✅ Send detection events to Splunk
- ✅ Log user interactions (warnings dismissed, clicked, etc.)
- ✅ Report backend status

## Testing

### Test Splunk Integration

```bash
cd cyberclowns/backend
python tests/test_splunk.py
```

Expected output:
```
============================================================
CyberClowns Splunk Integration Test
============================================================
✅ PASS | Splunk connection successful
✅ PASS | Phishing detection logged
✅ PASS | User interaction logged
✅ PASS | Analytics logged
✅ PASS | Backend integration working

✅ All 5 tests passed!
```

### Verify in Splunk

1. Go to your Splunk Web UI
2. Search: `sourcetype=cyberclowns:*`
3. You should see recent events

## Splunk Queries

### All Phishing Detections
```spl
sourcetype="cyberclowns:detection" verdict="phishing"
| stats count by url, confidence_score
```

### Detection Rate Over Time
```spl
sourcetype="cyberclowns:detection"
| timechart count by verdict
```

### User Actions
```spl
sourcetype="cyberclowns:user_interaction"
| stats count by user_action
```

### risky Actions (Proceeded despite warning)
```spl
sourcetype="cyberclowns:user_interaction" action_severity="risky"
| table url, verdict, user_action
```

### Average Confidence Over Time
```spl
sourcetype="cyberclowns:detection"
| timechart avg(confidence_score) by verdict
```

### Top Dangerous URLs
```spl
sourcetype="cyberclowns:detection" verdict="phishing"
| stats count, avg(confidence_score) by url
| sort count desc
```

## Alerts in Splunk

### Alert: Phishing Detected
Create a new alert:
1. Search: `sourcetype="cyberclowns:detection" verdict="phishing"`
2. Schedule: Real-time or custom interval
3. Action: Email, webhook, etc.

### Alert: Risky User Action
```spl
sourcetype="cyberclowns:user_interaction" user_action="proceed"
```

## Data Flow

### Backend → Splunk
```
1. User visits URL
2. Extension analyzes page
3. Backend receives analysis request
4. Backend sends to Splunk (async, non-blocking)
5. Backend returns response
6. Response appears in Splunk within 1-5 seconds
```

### Extension → Splunk
```
1. Warning shown to user
2. Extension logs to Splunk (async)
3. User interacts with warning
4. Extension logs action to Splunk
5. Events appear in Splunk immediately
```

## Troubleshooting

### Logs not appearing in Splunk

1. **Check backend startup logs:**
   ```bash
   # Look for: "✅ Splunk connection successful"
   ```

2. **Test connectivity:**
   ```bash
   python tests/test_splunk.py
   ```

3. **Verify Splunk credentials:**
   - Check `SPLUNK_TOKEN` is correct
   - Check `SPLUNK_HOST` and `SPLUNK_PORT`
   - Verify HEC is enabled in Splunk

4. **Check SSL certs:**
   - If using self-signed certs, set `VERIFY_SSL=false`

5. **View Splunk errors:**
   ```spl
   index=_internal group=thruput
   | search source::Splunk*MonitorNoFd
   ```

## Performance

- **Backend logging**: Async (non-blocking) - < 1ms overhead
- **Extension logging**: Async - < 5ms overhead
- **Network**: Splunk HEC can handle 1000+ events/second
- **Retention**: Configure in Splunk (default 30 days)

## Security Notes

⚠️ **Important:**
- ✅ Use HTTPS for Splunk connections
- ✅ Rotate tokens regularly
- ✅ Restrict HEC inputs by IP in Splunk
- ✅ Never commit credentials to git (use .env)

## Next Steps

1. ✅ Run `test_splunk.py` to verify connectivity
2. ✅ Visit suspicious URLs to generate events
3. ✅ Check Splunk dashboard for logs
4. ✅ Create alerts for critical detections
5. ✅ Monitor phishing trends over time

---

**You now have:**
- ✅ Real-time phishing detection logging
- ✅ User interaction tracking
- ✅ Analytics and trend analysis
- ✅ Unified visibility across extension + backend

Good luck monitoring! 🚀
