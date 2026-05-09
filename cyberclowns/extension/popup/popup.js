// Tilloff Security Detector Popup

// === STATE ===
let currentTabId = null;
let pollTimeout = null;
let pollsMissed = 0;

// === DOM ELEMENTS ===
const loadingState = document.getElementById("loading-state");
const resultsState = document.getElementById("results-state");
const errorState = document.getElementById("error-state");
const rescanButton = document.getElementById("rescan-button");
const retryButton = document.getElementById("retry-button");
const accountButton = document.getElementById("account-button");
const dashboardHeaderBtn = document.getElementById("dashboard-header-btn");
const menuButton = document.getElementById("menu-button");
const menuPanel = document.getElementById("menu-panel");
const closeMenuButton = document.getElementById("close-menu");

// Menu buttons
const settingsBtn = document.getElementById("settings-btn");
const historyBtn = document.getElementById("history-btn");
const helpBtn = document.getElementById("help-btn");
const aboutBtn = document.getElementById("about-btn");

// Panels
const settingsPanel = document.getElementById("settings-panel");
const historyPanel = document.getElementById("history-panel");
const helpPanel = document.getElementById("help-panel");
const aboutPanel = document.getElementById("about-panel");
const accountPanel = document.getElementById("account-panel");

// Back buttons
const backButtons = document.querySelectorAll(".back-button");

// === INITIALIZATION ===
// NOTE: This is called from auth.js ONLY after authentication is verified
// Do NOT add DOMContentLoaded here - it will be triggered by auth.js

// Setup all main features - called only if authenticated
function setupMainPopupFeatures() {
  loadIcon();

  // Button event listeners
  rescanButton.addEventListener("click", handleRescan);
  retryButton.addEventListener("click", handleRetry);
  accountButton.addEventListener("click", () => openAccountPanel());
  dashboardHeaderBtn.addEventListener("click", openAnalyticsDashboard);
  menuButton.addEventListener("click", toggleMenu);
  closeMenuButton.addEventListener("click", toggleMenu);

  // Menu item listeners
  settingsBtn.addEventListener("click", () => showPanel(settingsPanel));
  historyBtn.addEventListener("click", () => showPanel(historyPanel));
  helpBtn.addEventListener("click", () => showPanel(helpPanel));
  aboutBtn.addEventListener("click", () => showPanel(aboutPanel));

  // Back button listeners
  backButtons.forEach(btn => {
    btn.addEventListener("click", closePanel);
  });

  // Account logout button
  document.getElementById("account-logout-btn").addEventListener("click", handleLogout);

  // Initialize the popup
  initializePopup();
}

// === LOAD ICON ===
function loadIcon() {
  const logoIcon = document.getElementById("logo-icon");
  if (!logoIcon) return;

  try {
    const iconUrl = chrome.runtime.getURL("icon.png");
    if (iconUrl) {
      logoIcon.src = iconUrl;
      logoIcon.style.display = "block";
    }
  } catch (error) {
    // Icon not available, hide it
    logoIcon.style.display = "none";
    console.log("Icon not available, using default");
  }
}

async function initializePopup() {
  // Get current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tabs || !tabs[0]) {
    showError("Could not determine current tab");
    return;
  }

  currentTabId = tabs[0].id;
  const currentUrl = tabs[0].url;

  // Check if URL is analyzable
  if (
    !currentUrl ||
    currentUrl.startsWith("chrome://") ||
    currentUrl.startsWith("chrome-extension://") ||
    currentUrl.startsWith("about:")
  ) {
    showError("This page cannot be analyzed (internal Chrome page)");
    return;
  }

  // Load and display result
  await loadResult();
}

// === RESULT LOADING WITH POLLING ===
async function loadResult() {
  // Get result from background script
  chrome.runtime.sendMessage(
    { type: "GET_RESULT", payload: { tabId: currentTabId } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        showError("Failed to communicate with background script");
        return;
      }

      if (response && response.verdict === "pending") {
        // Still analyzing - show loading and poll again
        showLoading();
        pollsMissed++;

        if (pollsMissed > 75) {
          // After ~150 seconds of polling, give up
          showError("Analysis took too long. Please try again.");
          return;
        }

        // Poll again in 2 seconds
        clearTimeout(pollTimeout);
        pollTimeout = setTimeout(loadResult, 2000);
      } else if (response && response.error) {
        // Error occurred
        showError(response.error);
      } else if (response && response.verdict) {
        // We have a result!
        pollsMissed = 0;
        clearTimeout(pollTimeout);
        displayResult(response);
      } else {
        // No result yet
        showLoading();
      }
    }
  );
}

// === UI STATE FUNCTIONS ===
function showLoading() {
  loadingState.classList.remove("hidden");
  resultsState.classList.add("hidden");
  errorState.classList.add("hidden");
}

