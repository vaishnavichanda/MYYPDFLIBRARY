// Settings: change password and sign out.

const passwordForm = $("passwordForm");

passwordForm.addEventListener("submit", async event => {
  event.preventDefault();

  const newPassword = $("newPasswordInput").value;

  if (newPassword !== $("confirmPasswordInput").value) {
    showStatus("The passwords do not match.", "error", "passwordMessage");
    return;
  }

  const saveButton = $("savePasswordBtn");
  saveButton.disabled = true;
  showStatus("Updating...", "", "passwordMessage");

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    passwordForm.reset();
    showStatus("Password updated.", "success", "passwordMessage");
  } catch (error) {
    console.error("Change password error:", error);
    showStatus(
      error.message || "Could not update your password.",
      "error",
      "passwordMessage"
    );
  } finally {
    saveButton.disabled = false;
  }
});

$("signOutBtn").addEventListener("click", async () => {
  const button = $("signOutBtn");
  button.disabled = true;

  try {
    await signOut();
  } catch (error) {
    console.error("Sign out error:", error);
    window.alert(`Could not sign out: ${error.message}`);
    button.disabled = false;
  }
});

(async function initializeSettings() {
  const user = await requireSession();
  if (!user) return;

  revealPage();
})();
