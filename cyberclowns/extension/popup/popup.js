// CyberClowns Popup UI Script

// === STATE ===
let currentTabId = null;
let pollTimeout = null;
let pollsMissed = 0;

// === DOM ELEMENTS ===
const loadingState = document.getElementById("loading-state");
const resultsState = document.getElementById("results-state");
const errorState = document.getElementById("error-state");
const backendStatus = document.getElementById("backend-status");
const rescanButton = document.getElementById("rescan-button");
const retryButton = document.getElementById("retry-button");

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", async () => {
  await initializePopup();
  rescanButton.addEventListener("click", handleRescan);
  retryButton.addEventListener("click", handleRetry);
});

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

  // Check backend health
  checkBackendStatus();

  // Load and display result
  await loadResult();
}

// === BACKEND STATUS CHECK ===
async function checkBackendStatus() {
  try {
    const response = await fetch("http://localhost:8000/health", {
      method: "GET",
      timeout: 3000,
    });

    if (response.ok) {
      backendStatus.className = "backend-status connected";
      backendStatus.title = "Backend connected";
    } else {
      backendStatus.className = "backend-status disconnected";
      backendStatus.title = "Backend error";
    }
  } catch (error) {
    backendStatus.className = "backend-status disconnected";
    backendStatus.title = "Backend disconnected";
  }
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
  loadingState.classList.add("visible");
  resultsState.classList.add("hidden");
  errorState.classList.add("hidden");
}

function showError(message) {
  loadingState.classList.add("hidden");
  resultsState.classList.add("hidden");
  errorState.classList.remove("hidden");
  document.getElementById("error-message").textContent = message;
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
    scan_timestamp,
    site_info,
  } = result;

  // Display URL
  const domain = site_info?.domain || "Unknown";
  document.getElementById("siteUrl").textContent = domain;

  // Display verdict badge
  const verdictBadge = document.getElementById("verdictBadge");
  const verdictText = document.getElementById("verdictText");

  verdictBadge.className = "verdict-badge";
  if (verdict === "safe") {
    verdictBadge.classList.add("safe");
    verdictText.textContent = "✓ SAFE";
  } else if (verdict === "suspicious") {
    verdictBadge.classList.add("suspicious");
    verdictText.textContent = "⚠ SUSPICIOUS";
  } else if (verdict === "phishing") {
    verdictBadge.classList.add("phishing");
    verdictText.textContent = "✗ PHISHING";
  } else {
    verdictBadge.classList.add("unknown");
    verdictText.textContent = "? UNKNOWN";
  }

  // Display confidence score
  const confidencePercent = Math.round((confidence_score || 0) * 100);
  document.getElementById("confidenceValue").textContent = `${confidencePercent}%`;
  updateProgressBar("confidenceBar", confidence_score || 0, verdict);

  // Display individual scores
  document.getElementById("urlScoreValue").textContent = (url_score || 0).toFixed(
    2
  );
  updateProgressBar("urlScoreBar", url_score || 0, "neutral");

  document.getElementById("visualScoreValue").textContent = (visual_score || 0).toFixed(
    2
  );
  updateProgressBar("visualScoreBar", visual_score || 0, "neutral");

  document.getElementById("behaviorScoreValue").textContent = (
    behavior_score || 0
  ).toFixed(2);
  updateProgressBar("behaviorScoreBar", behavior_score || 0, "neutral");

  // Display warnings
  const warningsSection = document.getElementById("warnings-section");
  const warningsList = document.getElementById("warnings-list");

  if (warnings && warnings.length > 0) {
    warningsList.innerHTML = "";
    warnings.forEach((warning) => {
      const li = document.createElement("li");
      li.textContent = warning;
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
      timeStr = `${Math.floor(secondsAgo / 60)} minutes ago`;
    } else if (secondsAgo > 0) {
      timeStr = `${secondsAgo} seconds ago`;
    }

    document.getElementById("timestamp").textContent = `Last scanned: ${timeStr}`;
  }
}

// === PROGRESS BAR STYLING ===
function updateProgressBar(elementId, score, type) {
  const bar = document.getElementById(elementId);
  const percentage = Math.round((score || 0) * 100);
  bar.style.width = `${percentage}%`;

  bar.className = "mini-bar";
  if (type === "safe") {
    bar.classList.add("safe");
  } else if (type === "suspicious") {
    bar.classList.add("suspicious");
  } else if (type === "phishing") {
    bar.classList.add("phishing");
  } else {
    bar.classList.add("neutral");
  }

  if (elementId === "confidenceBar") {
    bar.className = "confidence-bar";
    bar.classList.add(type);
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