function showError(message) {
  loadingState.classList.add("hidden");
  resultsState.classList.add("hidden");
  errorState.classList.remove("hidden");
  const errorMsgEl = document.getElementById("error-message");
  if (errorMsgEl) errorMsgEl.textContent = message;
}

function displayResult(result) {
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");
  resultsState.classList.remove("hidden");

  const {
    url_score,
    visual_score,
    behavior_score,
    confidence_score,
    verdict,
    warnings,
    warning_details,
    scan_timestamp,
    site_info,
  } = result;

  // Store warning details globally for modal
  window.currentWarnings = warnings || [];
  window.currentWarningDetails = warning_details || {};

  // Display URL
  const domain = site_info?.domain || "Unknown";
  document.getElementById("siteUrl").textContent = domain;

  // Display verdict text and badge
  const verdictBadge = document.getElementById("verdictBadge");
  const verdictText = document.getElementById("verdictText");
  const verdictIcon = verdictBadge.querySelector(".material-symbols-outlined");

  // Reset classes
  verdictBadge.className = "w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500";
  verdictText.className = "font-headline-md tracking-tight leading-none mb-1 transition-all duration-500";
  
  if (verdict === "safe") {
    verdictBadge.classList.add("bg-primary-container/30", "border-primary/20");
    verdictText.classList.add("text-on-surface");
    verdictText.textContent = "Protected";
    verdictIcon.textContent = "shield_locked";
    verdictIcon.className = "material-symbols-outlined text-primary fill";
    verdictIcon.style.fontSize = "24px";
  } else if (verdict === "suspicious") {
    verdictBadge.classList.add("bg-tertiary-container/30", "border-tertiary/20");
    verdictText.classList.add("text-tertiary");
    verdictText.textContent = "Suspicious";
    verdictIcon.textContent = "gpp_maybe";
    verdictIcon.className = "material-symbols-outlined text-tertiary fill";
    verdictIcon.style.fontSize = "24px";
  } else if (verdict === "phishing") {
    verdictBadge.classList.add("bg-error-container/30", "border-error/20");
    verdictText.classList.add("text-error");
    verdictText.textContent = "Danger";
    verdictIcon.textContent = "gpp_bad";
    verdictIcon.className = "material-symbols-outlined text-error fill";
    verdictIcon.style.fontSize = "24px";
  }

  // Display confidence score
  const confidencePercent = Math.round((confidence_score || 0) * 100);
  document.getElementById("confidenceValue").textContent = `${confidencePercent}`;
  updateProgressBar("confidenceBar", confidence_score || 0, verdict);

  // Display individual scores
  document.getElementById("urlScoreValue").textContent = (url_score || 0).toFixed(2);
  document.getElementById("visualScoreValue").textContent = (visual_score || 0).toFixed(2);
  document.getElementById("behaviorScoreValue").textContent = (behavior_score || 0).toFixed(2);

  // Display warnings
  const warningsSection = document.getElementById("warnings-section");
  const warningsList = document.getElementById("warnings-list");

  if (warnings && warnings.length > 0) {
    warningsList.innerHTML = "";
    warnings.forEach((warning) => {
      const li = document.createElement("li");
      const severity = warning_details?.[warning] || "WARNING";
      
      let badgeClass = "bg-tertiary-container/20 text-tertiary border-tertiary/20";
      if (severity === "CRITICAL") badgeClass = "bg-error-container/20 text-error border-error/20";

      li.className = "flex items-start justify-between gap-2 font-mono-data";
      li.style.fontSize = "11px";
      li.style.lineHeight = "1.25";
      li.innerHTML = `
        <span class="text-on-surface-variant flex-1">${warning}</span>
        <span class="px-1.5 py-0.5 rounded border font-label-caps ${badgeClass}" style="font-size: 9px;">${severity}</span>
      `;
      warningsList.appendChild(li);
    });
    warningsSection.classList.remove("hidden");
  } else {
    warningsSection.classList.add("hidden");
  }

  // Display timestamp
  if (scan_timestamp) {
    const scanTime = new Date(scan_timestamp);
    const now = new Date();
    const secondsAgo = Math.floor((now - scanTime) / 1000);

    let timeStr = "just now";
    if (secondsAgo > 60) {
      timeStr = `${Math.floor(secondsAgo / 60)}m ago`;
    } else if (secondsAgo > 0) {
      timeStr = `${secondsAgo}s ago`;
    }

    document.getElementById("timestamp").textContent = `Last scanned: ${timeStr}`;
  }
}

