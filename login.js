
const SUPABASE_URL =
  "https://qqohtzjvcmioeariwhnk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_GezO_D3FFGafSO6gg2bUjQ_ASnEoCYk";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// Get the login form elements
const loginForm = document.getElementById("loginForm");
const recoveryForm = document.getElementById("recoveryForm");
const resetForm = document.getElementById("resetForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

const recoveryUrl = new URL(window.location.href);
const isRecoveryCallback =
  recoveryUrl.searchParams.get("reset") === "1" ||
  recoveryUrl.searchParams.get("type") === "recovery" ||
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
let recoveryVerified = false;

function showForm(form) {
  [loginForm, recoveryForm, resetForm].forEach(item => {
    item.hidden = item !== form;
  });
  showMessage("");
}

// Display success and error messages
function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#c0392b" : "#237a45";
}

document.getElementById("forgotPasswordButton").addEventListener("click", () => {
  document.getElementById("recoveryEmail").value = emailInput.value.trim();
  showForm(recoveryForm);
});

document.getElementById("backToLoginButton").addEventListener("click", () => {
  showForm(loginForm);
});

recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();

  const button = document.getElementById("sendRecoveryButton");
  button.disabled = true;
  button.textContent = "Sending...";
  showMessage("");

  try {
    const redirectTo = new URL("login.html", window.location.href);
    redirectTo.searchParams.set("reset", "1");

    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      document.getElementById("recoveryEmail").value.trim(),
      { redirectTo: redirectTo.href }
    );

    if (error) throw error;

    showMessage("If an account exists for that email, a reset link is on its way.");
  } catch (error) {
    console.error("Password reset request error:", error);
    showMessage(error.message || "Could not send the reset email.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Send reset link";
  }
});

resetForm.addEventListener("submit", async event => {
  event.preventDefault();

  const newPassword = document.getElementById("newPassword").value;
  if (newPassword !== document.getElementById("confirmPassword").value) {
    showMessage("The passwords do not match.", true);
    return;
  }

  const button = document.getElementById("savePasswordButton");
  button.disabled = true;
  button.textContent = "Updating...";
  showMessage("");

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    showMessage("Password updated. Opening your library...");
    window.location.replace("index.html");
  } catch (error) {
    console.error("Password update error:", error);
    showMessage(error.message || "Could not update your password.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Update password";
  }
});

supabaseClient.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") {
    recoveryVerified = true;
    showForm(resetForm);
  }
});

// Handle sign-in
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";
  showMessage("");

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });

    if (error) {
      showMessage(error.message, true);
      return;
    }

    if (data.session) {
      showMessage("Login successful. Opening your library...");

      // Open the PDF library after successful login
      window.location.replace("index.html");
    }
  } catch (error) {
    console.error("Login error:", error);
    showMessage("Something went wrong. Please try again.", true);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Sign In";
  }
});

// Only a verified Supabase recovery event can open the password form.
(async function checkSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check error:", error);
      return;
    }

    if (isRecoveryCallback && !recoveryVerified) {
      showForm(recoveryForm);
      showMessage(
        "This reset link is invalid or expired. Request a new reset link.",
        true
      );
    } else if (data.session && !isRecoveryCallback) {
      window.location.replace("index.html");
    }
  } catch (error) {
    console.error("Could not check session:", error);
  }
})();
