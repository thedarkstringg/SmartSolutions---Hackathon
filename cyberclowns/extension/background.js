// Tilloff - Advanced Phishing Analyzer
// Background Service Worker
// Handles screenshot capture, backend communication, threat intelligence, and UI updates
// @ts-check

// Backend configuration
const BACKEND_URL = "http://195.238.122.179:8000";

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

// === VIRUSTOTAL INTEGRATION (FIXED) ===
async function checkUrlInVirusTotal(targetUrl) {
  // Skip if no API key configured
  if (!VIRUSTOTAL_API_KEY || VIRUSTOTAL_API_KEY.includes('YOUR_VIRUSTOTAL')) {
    return { checked: false, malicious: false, engines: 0 };
  }

  try {
    // 1. Generate URL ID: base64 encode URL without padding
    const urlId = btoa(targetUrl).replace(/=/g, "");

    // 2. Try to get existing report first (faster than posting a new scan)
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      method: 'GET',
      headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
    });

    if (response.status === 404) {
      // If report doesn't exist, submit it for analysis
      console.log(`[VirusTotal] No report found for ${targetUrl} - Submitting for scan...`);
      const postResponse = await fetch(VIRUSTOTAL_URL, {
        method: 'POST',
        headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
        body: new URLSearchParams({ url: targetUrl })
      });
      return { checked: true, malicious: false, engines: 0, pending: true };
    }

    if (!response.ok) {
      console.warn(`[VirusTotal] API error: ${response.status}`);
      return { checked: false, malicious: false, engines: 0 };
    }

    const data = await response.json();
    const stats = data.data?.attributes?.last_analysis_stats || {};
    const maliciousCount = stats.malicious || 0;

    console.log(`[VirusTotal] Results for ${targetUrl}:`, stats);

    return {
      checked: true,
      malicious: maliciousCount > 0,
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log("CyberClowns backend healthy:", data);
      return true;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(
      "CyberClowns backend unreachable. Analysis disabled.",
      error.message
    );
  }
  return false;
}

// === IMPROVED DETECTION: onCommitted (fires earlier, blocks faster) ===
// Now triggers both VirusTotal check AND backend ML analysis
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // frameId 0 = Main tab, avoid sub-resources
  if (details.frameId === 0 && details.url.startsWith('http')) {
    const url = details.url;

    // Whitelist: Never check these domains
    const whitelist = [
      'localhost', '127.0.0.1', '192.168', '10.0',
      'chrome://', 'about:',
      'google.com', 'github.com', 'microsoft.com', 'apple.com',
      'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
      'linkedin.com', 'reddit.com', 'stackoverflow.com', 'amazon.com',
      'cloudflare.com', 'aws.amazon.com'
    ];

    // Check if URL is in whitelist
    if (whitelist.some(domain => url.includes(domain))) {
      console.log(`[✅ WHITELISTED] ${url}`);
      updateBadge(details.tabId, "safe");
      return;
    }

    console.log(`\n[🔍 ANALYSIS START] Analyzing: ${url}`);
    updateBadge(details.tabId, "analyzing");

    try {
      // === PARALLEL THREAT CHECKS ===
      // 1. Fast VirusTotal check for immediate blocking
      console.log(`[VirusTotal] Fast check...`);
      const vtResults = await checkUrlInVirusTotal(url);

      if (vtResults.checked) {
        console.log(`[VirusTotal] Result: ${vtResults.malicious ? `🚨 MALICIOUS (${vtResults.engines} engines)` : '✅ SAFE'}`);
      }

      // Decision: Block immediately if VirusTotal flags it
      if (vtResults.malicious) {
        console.log(`\n🛑 BLOCKING URL - VirusTotal detected threat (${vtResults.engines} engines)`);
        updateBadge(details.tabId, "phishing");

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
        const blockPageUrl = chrome.runtime.getURL("blocked.html") + `?url=${encodeURIComponent(url)}`;
        chrome.tabs.update(details.tabId, { url: blockPageUrl });
        return;
      }

      // 2. OpenCTI threat intelligence check (runs in parallel)
      console.log(`[OpenCTI] Threat intelligence check...`);
      const ctiThreat = await checkUrlInOpenCTI(url);
      if (ctiThreat) {
        console.log(`[OpenCTI] 🚨 Threat detected in CTI`);
        updateBadge(details.tabId, "suspicious");
      }

      // 3. Trigger backend ML analysis for deeper analysis
      console.log(`[Backend] Starting ML analysis...`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ["content.js"],
        });

        // Send message to content script to trigger analysis
        chrome.tabs.sendMessage(details.tabId, {
          type: "ANALYZE_PAGE",
          url: url,
        }).catch(err => console.log("[Backend] Content script not ready yet, will auto-trigger on page ready"));
      } catch (error) {
        console.log("[Backend] Script injection skipped:", error.message);
      }

      // Default to safe if nothing flagged it
      console.log(`\n✅ PASSED all checks - Allowing URL`);
      updateBadge(details.tabId, "safe");

    } catch (error) {
      console.error('[Analysis] Error:', error);
      updateBadge(details.tabId, "error");
    }
  }
});

