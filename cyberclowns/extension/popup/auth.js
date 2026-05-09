// Tilloff Firebase Auth Manager
// Handles Firebase authentication and session management

// === DOM ELEMENTS ===
const authPanel = document.getElementById("auth-panel");
const mainContent = document.getElementById("main-content");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

const toggleSignupBtn = document.getElementById("toggle-signup");
const toggleLoginBtn = document.getElementById("toggle-login");

const loginFormElement = document.getElementById("login-form-element");
const signupFormElement = document.getElementById("signup-form-element");

const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");

const logoutBtn = document.getElementById("logout-button");
const accountLogoutBtn = document.getElementById("account-logout-btn");

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", async () => {
  // Check session on load
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("Firebase session found:", user.email);
      showMainContent(user);
    } else {
      console.log("No active session found");
      showAuthPanel();
    }
  });

  // Event Listeners
  if (toggleSignupBtn) toggleSignupBtn.addEventListener("click", () => showSignup());
  if (toggleLoginBtn) toggleLoginBtn.addEventListener("click", () => showLogin());

  if (loginFormElement) loginFormElement.addEventListener("submit", handleLogin);
  if (signupFormElement) signupFormElement.addEventListener("submit", handleSignup);

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (accountLogoutBtn) accountLogoutBtn.addEventListener("click", handleLogout);
});

// === SESSION MANAGEMENT ===
function showAuthPanel() {
  if (authPanel) authPanel.classList.remove("hidden");
  if (mainContent) mainContent.classList.add("hidden");
  showLogin();
}

function showMainContent(user) {
  if (authPanel) authPanel.classList.add("hidden");
  if (mainContent) mainContent.classList.remove("hidden");

  // Save to chrome storage for background scripts
  chrome.storage.local.set({
    "auth_token": "authenticated",
    "user": {
      id: user.uid,
      email: user.email,
      name: user.displayName || user.email.split("@")[0]
    }
  });

  // Update UI with user info
  const accountEmail = document.getElementById("account-email");
  const accountName = document.getElementById("account-name");
  if (accountEmail) accountEmail.textContent = user.email;
  if (accountName) accountName.textContent = user.displayName || user.email.split("@")[0];

  // Initialize main features if available
  if (typeof setupMainPopupFeatures === "function") {
    setupMainPopupFeatures();
  }
}

// === FORM NAVIGATION ===
function showLogin() {
  if (loginForm) loginForm.classList.remove("hidden");
  if (signupForm) signupForm.classList.add("hidden");
  hideErrors();
}

function showSignup() {
  if (loginForm) loginForm.classList.add("hidden");
  if (signupForm) signupForm.classList.remove("hidden");
  hideErrors();
}

function hideErrors() {
  if (loginError) loginError.classList.add("hidden");
  if (signupError) signupError.classList.add("hidden");
}

function showLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
  }
}

function showSignupError(message) {
  if (signupError) {
    signupError.textContent = message;
    signupError.classList.remove("hidden");
  }
}

// === LOGIN ===
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showLoginError("Please enter both email and password");
    return;
  }

  try {
    const btn = loginFormElement.querySelector("button");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Signing in...";

    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged will handle UI update
  } catch (error) {
    console.error("Login error:", error);
    showLoginError(error.message);
    const btn = loginFormElement.querySelector("button");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

// === SIGN UP ===
async function handleSignup(e) {
  e.preventDefault();

  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const passwordConfirm = document.getElementById("signup-password-confirm").value;

  // Validation
  if (!name || !email || !password || !passwordConfirm) {
    showSignupError("Please fill in all fields");
    return;
  }

  if (password !== passwordConfirm) {
    showSignupError("Passwords do not match");
    return;
  }

  if (password.length < 6) {
    showSignupError("Password must be at least 6 characters");
    return;
  }

  try {
    const btn = signupFormElement.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Update profile with name
    await user.updateProfile({
      displayName: name
    });
    
    // onAuthStateChanged will handle UI update
  } catch (error) {
    console.error("Signup error:", error);
    showSignupError(error.message);
    const btn = signupFormElement.querySelector("button");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

// === LOGOUT ===
async function handleLogout() {
  try {
    await auth.signOut();

    // Clear all storage
    await chrome.storage.local.remove(["auth_token", "user", "current_user"]);

    // Show auth panel
    showAuthPanel();
  } catch (error) {
    console.error("Logout error:", error);
    showAuthPanel();
  }
}
