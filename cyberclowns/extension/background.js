// CyberClowns Background Service Worker
// Handles screenshot capture, backend communication, OpenCTI threat intelligence, and UI updates
// @ts-check

// Backend configuration
const BACKEND_URL = "http://localhost:8000";

// OpenCTI configuration (Threat Intelligence Integration)
const OPENCTI_URL = "http://20.244.15.36:8080/graphql";
const OPENCTI_TOKEN = "19616aa7-62ab-49f8-9e68-2b9b2c9b515c";

// VirusTotal configuration (Commercial threat database)
const VIRUSTOTAL_API_KEY = "5c926a263e1b886135b15fdc0c7e3a3aebe43d5091ba22c96168f5f2ea2d0822"; // Replace with your key
const VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3/urls";

// === STATE MANAGEMENT ===
const analysisCache = new Map(); // tabId → result
const pendingAnalysis = new Map(); // tabId → boolean

// Badge colors
const BADGE_COLORS = {
  safe: "#00C853",
  suspicious: "#FFD600",
  phishing: "#D50000",
  analyzing: "#888888",
  error: "#888888",
};

// === OPENCTI INTEGRATION ===
async function checkUrlInOpenCTI(targetUrl) {
  // Whitelist safe domains to reduce false positives
  const safeDomains = [
    'localhost', '127.0.0.1', 'chrome://', 'about:',
    'google.com', 'github.com', 'microsoft.com', 'apple.com',
    'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com'
  ];

  try {
    // Don't check internal/safe domains
    if (safeDomains.some(domain => targetUrl.includes(domain))) {
      return false;
    }
  } catch (e) {
    // Ignore
  }

  // Query for indicators with malware/phishing labels specifically
  const query = `
    query($search: String) {
      indicators(search: $search, first: 5) {
        edges {
          node {
            id
            pattern
            pattern_type
            labels
            description
            x_opencti_detection {
              count
            }
          }
        }
      }
    }`;

  try {
    const response = await fetch(OPENCTI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCTI_TOKEN}`
      },
      body: JSON.stringify({
        query: query,
        variables: { search: targetUrl }
      })
    });

    const data = await response.json();

    console.log(`[OpenCTI] Query for ${targetUrl}:`, data);

    // Check if we got error response
    if (data.errors) {
      console.warn(`[OpenCTI] Query error:`, data.errors);
      return false;
    }

    // Check for actual malicious indicators
    if (data && data.data && data.data.indicators &&
        data.data.indicators.edges &&
        data.data.indicators.edges.length > 0) {

      // Look for indicators labeled as malware, phishing, or malicious
      for (const edge of data.data.indicators.edges) {
        const indicator = edge.node;
        const labels = indicator.labels || [];
        const description = (indicator.description || '').toLowerCase();

        // Check for malicious labels
        const isMalicious = labels.some(label =>
          label.toLowerCase().includes('malware') ||
          label.toLowerCase().includes('phishing') ||
          label.toLowerCase().includes('c2') ||
          label.toLowerCase().includes('botnet')
        ) || description.includes('phishing') ||
           description.includes('malware') ||
           description.includes('malicious');

        if (isMalicious) {
          console.log(`[OpenCTI] Malicious indicator found:`, indicator);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("[OpenCTI] Connection error:", error);
    return false; // Don't block on error
  }
}

// === VIRUSTOTAL INTEGRATION ===
async function checkUrlInVirusTotal(targetUrl) {
  // Skip if no API key configured
  if (!VIRUSTOTAL_API_KEY || VIRUSTOTAL_API_KEY.includes('YOUR_VIRUSTOTAL')) {
    return { checked: false, malicious: false, engines: 0 };
  }

  try {
    // Encode URL for VirusTotal API
    const urlEncoded = new URLSearchParams();
    urlEncoded.append('url', targetUrl);

    const response = await fetch(VIRUSTOTAL_URL, {
      method: 'POST',
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY
      },
      body: urlEncoded
    });

    if (!response.ok) {
      console.warn(`[VirusTotal] API error: ${response.status}`);
      return { checked: false, malicious: false, engines: 0 };
    }

    const data = await response.json();
    const analysisId = data.data?.id;

    if (!analysisId) {
      console.warn('[VirusTotal] No analysis ID returned');
      return { checked: false, malicious: false, engines: 0 };
    }

    // Get analysis results
    const analysisUrl = `https://www.virustotal.com/api/v3/analyses/${analysisId}`;
    const analysisResponse = await fetch(analysisUrl, {
      headers: {
        'x-apikey': VIRUSTOTAL_API_KEY
      }
    });

    if (!analysisResponse.ok) {
      return { checked: false, malicious: false, engines: 0 };
    }

    const analysisData = await analysisResponse.json();
    const stats = analysisData.data?.attributes?.stats || {};

    console.log(`[VirusTotal] Results for ${targetUrl}:`, stats);

    // Check if URL is flagged as malicious
    const maliciousCount = stats.malicious || 0;
    const isMalicious = maliciousCount > 0;

    return {
      checked: true,
      malicious: isMalicious,
      engines: maliciousCount,
      stats: stats
    };
  } catch (error) {
    console.error("[VirusTotal] Connection error:", error);
    return { checked: false, malicious: false, engines: 0 };
  }
}