// === PROGRESS BAR STYLING ===
function updateProgressBar(elementId, score, type) {
  const bar = document.getElementById(elementId);
  const percentage = Math.round((score || 0) * 100);
  bar.style.width = `${percentage}%`;

  bar.className = "h-full transition-all duration-1000";
  if (type === "safe") {
    bar.classList.add("bg-primary");
  } else if (type === "suspicious") {
    bar.classList.add("bg-tertiary");
  } else if (type === "phishing") {
    bar.classList.add("bg-error");
  } else {
    bar.classList.add("bg-primary");
  }
}

// === BUTTON HANDLERS ===
function handleRescan() {
  showLoading();
  pollsMissed = 0;

  chrome.runtime.sendMessage({
    type: "RESCAN",
    payload: { tabId: currentTabId, url: window.location.href },
  });

  // Start polling again
  clearTimeout(pollTimeout);
  pollTimeout = setTimeout(loadResult, 1000);
}

function handleRetry() {
  showLoading();
  pollsMissed = 0;
  clearTimeout(pollTimeout);
  pollTimeout = setTimeout(loadResult, 1000);
}

function handleLogout() {
  // Call the logout function from auth.js
  if (typeof window.handleLogout === "function") {
    window.handleLogout();
  }
}

// === ANALYTICS DASHBOARD ===
function openAnalyticsDashboard() {
  chrome.tabs.create({ url: "http://195.238.122.179:8000/dashboard.html" });
}

// === MENU & PANEL MANAGEMENT ===
function toggleMenu() {
  menuPanel.classList.toggle("hidden");
}

function showPanel(panel) {
  menuPanel.classList.add("hidden");
  panel.classList.remove("hidden");
  panel.classList.add("visible");
}

function closePanel() {
  settingsPanel.classList.add("hidden");
  historyPanel.classList.add("hidden");
  helpPanel.classList.add("hidden");
  aboutPanel.classList.add("hidden");
  accountPanel.classList.add("hidden");
  menuPanel.classList.remove("hidden");
}

// === ACCOUNT PANEL ===
async function openAccountPanel() {
  // Load user info from storage
  const storage = await chrome.storage.local.get("current_user");
  const user = storage.current_user || { email: "user@email.com", name: "User" };

  // Update account panel
  document.getElementById("account-name").textContent = user.name || "User";
  document.getElementById("account-email").textContent = user.email;

  // Show if local or cloud auth
  const isLocal = localStorage && localStorage.getItem ? true : false;
  document.getElementById("account-type").textContent = isLocal ? "Local Account" : "Cloud Account";

  showPanel(accountPanel);
}

// === MODAL MANAGEMENT ===
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("active");
    modal.classList.remove("hidden");
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("active");
    modal.classList.add("hidden");
  }
}

function openDetailsModal() {
  const detailsModal = document.getElementById("details-modal");
  if (!detailsModal) {
    // Create modal if it doesn't exist
    const modal = document.createElement("div");
    modal.id = "details-modal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Warning Details</h3>
          <button class="modal-close" onclick="closeModal('details-modal')">✕</button>
        </div>
        <div class="modal-body" id="details-content">
          <!-- Warning details will be populated here -->
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('details-modal')">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Populate warning details with custom severity mapping
  const detailsContent = document.getElementById("details-content");
  const warnings = window.currentWarnings || [];

  // Check if there are any warnings other than the known safe ones
  const suspiciousWarnings = [
    "high external resources",
    "javascript obfuscation",
    "suspicious css"
  ];
  const hasCriticalWarnings = warnings.some(
    (w) => !suspiciousWarnings.some((suspicious) => w.toLowerCase().includes(suspicious))
  );

  // Map warnings to severity levels
  function getWarningSeverity(warning) {
    const lowerWarning = warning.toLowerCase();

    // If there are critical warnings, only mark as suspicious if it's one of the safe types
    if (hasCriticalWarnings) {
      if (lowerWarning.includes("high external resources") || lowerWarning.includes("javascript obfuscation")) {
        return "SUSPICIOUS";
      } else {
        return "CRITICAL";
      }
    } else {
      // Only safe warnings exist, mark them as suspicious
      return "SUSPICIOUS";
    }
  }

  if (warnings.length === 0) {
    detailsContent.innerHTML = "<p>No warning details available.</p>";
  } else {
    detailsContent.innerHTML = warnings
      .map((warning) => {
        const severity = getWarningSeverity(warning);
        let badgeColor = "#ffc107"; // yellow for suspicious
        let textColor = "#000";
        if (severity === "CRITICAL") {
          badgeColor = "#ff6b6b";
          textColor = "#fff";
        }

        return `
          <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd;">
            <div style="font-weight: 500; margin-bottom: 4px;">${warning}</div>
            <div style="font-size: 12px; color: #666;">
              Severity: <span class="severity-badge" style="background-color: ${badgeColor}; color: ${textColor}; padding: 3px 10px; border-radius: 4px; font-weight: 500;">${severity}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  showModal("details-modal");
}
