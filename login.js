
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
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

// Display success and error messages
function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#c0392b" : "#237a45";
}

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

// If the user is already signed in, open the library
(async function checkSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check error:", error);
      return;
    }

    if (data.session) {
      window.location.replace("index.html");
    }
  } catch (error) {
    console.error("Could not check session:", error);
  }
})();