// === SCREENSHOT CAPTURE ===
async function captureScreenshot(tabId) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.captureVisibleTab(null, { format: "png", quality: 90 }, (screenshot) => {
        if (chrome.runtime.lastError) {
          console.error("Screenshot capture failed:", chrome.runtime.lastError);
          resolve(null);
        } else {
          try {
            // Strip the "data:image/png;base64," prefix
            const base64 = screenshot.replace(/^data:image\/png;base64,/, "");
            console.log(`Screenshot captured for tab ${tabId}: ${base64.length} bytes`);
            resolve(base64);
          } catch (e) {
            console.error("Screenshot processing error:", e);
            resolve(null);
          }
        }
      });
    } catch (e) {
      console.error("Screenshot capture exception:", e);
      resolve(null);
    }
  });
}

// === BACKEND COMMUNICATION ===
async function analyzeWithBackend(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    console.log("Sending analysis request to backend...");
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        error: `Backend error: ${response.status}`,
        verdict: "unknown",
      };
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return {
        error: "Analysis timed out (30s)",
        verdict: "unknown",
      };
    }

    return {
      error: `Backend unreachable: ${error.message}`,
      verdict: "unknown",
    };
  }
}

// === BADGE UPDATES ===
function updateBadge(tabId, verdict) {
  const text = {
    safe: "✓",
    suspicious: "!",
    phishing: "✗",
    unknown: "?",
    pending: "...",
  }[verdict] || "?";

  const color = BADGE_COLORS[verdict] || BADGE_COLORS.error;

  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// === HEALTH CHECK ===
async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      timeout: 5000,
    });

    if (response.ok) {
      const data = await response.json();
      console.log("CyberClowns backend healthy:", data);
      return true;
    }
  } catch (error) {
    console.warn(
      "CyberClowns backend unreachable. Analysis disabled.",
      error.message
    );
  }
  return false;
}

// === DUAL DETECTION: VirusTotal + Backend ML ===
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId === 0 && details.url.startsWith('http')) {
    const url = details.url;
    console.log(`\n[🔍 DUAL DETECTION] Analyzing: ${url}`);

    let detectionResults = {
      url: url,
      timestamp: new Date().toISOString(),
      virustotal: { checked: false, malicious: false, engines: 0 },
      blocked: false
    };

    try {
      // 1️⃣ Check VirusTotal
      console.log('[1/2] Checking VirusTotal...');
      const vtResults = await checkUrlInVirusTotal(url);
      detectionResults.virustotal = vtResults;
      if (vtResults.checked) {
        console.log(`[VirusTotal] Result: ${vtResults.malicious ? `🚨 MALICIOUS (${vtResults.engines} engines)` : '✅ SAFE'}`);
      } else {
        console.log('[VirusTotal] Not checked (API not configured or unavailable)');
      }

      // 2️⃣ Decision: Block if VirusTotal flags it
      const shouldBlock = vtResults.checked && vtResults.malicious;

      if (shouldBlock) {
        console.log(`\n🛑 BLOCKING URL - VirusTotal detected threat (${vtResults.engines} engines)`);
        detectionResults.blocked = true;

        // Log to Splunk if available
        if (typeof ExtensionSplunkLogger !== 'undefined') {
          ExtensionSplunkLogger.logPhishingDetection(
            'phishing',
            details.tabId.toString(),
            1.0, // High confidence
            [`Blocked by VirusTotal: ${vtResults.engines} malicious engines detected`],
            0, 0, 0
          );
        }

        // Redirect to blocked page
        const blockPageUrl = chrome.runtime.getURL("blocked.html");
        chrome.tabs.update(details.tabId, { url: blockPageUrl });
      } else {
        console.log(`\n✅ PASSED VirusTotal check - Allowing URL`);
        console.log(`[Note] Backend ML analysis will run on page load for additional protection`);
      }

    } catch (error) {
      console.error('[Dual Detection] Error:', error);
    }
  }
});

