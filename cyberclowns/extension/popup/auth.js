// Tilloff Auth Manager
// Handles Supabase authentication and session management

// ⚠️ UPDATE THESE WITH YOUR SUPABASE PROJECT DETAILS
const SUPABASE_URL = "https://tszkdmqjuoxfxbnsdfmw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzemtkbXFqdW94ZnhibnNkZm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ4NDIsImV4cCI6MjA5MTQyMDg0Mn0.FQrPM6bq35NVbnLfKrLT5Caw3CsKGHsmBHrUW-fU9as";

let supabaseClient = null;
let useLocalAuth = false; // Fallback flag

// Initialize Supabase with fallback to local auth
async function initSupabase() {
  try {
    if (!window.supabase) {
      console.warn("Supabase library not found - falling back to local auth");
      useLocalAuth = true;
      return true;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase initialized successfully");
    useLocalAuth = false;
    return true;
  } catch (error) {
    console.warn("Supabase initialization error - falling back to local auth:", error);
    useLocalAuth = true;
    return true; // Return true because we have a fallback
  }
}

// Local auth functions
async function localAuthSignUp(email, password, name) {
  // Check if user already exists
  const users = await chrome.storage.local.get("local_users");
  const usersList = users.local_users || {};

  if (usersList[email]) {
    throw new Error("User already exists");
  }

  // Store user (password stored as-is for demo - in production, use bcrypt)
  usersList[email] = {
    password: password,
    name: name,
    created: new Date().toISOString()
  };

  await chrome.storage.local.set({ local_users: usersList });

  return {
    user: { email: email, id: email, user_metadata: { full_name: name } },
    session: true
  };
}

async function localAuthSignIn(email, password) {
  const users = await chrome.storage.local.get("local_users");
  const usersList = users.local_users || {};

  if (!usersList[email] || usersList[email].password !== password) {
    throw new Error("Invalid email or password");
  }

  return {
    user: {
      email: email,
      id: email,
      user_metadata: { full_name: usersList[email].name }
    },
    session: true
  };
}

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

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", async () => {
  const initialized = await initSupabase();

  if (!initialized) {
    console.error("Supabase initialization failed - auth will not work");
  }

  // CRITICAL: Check auth before anything else
  checkSession();

  // Event Listeners
  if (toggleSignupBtn) toggleSignupBtn.addEventListener("click", () => showSignup());
  if (toggleLoginBtn) toggleLoginBtn.addEventListener("click", () => showLogin());

  if (loginFormElement) loginFormElement.addEventListener("submit", handleLogin);
  if (signupFormElement) signupFormElement.addEventListener("submit", handleSignup);

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
});

// === SESSION MANAGEMENT ===
async function checkSession() {
  // Check for local session first
  const storage = await chrome.storage.local.get("current_user");
  if (storage.current_user) {
    console.log("Local session found:", storage.current_user.email);
    showMainContent(storage.current_user);
    return;
  }

  // Then try Supabase
  if (!supabaseClient || useLocalAuth) return;

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (session) {
      console.log("Supabase session found:", session.user.email);
      showMainContent(session.user);
    } else {
      console.log("No active session found");
      showAuthPanel();
    }
  } catch (error) {
    console.error("Session check error:", error);
    showAuthPanel();
  }
}

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
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email.split("@")[0]
    }
  });

  // Initialize main features if available
  if (typeof setupMainPopupFeatures === "function") {
    setupMainPopupFeatures();
  }
}

// === FORM NAVIGATION ===
function showLogin() {
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  hideErrors();
}

function showSignup() {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  hideErrors();
}

function hideErrors() {
  loginError.classList.add("hidden");
  signupError.classList.add("hidden");
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function showSignupError(message) {
  signupError.textContent = message;
  signupError.classList.remove("hidden");
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
    btn.disabled = true;
    btn.textContent = "Signing in...";

    let data;

    // Use Supabase if available, otherwise use local auth
    if (supabaseClient && !useLocalAuth) {
      const result = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (result.error) throw result.error;
      data = result.data;
    } else {
      data = await localAuthSignIn(email, password);
    }

    if (data.session) {
      showMainContent(data.user);
      // Save local session
      await chrome.storage.local.set({
        current_user: {
          email: data.user.email,
          id: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.email.split("@")[0]
        }
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    showLoginError(error.message || "Invalid email or password");
  } finally {
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

  if (password.length < 8) {
    showSignupError("Password must be at least 8 characters");
    return;
  }

  try {
    const btn = signupFormElement.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    let data;

    // Use Supabase if available, otherwise use local auth
    if (supabaseClient && !useLocalAuth) {
      const result = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      if (result.error) throw result.error;
      data = result.data;

      if (data.user) {
        if (data.session) {
          showMainContent(data.user);
        } else {
          showSignupError("Account created! Please check your email for verification.");
        }
      }
    } else {
      data = await localAuthSignUp(email, password, name);
      if (data.user) {
        showMainContent(data.user);
        // Save local session
        await chrome.storage.local.set({
          current_user: {
            email: data.user.email,
            id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.email.split("@")[0]
          }
        });
      }
    }
  } catch (error) {
    console.error("Signup error:", error);
    showSignupError(error.message || "Failed to create account");
  } finally {
    const btn = signupFormElement.querySelector("button");
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

// === LOGOUT ===
async function handleLogout() {
  try {
    // Sign out from Supabase if available
    if (supabaseClient && !useLocalAuth) {
      await supabaseClient.auth.signOut();
    }

    // Clear all storage
    await chrome.storage.local.remove("auth_token");
    await chrome.storage.local.remove("user");
    await chrome.storage.local.remove("current_user");

    // Show auth panel
    showAuthPanel();
  } catch (error) {
    console.error("Logout error:", error);
    // Force show auth anyway
    showAuthPanel();
  }
}
