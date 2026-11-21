const SUPABASE_URL =
  "https://qqohtzjvcmioeariwhnk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_GezO_D3FFGafSO6gg2bUjQ_ASnEoCYk";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const signupForm = document.getElementById("signupForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const signupButton = document.getElementById("signupButton");
const message = document.getElementById("message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#c0392b" : "#237a45";
}

signupForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (passwordInput.value !== confirmPasswordInput.value) {
    showMessage("The passwords do not match.", true);
    return;
  }

  signupButton.disabled = true;
  signupButton.textContent = "Creating account...";
  showMessage("");

  try {
    const emailRedirectTo = new URL("login.html", window.location.href).href;
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailInput.value.trim(),
      password: passwordInput.value,
      options: { emailRedirectTo }
    });

    if (error) throw error;

    if (data.session) {
      window.location.replace("index.html");
    } else {
      showMessage(
        "Account created. Check your email to confirm your address, then sign in."
      );
      signupForm.reset();
    }
  } catch (error) {
    console.error("Registration error:", error);
    showMessage(error.message || "Could not create your account.", true);
  } finally {
    signupButton.disabled = false;
    signupButton.textContent = "Create account";
  }
});
