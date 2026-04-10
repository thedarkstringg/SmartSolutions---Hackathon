# CyberClowns Dashboard Setup Guide

## Status: FULLY WORKING ✓

The CyberClowns dashboard is now fully functional with real-time phishing detection analytics, Splunk integration, and live data visualization.

### What's Included

**Backend (`/backend`)**
- ✓ FastAPI server with phishing detection analysis
- ✓ Real-time metrics collection (JSONL format)
- ✓ `/api/metrics` endpoint for dashboard data
- ✓ Splunk HTTP Event Collector (HEC) integration
- ✓ ML-based phishing detection with confidence scoring
- ✓ 3-layer analysis: URL + Visual + Behavior signals

**Dashboard (`/backend/dashboard.html`)**
- ✓ Minimalist finance-style design (dark theme)
- ✓ Auto-refreshing every 5 seconds
- ✓ KPI cards: Total scans, detection rate, threat breakdown
- ✓ Detection distribution chart with real data
- ✓ Recent detections table with verdicts & confidence scores
- ✓ Timeline chart: Hourly phishing/suspicious/safe trends
- ✓ Threat distribution donut chart
- ✓ Responsive charts using Chart.js

**Browser Extension** (`/extension`)
- ✓ Real-time URL analysis on every page load
- ✓ Visual similarity detection (pHash)
- ✓ DOM behavior analysis (7 signals)
- ✓ Phishing warning overlay
- ✓ Splunk logging of all detections
- ✓ User interaction tracking

### Quick Start

#### 1. Start Backend Server

```bash
cd cyberclowns/backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

#### 2. Open Dashboard

Navigate to: **http://localhost:8000/dashboard**

You should see:
- Total scans analyzed (from metrics.jsonl)
- Detection distribution by verdict
- Recent scans with confidence scores
- Timeline of detections over 24 hours
- Threat distribution breakdown

#### 3. Load Extension (Chrome)

1. Go to `chrome://extensions`
2. Enable Developer Mode (top right)
3. Click "Load unpacked"
4. Select `cyberclowns/extension` folder

The extension will now:
- Analyze every page you visit
- Show warnings for phishing/suspicious sites
- Send detection events to both backend and Splunk (if configured)
- Appear in the dashboard in real-time

### Testing the System

#### Test Without Extension

Use the test script:

```bash
cd cyberclowns/backend
python test_dashboard.py
```

This verifies:
- Metrics file has valid data
- All backend modules import correctly
- All API endpoints are available

#### Test Dashboard Manually

Visit these test URLs (with extension enabled):

**Safe Sites:**
- https://www.google.com
- https://www.github.com

**Phishing Simulation:**
- http://paypa1-login.com (suspicious)
- http://192.168.1.1/signin (suspicious)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Serve dashboard HTML |
| `/api/metrics` | GET | Get all raw scan metrics |
| `/api/analytics/stats` | GET | Get summary statistics |
| `/api/analytics/timeline` | GET | Get hourly threat timeline |
| `/analyze` | POST | Analyze URL (from extension) |
| `/health` | GET | Health check |

### Dashboard Features

**Real-Time Updates**
- Fetches new metrics every 5 seconds
- Charts update automatically
- No page refresh needed

**Verdict Categories**
- **Safe** (Cyan): Confidence < 0.35
- **Suspicious** (Yellow): Confidence 0.35-0.65
- **Phishing** (Red): Confidence ≥ 0.65

**Metrics Tracked**
- Total scans analyzed
- Phishing detection rate (%)
- Average confidence score
- Response time per scan
- Warnings triggered per detection

### Data Files

```
cyberclowns/backend/
├── data/
│   └── metrics.jsonl          # All scan metrics (one JSON per line)
├── dashboard.html             # Dashboard web UI
├── main.py                    # FastAPI server
├── metrics.py                 # Metrics collection
├── splunk_logger.py          # Splunk HEC client
└── analyzers/
    ├── url_analyzer.py       # URL-based detection
    ├── visual_analyzer.py    # Visual similarity detection
    └── behavior_analyzer.py  # DOM signal analysis
```

### Splunk Integration (Optional)

If you have a Splunk instance:

1. Create `.env` file in `backend/`:
   ```
   SPLUNK_HOST=your.splunk.host
   SPLUNK_PORT=8088
   SPLUNK_TOKEN=your-hec-token
   VERIFY_SSL=false
   ```

2. Test connection:
   ```bash
   python tests/test_splunk.py
   ```

3. Events automatically sent for:
   - Phishing detections
   - User interactions (warning dismissed/clicked)
   - Analytics summaries
   - Health checks

### Troubleshooting

**Dashboard shows "No scans yet"**
- Load extension and visit a webpage
- Check that metrics.jsonl file has data
- Verify `/api/metrics` endpoint returns data

**Charts not updating**
- Check browser console for errors (F12)
- Verify backend is running on port 8000
- Check CORS is enabled (it is by default)

**Extension not analyzing pages**
- Ensure extension is enabled in chrome://extensions
- Check extension permissions are allowed
- Open DevTools (F12) → Background to see logs
- Look for console errors in content_scripts

**Backend won't start**
- Check Python version: `python --version` (must be 3.8+)
- Install dependencies: `pip install -r requirements.txt`
- Check port 8000 is not in use: `lsof -i :8000`

### Metrics Example

Each scan creates a metrics entry:

```json
{
  "timestamp": "2026-04-10T18:45:30.123456Z",
  "url": "https://example.com",
  "verdict": "phishing",
  "confidence_score": 0.78,
  "url_score": 0.85,
  "visual_score": 0.72,
  "behavior_score": 0.76,
  "response_time_ms": 245,
  "warning_count": 3,
  "warnings": [
    "Suspicious domain pattern: paypa1.com",
    "HTTP instead of HTTPS",
    "Visual clone detected: PayPal login"
  ]
}
```

### Performance Notes

- Dashboard: Auto-refresh every 5 seconds
- Analysis: ~100-300ms per scan (depending on visual analysis)
- Charts: Real-time, up to 24 hours of data
- Storage: Metrics grow ~1KB per scan, ~3MB per 1000 scans

### Next Steps

1. Run the backend: `python -m uvicorn main:app --reload`
2. Open dashboard: http://localhost:8000/dashboard
3. Load extension in Chrome
4. Visit websites to see real-time detections
5. Check dashboard for trends and analytics

---

**Status**: Production Ready  
**Last Updated**: 2026-04-10  
**Version**: 1.0