// === MAIN ANALYSIS FLOW ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_PAGE") {
    (async () => {
      const tabId = sender.tab.id;
      const payload = request.payload;

      console.log(`Starting analysis for tab ${tabId}: ${payload.url}`);

      // Avoid duplicate analysis
      if (pendingAnalysis.get(tabId)) {
        console.log(`Analysis already pending for tab ${tabId}`);
        return;
      }

      pendingAnalysis.set(tabId, true);
      updateBadge(tabId, "analyzing");

      try {
        // Capture screenshot
        console.log(`Capturing screenshot for tab ${tabId}...`);
        const screenshot_base64 = await captureScreenshot(tabId);

        // Build full payload
        const fullPayload = {
          url: payload.url,
          screenshot_base64: screenshot_base64 || "",
          dom_snapshot: payload.dom_snapshot || "",
          behavior_signals: payload.behavior_signals || {},
        };

        console.log("Sending to backend...");
        // Send to backend
        const result = await analyzeWithBackend(fullPayload);

        // Store in cache and storage
        analysisCache.set(tabId, result);
        await chrome.storage.local.set({
          [tabId.toString()]: result,
        });

        // Send overlay message to the tab's content script
        try {
          chrome.tabs.sendMessage(tabId, {
            type: "SHOW_OVERLAY",
            payload: result,
          });
        } catch (e) {
          // Content script may not be ready, ignore
        }

        // Update badge based on verdict
        const verdict = result.verdict || "unknown";
        updateBadge(tabId, verdict);

        // 🆕 AUTO-BLOCK if high phishing confidence from backend
        if (result.verdict === "phishing" && result.confidence_score >= 0.65) {
          console.log(`[Backend Analysis] HIGH PHISHING DETECTED: ${payload.url} (confidence: ${result.confidence_score})`);
          try {
            const blockPageUrl = chrome.runtime.getURL("blocked.html");
            chrome.tabs.update(tabId, { url: blockPageUrl });
          } catch (e) {
            console.warn("[Backend Analysis] Could not auto-block tab:", e);
          }
        }

        // 🆕 Log to Splunk
        if (typeof ExtensionSplunkLogger !== 'undefined') {
          ExtensionSplunkLogger.logPhishingDetection(
            verdict,
            tabId.toString(),
            result.confidence_score || 0,
            result.warnings || [],
            result.url_score || 0,
            result.visual_score || 0,
            result.behavior_score || 0
          );
        }

        console.log(`Analysis complete for tab ${tabId}: verdict=${verdict}`);
      } catch (error) {
        console.error(`Analysis failed for tab ${tabId}:`, error);
        const errorResult = {
          error: error.message,
          verdict: "unknown",
        };
        analysisCache.set(tabId, errorResult);
        await chrome.storage.local.set({
          [tabId.toString()]: errorResult,
        });
        updateBadge(tabId, "error");
      } finally {
        pendingAnalysis.set(tabId, false);
      }
    })();
  }

  if (request.type === "GET_RESULT") {
    const tabId = request.payload.tabId;
    const result = analysisCache.get(tabId);

    if (result) {
      sendResponse(result);
    } else {
      sendResponse({
        verdict: "pending",
        message: "Page analysis in progress...",
      });
    }
  }

  if (request.type === "RESCAN") {
    const tabId = request.payload.tabId;
    const url = request.payload.url;

    (async () => {
      console.log(`Re-scanning tab ${tabId}...`);
      // Clear cache
      analysisCache.delete(tabId);
      await chrome.storage.local.remove(tabId.toString());

      // Re-inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });
      } catch (error) {
        console.error("Failed to re-inject content script:", error);
      }
    })();
  }
});

// === TAB EVENTS: Clear cache on navigation ===
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    console.log(`Tab ${tabId} navigation complete: ${tab.url}`);
    // Clear previous result for fresh analysis
    analysisCache.delete(tabId);
    chrome.storage.local.remove(tabId.toString());
    updateBadge(tabId, "pending");
  }
});

// === TAB EVENTS: Clean up on removal ===
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`Cleaning up tab ${tabId}`);
  analysisCache.delete(tabId);
  pendingAnalysis.delete(tabId);
  chrome.storage.local.remove(tabId.toString());
});

// === EXTENSION STARTUP ===
chrome.runtime.onInstalled.addListener(() => {
  checkBackendHealth();
  console.log("CyberClowns extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  checkBackendHealth();
  console.log("CyberClowns extension started");
});


// === EXTENSION STARTUP ===
chrome.runtime.onInstalled.addListener(() => {
  checkBackendHealth();
  console.log("CyberClowns extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  checkBackendHealth();
  console.log("CyberClowns extension started");
});
