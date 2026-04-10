// CyberClowns Real-Time Warning Overlay
// Injects a warning banner into the page when phishing is detected
// Uses Shadow DOM to isolate styles from host page CSS

(function () {
  // === CONSTANTS ===
  const OVERLAY_ID = "cyberclowns-overlay-container";
  const DISMISSAL_KEY_PREFIX = "cyberclowns_dismissed_";

  // === STYLING ===
  const OVERLAY_STYLES = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :host {
      all: initial;
    }

    .overlay-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideDown 0.4s ease-out;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .overlay-banner {
      padding: 16px 20px;
      display: flex;
      align-items: start;
      gap: 16px;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .overlay-banner.phishing {
      background: linear-gradient(135deg, #d50000 0%, #b50000 100%);
      color: white;
      border-bottom: 3px solid #8b0000;
      box-shadow: 0 4px 20px rgba(213, 0, 0, 0.4);
    }

    .overlay-banner.suspicious {
      background: linear-gradient(135deg, #ffd600 0%, #ffb300 100%);
      color: #1a1a1a;
      border-bottom: 3px solid #cc9900;
      box-shadow: 0 4px 20px rgba(255, 214, 0, 0.3);
    }

    .overlay-content {
      flex: 1;
      min-width: 250px;
    }

    .overlay-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .overlay-icon {
      font-size: 20px;
      line-height: 1;
    }

    .overlay-message {
      font-size: 13px;
      line-height: 1.4;
      margin-bottom: 8px;
      opacity: 0.95;
    }

    .overlay-warnings {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 6px;
    }

    .warning-pill {
      display: inline-block;
      background: rgba(0, 0, 0, 0.2);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .overlay-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 200px;
    }

    .overlay-button {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .overlay-button.primary {
      background: rgba(0, 0, 0, 0.3);
      color: white;
    }

    .overlay-button.primary:hover {
      background: rgba(0, 0, 0, 0.5);
      transform: scale(1.05);
    }

    .overlay-button.primary:active {
      transform: scale(0.98);
    }

    .overlay-button.secondary {
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
    }

    .overlay-button.secondary:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    .overlay-button.secondary:active {
      transform: scale(0.98);
    }

    .close-button {
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .close-button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .close-button:active {
      transform: scale(0.9);
    }

    @media (max-width: 768px) {
      .overlay-banner {
        flex-direction: column;
        align-items: stretch;
      }

      .overlay-actions {
        min-width: auto;
      }

      .overlay-button {
        flex: 1;
      }
    }
  `;

  // === HELPER FUNCTIONS ===

  function getDismissalKey() {
    try {
      return DISMISSAL_KEY_PREFIX + window.location.hostname;
    } catch {
      return DISMISSAL_KEY_PREFIX + "unknown";
    }
  }

  function isDismissed() {
    try {
      return sessionStorage.getItem(getDismissalKey()) === "true";
    } catch {
      return false;
    }
  }

  function markAsDismissed() {
    try {
      sessionStorage.setItem(getDismissalKey(), "true");
    } catch {
      // Ignore sessionStorage errors
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // === OVERLAY CREATION ===

  function createWarningOverlay(result) {
    // Remove any existing overlay first
    removeWarningOverlay();

    const verdict = result.verdict;
    const confidenceScore = result.confidence_score || 0;
    const warnings = result.warnings || [];

    // Determine styling based on verdict
    let icon, title, message, buttonText1, buttonText2;

    if (verdict === "phishing") {
      icon = "🚨";
      title = "PHISHING DETECTED";
      message = `This site may steal your data. Confidence: ${Math.round(
        confidenceScore * 100
      )}%`;
      buttonText1 = "Leave This Site";
      buttonText2 = "I Understand the Risk — Stay";
    } else if (verdict === "suspicious") {
      icon = "⚠️";
      title = "SUSPICIOUS SITE";
      message = `Proceed with caution. Confidence: ${Math.round(
        confidenceScore * 100
      )}%`;
      buttonText1 = "View Details";
      buttonText2 = "Dismiss";
    } else {
      return; // Don't show overlay for safe sites
    }

    // Create container
    const container = document.createElement("div");
    container.id = OVERLAY_ID;

    // Attach Shadow DOM
    const shadow = container.attachShadow({ mode: "open" });

    // Create styles
    const styleEl = document.createElement("style");
    styleEl.textContent = OVERLAY_STYLES;
    shadow.appendChild(styleEl);

    // Create banner structure
    const bannerDiv = document.createElement("div");
    bannerDiv.className = `overlay-banner ${verdict}`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "overlay-content";

    // Title
    const titleDiv = document.createElement("div");
    titleDiv.className = "overlay-title";
    const iconSpan = document.createElement("span");
    iconSpan.className = "overlay-icon";
    iconSpan.textContent = icon;
    const titleText = document.createElement("span");
    titleText.textContent = title;
    titleDiv.appendChild(iconSpan);
    titleDiv.appendChild(titleText);

    // Message
    const messageDiv = document.createElement("div");
    messageDiv.className = "overlay-message";
    messageDiv.textContent = message;

    // Warnings
    let warningsDiv = null;
    if (warnings && warnings.length > 0) {
      warningsDiv = document.createElement("div");
      warningsDiv.className = "overlay-warnings";

      warnings.slice(0, 3).forEach((warning) => {
        const pill = document.createElement("div");
        pill.className = "warning-pill";
        pill.textContent = `⚠ ${escapeHtml(warning.substring(0, 40))}`;
        warningsDiv.appendChild(pill);
      });
    }

    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(messageDiv);
    if (warningsDiv) {
      contentDiv.appendChild(warningsDiv);
    }

    // Buttons
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "overlay-actions";

    const button1 = document.createElement("button");
    button1.className = "overlay-button primary";
    button1.textContent = buttonText1;
    button1.addEventListener("click", () => {
      if (verdict === "phishing") {
        // 🆕 Log to Splunk before leaving
        if (typeof ExtensionSplunkLogger !== 'undefined') {
          ExtensionSplunkLogger.logWarningInteraction(window.location.href, verdict, "leave");
        }
        handleLeaveClick();
      } else {
        chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      }
    });

    const button2 = document.createElement("button");
    button2.className = "overlay-button secondary";
    button2.textContent = buttonText2;
    button2.addEventListener("click", () => {
      // 🆕 Log dismiss action to Splunk
      if (typeof ExtensionSplunkLogger !== 'undefined') {
        ExtensionSplunkLogger.logWarningInteraction(window.location.href, verdict, "dismiss");
      }
      if (verdict === "phishing") {
        markAsDismissed();
        removeWarningOverlay();
      } else {
        markAsDismissed();
        removeWarningOverlay();
      }
    });

    actionsDiv.appendChild(button1);
    actionsDiv.appendChild(button2);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-button";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      markAsDismissed();
      removeWarningOverlay();
    });

    bannerDiv.appendChild(contentDiv);
    bannerDiv.appendChild(actionsDiv);
    bannerDiv.appendChild(closeBtn);

    shadow.appendChild(bannerDiv);

    // Inject into page
    try {
      document.documentElement.insertBefore(
        container,
        document.documentElement.firstChild
      );
      // Adjust body margin to account for overlay
      if (document.body) {
        document.body.style.paddingTop = "0px";
      }
    } catch (e) {
      console.error("Failed to inject overlay:", e);
    }
  }

  function removeWarningOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
  }

  function handleLeaveClick() {
    // Try to go back first
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, open new tab
      try {
        window.location.href = "chrome://newtab";
      } catch (e) {
        // If that fails, just reload to about:blank
        window.location.href = "about:blank";
      }
    }
  }

  function showOverlayIfNeeded(result) {
    // Check if already dismissed
    if (isDismissed()) {
      return;
    }

    const verdict = result.verdict;

    if (verdict === "phishing" || verdict === "suspicious") {
      // 🆕 Log warning shown to Splunk
      if (typeof ExtensionSplunkLogger !== 'undefined') {
        ExtensionSplunkLogger.logWarningShown(window.location.href, verdict);
      }
      createWarningOverlay(result);
    } else {
      removeWarningOverlay();
    }
  }

  // === MESSAGE LISTENER ===
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SHOW_OVERLAY") {
      const payload = request.payload;
      showOverlayIfNeeded(payload);
    }
  });

  // === EXPORT ===
  window.CyberClownsOverlay = {
    showOverlayIfNeeded,
    removeWarningOverlay,
  };
})();
