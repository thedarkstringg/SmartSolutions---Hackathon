// Tilloff Auth Manager
// Handles Supabase authentication and session management

// ⚠️ UPDATE THESE WITH YOUR SUPABASE PROJECT DETAILS
const SUPABASE_URL = "https://tszkdmqjuoxfxbnsdfmw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzemtkbXFqdW94ZnhibnNkZm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ4NDIsImV4cCI6MjA5MTQyMDg0Mn0.FQrPM6bq35NVbnLfKrLT5Caw3CsKGHsmBHrUW-fU9as";

let supabase = null;

// Initialize Supabase
async function initSupabase() {
  try {
    if (!window.supabase) {
      console.error("Supabase CDN failed to load - window.supabase is undefined");
      showLoginError("Service initialization error - refresh extension");
      return false;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase initialized successfully");
    return true;
  } catch (error) {
    console.error("Supabase initialization error:", error);
    showLoginError("Failed to initialize authentication service");
    return false;
  }
}

// === DOM ELEMENTS ===
const authPanel = document.getElementById("auth-panel");
const mainContent = document.getElementById("main-content");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginFormElement = document.getElementById("login-form-element");
const signupFormElement = document.getElementById("signup-form-element");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");
const toggleSignup = document.getElementById("toggle-signup");
const toggleLogin = document.getElementById("toggle-login");
const logoutButton = document.getElementById("logout-button");

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", async () => {
  const initialized = await initSupabase();

  if (!initialized) {
    console.error("Supabase initialization failed - auth will not work");
  }

  // CRITICAL: Check auth before anything else
  await checkAuth();

  // Only initialize popup features if authenticated
  const token = await chrome.storage.local.get("auth_token");
  if (!token.auth_token) {
    // Not authenticated - form listeners only
    setupAuthFormListeners();
  } else {
    // Authenticated - setup main features
    setupMainFeatures();
  }
});

// === SETUP AUTH FORM LISTENERS ===
function setupAuthFormListeners() {
  loginFormElement.addEventListener("submit", handleLogin);
  signupFormElement.addEventListener("submit", handleSignup);

  // Toggle between login and signup
  toggleSignup.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  });

  toggleLogin.addEventListener("click", (e) => {
    e.preventDefault();
    signupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });
}

// === SETUP MAIN FEATURES ===
function setupMainFeatures() {
  // Logout
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  // Call popup.js to setup all main features
  setupMainPopupFeatures();
}

// Form submissions
// Moved into setupAuthFormListeners
// loginFormElement.addEventListener("submit", handleLogin);
// signupFormElement.addEventListener("submit", handleSignup);

// === CHECK AUTH STATUS ===
async function checkAuth() {
  try {
    const token = await chrome.storage.local.get("auth_token");
    if (token.auth_token) {
      // User is logged in
      authPanel.classList.add("hidden");
      mainContent.classList.remove("hidden");
      console.log("User authenticated");
    } else {
      // Show auth panel
      authPanel.classList.remove("hidden");
      mainContent.classList.add("hidden");
    }
  } catch (error) {
    console.error("Auth check error:", error);
    authPanel.classList.remove("hidden");
  }
}

// === LOGIN ===
async function handleLogin(e) {
  e.preventDefault();

  if (!supabase) {
    showLoginError("Authentication service not available - please reload");
    return;
  }

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showLoginError("Please enter email and password");
    return;
  }

  try {
    // Show loading state
    const btn = loginFormElement.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Signing in...";

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      showLoginError(error.message);
      btn.disabled = false;
      btn.textContent = "Sign In";
      return;
    }

    // Store token
    await chrome.storage.local.set({
      auth_token: data.session.access_token,
      user: JSON.stringify(data.user),
    });

    console.log("Login successful:", data.user.email);

    // Show main content
    authPanel.classList.add("hidden");
    mainContent.classList.remove("hidden");

    btn.disabled = false;
    btn.textContent = "Sign In";
  } catch (error) {
    console.error("Login error:", error);
    showLoginError("Login failed. Please try again.");
    const btn = loginFormElement.querySelector("button");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

// === SIGN UP ===
async function handleSignup(e) {
  e.preventDefault();

  if (!supabase) {
    showSignupError("Authentication service not available - please reload");
    return;
  }

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

  if (password.length < 8) {
    showSignupError("Password must be at least 8 characters");
    return;
  }

  try {
    // Show loading state
    const btn = signupFormElement.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      showSignupError(error.message);
      btn.disabled = false;
      btn.textContent = "Create Account";
      return;
    }

    // Store token
    if (data.session) {
      await chrome.storage.local.set({
        auth_token: data.session.access_token,
        user: JSON.stringify(data.user),
      });

      console.log("Signup successful:", data.user.email);

      // Show main content
      authPanel.classList.add("hidden");
      mainContent.classList.remove("hidden");
    } else {
      showSignupError("Please check your email to confirm your account");
    }

    btn.disabled = false;
    btn.textContent = "Create Account";
  } catch (error) {
    console.error("Signup error:", error);
    showSignupError("Signup failed. Please try again.");
    const btn = signupFormElement.querySelector("button");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

// === LOGOUT ===
async function handleLogout() {
  try {
    // Sign out from Supabase
    if (supabase) {
      await supabase.auth.signOut();
    }

    // Clear storage
    await chrome.storage.local.remove("auth_token");
    await chrome.storage.local.remove("user");

    // Show auth panel
    authPanel.classList.remove("hidden");
    mainContent.classList.add("hidden");

    // Reset forms
    loginFormElement.reset();
    signupFormElement.reset();
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");

    console.log("Logged out successfully");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// === ERROR HANDLING ===
function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
  setTimeout(() => {
    loginError.classList.add("hidden");
  }, 5000);
}

function showSignupError(message) {
  signupError.textContent = message;
  signupError.classList.remove("hidden");
  setTimeout(() => {
    signupError.classList.add("hidden");
  }, 5000);
}
