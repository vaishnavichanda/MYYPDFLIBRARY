// Dashboard: overview of the library (storage details are on the Profile page).

const RECENT_LIMIT = 6;

let currentUser = null;
let pdfs = [];

function renderDashboard() {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const usedSubjects = new Set(pdfs.map(pdf => pdf.category));

  $("totalCount").textContent = pdfs.length;
  $("categoryCount").textContent = usedSubjects.size;
  $("weekCount").textContent =
    pdfs.filter(pdf => pdf.addedAt >= weekAgo).length;

  // Subject shortcuts (only subjects that have PDFs).
  const chips = $("subjectChips");
  chips.innerHTML = "";

  const counts = {};
  pdfs.forEach(pdf => {
    counts[pdf.category] = (counts[pdf.category] || 0) + 1;
  });

  const names = Object.keys(counts).sort((a, b) => a.localeCompare(b));

  if (names.length === 0) {
    chips.innerHTML =
      '<p class="chip-empty">No subjects with PDFs yet.</p>';
  } else {
    names.forEach(name => {
      const link = document.createElement("a");
      link.className = "chip";
      link.href = `subjects.html?subject=${encodeURIComponent(name)}`;
      link.innerHTML =
        `<span>${escapeHtml(name)}</span>` +
        `<span class="chip-count">${counts[name]}</span>`;
      chips.appendChild(link);
    });
  }

  // Recently added PDFs.
  const recent = [...pdfs]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, RECENT_LIMIT);

  const grid = $("recentGrid");
  grid.innerHTML = "";

  if (recent.length === 0) {
    $("emptyState").hidden = false;
    grid.hidden = true;
    $("recentText").textContent = "Nothing added yet.";
    return;
  }

  $("emptyState").hidden = true;
  grid.hidden = false;
  $("recentText").textContent =
    `Your latest ${recent.length} PDF${recent.length === 1 ? "" : "s"}.`;

  recent.forEach(pdf => {
    const card = document.createElement("article");
    card.className = "pdf-card";
    card.innerHTML = pdfCardHtml(pdf, false);
    grid.appendChild(card);
  });
}

$("recentGrid").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const pdf = pdfs.find(item => item.id === button.dataset.id);
  if (!pdf) return;

  button.disabled = true;

  try {
    if (button.dataset.action === "open") await openPdf(pdf);
    if (button.dataset.action === "download") await downloadPdf(pdf);
  } finally {
    button.disabled = false;
  }
});

(async function initializeDashboard() {
  currentUser = await requireSession();
  if (!currentUser) return;

  revealPage();
  showStatus("Loading your library...");

  try {
    pdfs = await fetchPdfs(currentUser.id);
    showStatus("");
    renderDashboard();
  } catch (error) {
    console.error("Load PDFs error:", error);
    showStatus(`Could not load PDFs: ${error.message}`, "error");
  }
})();
