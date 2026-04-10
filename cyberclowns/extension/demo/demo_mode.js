// CyberClowns Demo Mode
// Simulates the full detection flow for pitch demos without backend
// Intercepts fetch calls and returns mock responses based on URL

(function () {
  // Demo scenarios mapped to URL patterns
  const DEMO_SCENARIOS = {
    paypal_clone: {
      url_score: 0.91,
      visual_score: 0.88,
      behavior_score: 0.75,
      confidence_score: 0.86,
      verdict: "phishing",
      warnings: [
        "Visual clone of paypal.com detected",
        "Domain does not match PayPal official domain",
        "Hidden form fields collecting credentials",
        "Form submits to external suspicious domain",
        "Obfuscated JavaScript detected",
      ],
      site_info: { domain: "paypa1-secure.com", is_https: false, url_length: 45 },
      scan_timestamp: new Date().toISOString(),
      features: { has_ip_address: false, url_length: 45 },
      url_indicators: ["Visual clone detected", "Suspicious domain mimicry"],
    },

    google_clone: {
      url_score: 0.85,
      visual_score: 0.92,
      behavior_score: 0.6,
      confidence_score: 0.81,
      verdict: "phishing",
      warnings: [
        "Visual clone of google.com detected",
        "Suspicious subdomain structure",
        "Page disables right-click (anti-inspection)",
        "Multiple redirect attempts detected",
      ],
      site_info: { domain: "g00gle-login.com", is_https: false, url_length: 42 },
      scan_timestamp: new Date().toISOString(),
      features: { has_ip_address: false, url_length: 42 },
      url_indicators: ["Lookalike domain", "Right-click disabled"],
    },

    bank_phish: {
      url_score: 0.78,
      visual_score: 0.45,
      behavior_score: 0.9,
      confidence_score: 0.72,
      verdict: "phishing",
      warnings: [
        "IP address used instead of domain name",
        "Urgent language detected on page",
        "External resources ratio extremely high (89%)",
        "Suspicious cookie behavior",
        "JavaScript obfuscation patterns found",
      ],
      site_info: { domain: "192.168.1.1", is_https: false, url_length: 38 },
      scan_timestamp: new Date().toISOString(),
      features: { has_ip_address: true, url_length: 38 },
      url_indicators: ["IP-based URL", "Urgency language", "High external ratio"],
    },

    scam_page: {
      url_score: 0.82,
      visual_score: 0.2,
      behavior_score: 0.7,
      confidence_score: 0.64,
      verdict: "suspicious",
      warnings: [
        "Suspicious keywords in URL (free, prize)",
        "Urgency text detected on page",
        "Multiple redirect chains detected",
        "Unusual external resource loading",
      ],
      site_info: {
        domain: "free-iphone-winner.com",
        is_https: false,
        url_length: 52,
      },
      scan_timestamp: new Date().toISOString(),
      features: { has_ip_address: false, url_length: 52 },
      url_indicators: ["Scam keywords", "Redirect chains"],
    },

    safe: {
      url_score: 0.05,
      visual_score: 0.05,
      behavior_score: 0.08,
      confidence_score: 0.06,
      verdict: "safe",
      warnings: [],
      site_info: { domain: "google.com", is_https: true, url_length: 26 },
      scan_timestamp: new Date().toISOString(),
      features: { has_ip_address: false, url_length: 26 },
      url_indicators: [],
    },
  };

  function getDemoScenario(url) {
    const urlLower = url.toLowerCase();

    if (
      urlLower.includes("paypal") &&
      !urlLower.includes("www.paypal.com") &&
      !urlLower.includes("paypal.com/")
    ) {
      return "paypal_clone";
    }

    if (
      urlLower.includes("google") &&
      !urlLower.includes("www.google.com") &&
      !urlLower.includes("google.com/")
    ) {
      return "google_clone";
    }

    if (
      urlLower.includes("bank") ||
      urlLower.includes("secure-login") ||
      urlLower.includes("192.168")
    ) {
      return "bank_phish";
    }

    if (
      urlLower.includes("free") ||
      urlLower.includes("prize") ||
      urlLower.includes("winner")
    ) {
      return "scam_page";
    }

    return "safe";
  }

  function simulateAnalysisDelay() {
    const delay = Math.random() * 1000 + 1500; // 1500-2500ms
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  async function runDemoAnalysis(url) {
    await simulateAnalysisDelay();

    const scenario = getDemoScenario(url);
    const result = { ...DEMO_SCENARIOS[scenario] };

    // Update site_info with actual URL
    try {
      const parsed = new URL(url);
      result.site_info.domain = parsed.hostname;
    } catch (e) {
      // Keep default
    }

    return result;
  }

  // Intercept fetch calls to backend
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const [resource] = args;
    const url = typeof resource === "string" ? resource : resource.url;

    // Only intercept /analyze calls
    if (url && url.includes("/analyze")) {
      const payload = args[1]?.body;
      if (payload) {
        try {
          const parsed = JSON.parse(payload);
          const analysisUrl = parsed.url;

          return runDemoAnalysis(analysisUrl).then((result) => {
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });
        } catch (e) {
          console.error("Demo mode error:", e);
          return originalFetch.apply(window, args);
        }
      }
    }

    // Also intercept /health calls
    if (url && url.includes("/health")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "ok",
            version: "1.0.0-demo",
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }

    return originalFetch.apply(window, args);
  };

  // Add demo mode watermark badge
  function addDemoWatermark() {
    const container = document.createElement("div");
    container.id = "cyberclowns-demo-watermark";

    const shadow = container.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
      }

      .watermark {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483646;
        background: #ff9800;
        color: white;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        font-family: system-ui, -apple-system;
        opacity: 0.7;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        letter-spacing: 0.5px;
      }

      .watermark:hover {
        opacity: 1;
      }
    `;

    const watermark = document.createElement("div");
    watermark.className = "watermark";
    watermark.textContent = "🎭 DEMO MODE";

    shadow.appendChild(style);
    shadow.appendChild(watermark);

    document.documentElement.appendChild(container);
  }

  // Initialize demo mode
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addDemoWatermark);
  } else {
    addDemoWatermark();
  }

  // Export globally
  window.CyberClownsDemoMode = {
    runDemoAnalysis,
    getDemoScenario,
    isDemoMode: true,
  };

  console.log(
    "🎭 CyberClowns Demo Mode active. Backend calls are simulated."
  );
})();
