// Builds the sidebar on every page. Each page marks itself with
// <body data-page="dashboard|subjects|profile|settings">.

(function () {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const pages = [
    { key: "dashboard", href: "dashboard.html", icon: "🏠", label: "Dashboard" },
    { key: "subjects", href: "subjects.html", icon: "📚", label: "Subjects" },
    { key: "profile", href: "profile.html", icon: "👤", label: "Profile" },
    { key: "settings", href: "settings.html", icon: "⚙️", label: "Settings" }
  ];

  const current = document.body.dataset.page;

  const links = pages.map(page => `
    <a class="sidebar-link${page.key === current ? " active" : ""}"
       href="${page.href}"
       ${page.key === current ? 'aria-current="page"' : ""}>
      <span class="sidebar-icon" aria-hidden="true">${page.icon}</span>
      <span>${page.label}</span>
    </a>
  `).join("");

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">PDF</div>
      <div>
        <strong>My PDF Library</strong>
        <span>Your personal cloud library</span>
      </div>
    </div>

    <nav class="sidebar-nav" aria-label="Main menu">${links}</nav>

    <div class="sidebar-footer">
      <button id="sidebarSignOut" class="sidebar-signout" type="button">
        <span class="sidebar-icon" aria-hidden="true">🚪</span>
        <span>Sign out</span>
      </button>
    </div>
  `;

  // Dark overlay behind the menu on small screens.
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  function setOpen(open) {
    document.body.classList.toggle("sidebar-open", open);
  }

  const toggle = document.getElementById("menuToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("sidebar-open"));
    });
  }

  overlay.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setOpen(false);
  });

  document
    .getElementById("sidebarSignOut")
    .addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;

      try {
        await signOut();
      } catch (error) {
        console.error("Sign out error:", error);
        window.alert(`Could not sign out: ${error.message}`);
        button.disabled = false;
      }
    });
})();
