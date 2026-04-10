// CyberClowns Extension Splunk Integration
// Sends real-time events to Splunk HEC for monitoring

class ExtensionSplunkLogger {
  static SPLUNK_HOST = "34.200.46.182";
  static SPLUNK_PORT = "8088";
  static SPLUNK_TOKEN = "08467373-6f2b-4d5c-a099-222c25412616";
  static SPLUNK_URL = `http://${this.SPLUNK_HOST}:${this.SPLUNK_PORT}/services/collector/event`; // Changed to HTTP

  static async sendEvent(eventType, data, sourcetype = "cyberclowns:extension") {
    const payload = {
      event: {
        type: eventType,
        timestamp: new Date().toISOString(),
        ...data,
      },
      sourcetype: sourcetype,
    };

    try {
      const response = await fetch(this.SPLUNK_URL, {
        method: "POST",
        headers: {
          Authorization: `Splunk ${this.SPLUNK_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`✅ Splunk event sent: ${eventType}`);
        return true;
      } else {
        console.warn(`⚠️  Splunk error (${response.status})`);
        return false;
      }
    } catch (error) {
      console.error("Splunk send error:", error);
      return false;
    }
  }

  // Log phishing detection with all context
  static async logPhishingDetection(verdict, url, confidence, warnings, urlScore, visualScore, behaviorScore) {
    return await this.sendEvent(
      "phishing_detection",
      {
        url: url,
        verdict: verdict,
        confidence_score: parseFloat(confidence.toFixed(2)),
        url_score: parseFloat(urlScore.toFixed(2)),
        visual_score: parseFloat(visualScore.toFixed(2)),
        behavior_score: parseFloat(behaviorScore.toFixed(2)),
        warning_count: warnings.length,
        warnings: warnings.slice(0, 5),
        source: "browser_extension",
        severity: verdict === "phishing" ? "critical" : verdict === "suspicious" ? "warning" : "info",
        browser: navigator.userAgent,
      },
      "cyberclowns:detection"
    );
  }

  // Log when user sees warning overlay
  static async logWarningShown(url, verdict) {
    return await this.sendEvent(
      "warning_shown",
      {
        url: url,
        verdict: verdict,
        user_saw_warning: true,
      },
      "cyberclowns:user_interaction"
    );
  }

  // Log user interaction with warning
  static async logWarningInteraction(url, verdict, action) {
    return await this.sendEvent(
      "warning_interaction",
      {
        url: url,
        verdict: verdict,
        user_action: action, // "proceed", "leave", "dismiss", "report"
        action_severity: action === "proceed" ? "risky" : "safe",
      },
      "cyberclowns:user_interaction"
    );
  }

  // Log extension loaded
  static async logExtensionLoaded() {
    return await this.sendEvent(
      "extension_loaded",
      {
        version: "1.0.0",
        message: "CyberClowns extension initialized",
      },
      "cyberclowns:extension_event"
    );
  }

  // Log analysis error
  static async logAnalysisError(url, error) {
    return await this.sendEvent(
      "analysis_error",
      {
        url: url,
        error: error.toString(),
        severity: "error",
      },
      "cyberclowns:error"
    );
  }

  // Log backend connectivity
  static async logBackendStatus(status, message = "") {
    return await this.sendEvent(
      "backend_status",
      {
        status: status,
        message: message,
        timestamp: new Date().toISOString(),
      },
      "cyberclowns:backend_status"
    );
  }
}

// Log when extension loads
ExtensionSplunkLogger.logExtensionLoaded();
