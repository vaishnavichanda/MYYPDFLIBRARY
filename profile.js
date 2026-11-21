// Profile: account details and storage details.

// Free storage shown on the bar (the 1 GB free plan from FutureUpdate.txt).
const FREE_STORAGE_BYTES = 1024 * 1024 * 1024;

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function renderAccount(user) {
  const email = user.email || "Unknown email";

  $("avatar").textContent = email.charAt(0).toUpperCase();
  $("profileEmail").textContent = email;
  $("memberSince").textContent = `Member since ${formatDate(user.created_at)}`;

  $("detailEmail").textContent = email;
  $("detailCreated").textContent = formatDate(user.created_at);
  $("detailLastSignIn").textContent = formatDate(user.last_sign_in_at);
}

function renderStorage(pdfs) {
  const totalBytes = pdfs.reduce((total, pdf) => total + pdf.size, 0);
  const percent = Math.min(100, (totalBytes / FREE_STORAGE_BYTES) * 100);

  $("totalCount").textContent = pdfs.length;
  $("totalSize").textContent = formatSize(totalBytes);

  const largest = pdfs.reduce(
    (best, pdf) => (pdf.size > best ? pdf.size : best),
    0
  );
  $("largestFile").textContent = largest ? formatSize(largest) : "—";

  $("storageSummary").textContent =
    `${formatSize(totalBytes)} used of ${formatSize(FREE_STORAGE_BYTES)} free storage.`;

  const fill = $("storageFill");
  fill.style.width = `${percent}%`;
  fill.classList.toggle("full", totalBytes > FREE_STORAGE_BYTES);
  $("storageBar").setAttribute("aria-valuenow", String(Math.round(percent)));

  $("storageText").textContent =
    totalBytes > FREE_STORAGE_BYTES
      ? `You are ${formatSize(totalBytes - FREE_STORAGE_BYTES)} over the free storage.`
      : `${formatSize(FREE_STORAGE_BYTES - totalBytes)} free storage left (${percent.toFixed(1)}% used).`;

  // Storage by subject.
  const bySubject = {};

  pdfs.forEach(pdf => {
    const entry = bySubject[pdf.category] || { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += pdf.size;
    bySubject[pdf.category] = entry;
  });

  const rows = Object.entries(bySubject).sort(
    (a, b) => b[1].bytes - a[1].bytes
  );

  const breakdown = $("subjectBreakdown");
  breakdown.innerHTML = "";

  if (rows.length === 0) {
    breakdown.innerHTML =
      '<p class="breakdown-empty">No PDFs uploaded yet.</p>';
    return;
  }

  rows.forEach(([subject, entry]) => {
    const share = totalBytes ? (entry.bytes / totalBytes) * 100 : 0;
    const row = document.createElement("div");
    row.className = "breakdown-row";

    row.innerHTML = `
      <div class="breakdown-head">
        <span>${escapeHtml(subject)}</span>
        <span>${entry.count} PDF${entry.count === 1 ? "" : "s"} · ${formatSize(entry.bytes)}</span>
      </div>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width: ${share.toFixed(1)}%"></div>
      </div>
    `;

    breakdown.appendChild(row);
  });
}

(async function initializeProfile() {
  const user = await requireSession();
  if (!user) return;

  revealPage();
  renderAccount(user);
  showStatus("Loading storage details...");

  try {
    const pdfs = await fetchPdfs(user.id);
    showStatus("");
    renderStorage(pdfs);
  } catch (error) {
    console.error("Load storage details error:", error);
    $("storageSummary").textContent = "";
    showStatus(`Could not load storage details: ${error.message}`, "error");
  }
})();