// === MESSAGE HANDLING (Popup Communication) ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_RESULT") {
    const tabId = request.payload.tabId;
    let result = analysisCache.get(tabId);

    if (!result) {
      // Query the tab to get its actual URL
      chrome.tabs.get(tabId, (tab) => {
        let domain = "Unknown";
        if (tab && tab.url) {
          try {
            const url = new URL(tab.url);
            domain = url.hostname;
          } catch (e) {
            // Invalid URL
          }
        }

        result = {
          verdict: "safe",
          confidence_score: 1.0,
          url_score: 0,
          visual_score: 0,
          behavior_score: 0,
          warnings: [],
          scan_timestamp: new Date().toISOString(),
          site_info: { domain },
        };
        sendResponse(result);
      });
      return;
    }
    sendResponse(result);
  }

  if (request.type === "RESCAN") {
    const tabId = request.payload.tabId;
    console.log(`Re-scan requested for tab ${tabId}`);
    // Clear cache for fresh analysis
    analysisCache.delete(tabId);
  }
});

// === MAIN ANALYSIS FLOW ===
// Backend ML analysis enabled for deep phishing detection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_PAGE") {
    (async () => {
      const tabId = sender.tab.id;
      const payload = request.payload;

      console.log(`Starting ML analysis for tab ${tabId}: ${payload.url}`);

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

        console.log("Sending to backend ML...");
        // Send to backend
        const result = await analyzeWithBackend(fullPayload);

        // Store in cache and storage
        analysisCache.set(tabId, result);
        await chrome.storage.local.set({
          [tabId.toString()]: result,
        });

        // 🔴 CHECK FOR CRITICAL WARNINGS AND BLOCK IF DETECTED
        const warnings = result.warnings || [];
        const suspiciousWarnings = [
          "high external resources",
          "javascript obfuscation",
          "suspicious css"
        ];
        const hasCriticalWarnings = warnings.some(
          (w) => !suspiciousWarnings.some((safe) => w.toLowerCase().includes(safe))
        );

        if (hasCriticalWarnings && warnings.length > 0) {
          console.log(`\n🛑 BLOCKING URL - CRITICAL WARNINGS DETECTED: ${warnings.join(', ')}`);
          updateBadge(tabId, "phishing");

          // Log to Splunk
          if (typeof ExtensionSplunkLogger !== 'undefined') {
            ExtensionSplunkLogger.logPhishingDetection(
              'phishing',
              tabId.toString(),
              result.confidence_score || 0.8,
              warnings,
              result.url_score || 0,
              result.visual_score || 0,
              result.behavior_score || 0
            );
          }

          // Redirect to blocked page with threat details
          const url = payload.url || 'Unknown URL';
          const params = new URLSearchParams({
            url: url,
            warnings: warnings.join('|'),
            confidence: result.confidence_score || 0.8
          });
          const blockPageUrl = chrome.runtime.getURL("blocked.html") + `?${params.toString()}`;
          chrome.tabs.update(tabId, { url: blockPageUrl });
          return;
        }

        // Send overlay message to the tab's content script (only if not blocked)
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

        console.log(`[Backend ML] Analysis complete for tab ${tabId}: verdict=${verdict}`);
      } catch (error) {
        console.error(`[Backend ML] Analysis failed for tab ${tabId}:`, error);
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
  console.log("Tilloff - Advanced Phishing Analyzer installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Tilloff - Advanced Phishing Analyzer started");
});
