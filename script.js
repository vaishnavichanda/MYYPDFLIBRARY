
const SUPABASE_URL =
  "https://qqohtzjvcmioeariwhnk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_GezO_D3FFGafSO6gg2bUjQ_ASnEoCYk";

const BUCKET = "pdf-library";
const TABLE = "pdf_documents";

const DEFAULT_SUBJECTS = [
  "Java",
  "SQL",
  "HTML & CSS",
  "JavaScript",
  "React",
  "Aptitude",
  "Interview Prep",
  "Resume & Career",
  "Other"
];

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = id => document.getElementById(id);

const libraryMain = $("libraryMain");
const loadingScreen = $("loadingScreen");
const fileInput = $("fileInput");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const sortSelect = $("sortSelect");
const subjectFolders = $("subjectFolders");
const pdfGrid = $("pdfGrid");
const emptyState = $("emptyState");

let currentUser = null;
let pdfs = [];
let subjects = [...DEFAULT_SUBJECTS];
let currentCategory = "All";
let loadingPdfs = false;

// Display a status message.
function showStatus(text, type = "") {
  const status = $("statusMessage");
  status.textContent = text;
  status.className = "status-message";

  if (type) {
    status.classList.add(type);
  }
}

// Format the file size.
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Prevent HTML injection when displaying file names.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Suggest a subject based on the PDF name.
function categoryFor(name) {
  const normalized = name.toLowerCase();

  if (normalized.includes("javascript")) return "JavaScript";
  if (normalized.includes("java")) return "Java";
  if (normalized.includes("sql") || normalized.includes("database")) {
    return "SQL";
  }
  if (normalized.includes("html") || normalized.includes("css")) {
    return "HTML & CSS";
  }
  if (normalized.includes("react")) return "React";
  if (
    normalized.includes("aptitude") ||
    normalized.includes("reasoning")
  ) {
    return "Aptitude";
  }
  if (normalized.includes("interview")) return "Interview Prep";
  if (normalized.includes("resume") || normalized.includes("career")) {
    return "Resume & Career";
  }

  return "Other";
}

// Populate the subject filter.
function syncSubjectOptions() {
  const selected = categoryFilter.value;

  categoryFilter.innerHTML =
    '<option value="All">All subjects</option>';

  subjects.forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value =
    selected === "All" || subjects.includes(selected)
      ? selected
      : "All";
}

// Load only the current user's PDF records.
async function loadPdfs() {
  if (!currentUser) return;

  loadingPdfs = true;
  showStatus("Loading your PDFs...");

  try {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select("id, user_id, name, size, category, storage_path, added_at")
      .eq("user_id", currentUser.id);

    if (error) throw error;

    pdfs = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      size: Number(row.size),
      category: row.category || "Other",
      storage_path: row.storage_path,
      addedAt: row.added_at
        ? new Date(row.added_at).getTime()
        : 0
    }));

    pdfs.forEach(pdf => {
      if (!subjects.includes(pdf.category)) {
        subjects.push(pdf.category);
      }
    });

    syncSubjectOptions();
    renderLibrary();
    showStatus("");
  } catch (error) {
    console.error("Load PDFs error:", error);
    showStatus(
      `Could not load PDFs: ${error.message}`,
      "error"
    );
  } finally {
    loadingPdfs = false;
  }
}

// Update statistics, folders and PDF cards.
function renderLibrary() {
  if (!currentUser) return;

  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  let filtered = pdfs.filter(pdf => {
    const matchesName = pdf.name.toLowerCase().includes(query);
    const matchesCategory =
      selectedCategory === "All" ||
      pdf.category === selectedCategory;

    return matchesName && matchesCategory;
  });

  if (sortSelect.value === "az") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortSelect.value === "size") {
    filtered.sort((a, b) => b.size - a.size);
  } else {
    filtered.sort((a, b) => b.addedAt - a.addedAt);
  }

  $("totalCount").textContent = pdfs.length;
  $("totalSize").textContent = formatSize(
    pdfs.reduce((total, pdf) => total + pdf.size, 0)
  );
  $("categoryCount").textContent =
    new Set(pdfs.map(pdf => pdf.category)).size;

  $("resultText").textContent =
    `${filtered.length} PDF${filtered.length === 1 ? "" : "s"}` +
    (query || selectedCategory !== "All" ? " found" : " in your library");

  subjectFolders.innerHTML = "";
  pdfGrid.innerHTML = "";

  if (selectedCategory === "All") {
    $("sectionTitle").textContent = "Your subject folders";

    subjects.forEach(subject => {
      const count = pdfs.filter(
        pdf => pdf.category === subject
      ).length;

      const folder = document.createElement("button");
      folder.type = "button";
      folder.className = "pdf-card folder-card";

      folder.innerHTML = `
        <div class="card-top">
          <div class="pdf-icon folder-icon">📁</div>
          <div class="file-info">
            <h3>${escapeHtml(subject)}</h3>
            <p>${count} PDF${count === 1 ? "" : "s"}</p>
          </div>
        </div>
        <span class="tag">Open subject</span>
      `;

      folder.addEventListener("click", () => {
        currentCategory = subject;
        categoryFilter.value = subject;
        renderLibrary();
      });

      subjectFolders.appendChild(folder);
    });
  } else {
    $("sectionTitle").textContent = `${selectedCategory} folder`;

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "secondary-btn";
    backButton.textContent = "← All subject folders";
    backButton.style.marginBottom = "16px";

    backButton.addEventListener("click", () => {
      currentCategory = "All";
      categoryFilter.value = "All";
      searchInput.value = "";
      renderLibrary();
    });

    subjectFolders.appendChild(backButton);
  }

  if (filtered.length === 0) {
    emptyState.hidden = false;
    $("pdfGrid").hidden = true;

    if (pdfs.length === 0) {
      emptyState.querySelector("h3").textContent =
        "Your library is ready";
      emptyState.querySelector("p").textContent =
        "Upload your first PDF to start building your personal library.";
    } else {
      emptyState.querySelector("h3").textContent =
        "No matching PDFs";
      emptyState.querySelector("p").textContent =
        "Try a different search or choose another subject.";
    }

    return;
  }

  emptyState.hidden = true;
  pdfGrid.hidden = false;

  filtered.forEach(pdf => {
    const card = document.createElement("article");
    card.className = "pdf-card";

    const dateText = pdf.addedAt
      ? new Date(pdf.addedAt).toLocaleDateString()
      : "Date unavailable";

    card.innerHTML = `
      <div class="card-top">
        <div class="pdf-icon">PDF</div>
        <div class="file-info">
          <h3>${escapeHtml(pdf.name)}</h3>
          <p>${formatSize(pdf.size)} · Added ${escapeHtml(dateText)}</p>
        </div>
      </div>
      <span class="tag">${escapeHtml(pdf.category)}</span>
      <div class="card-actions">
        <button class="open-btn" type="button" data-action="open"
          data-id="${escapeHtml(pdf.id)}">Open PDF ↗</button>
        <button class="delete-btn" type="button" data-action="delete"
          data-id="${escapeHtml(pdf.id)}">Delete</button>
      </div>
    `;

    pdfGrid.appendChild(card);
  });
}

// Upload selected PDFs to private Supabase Storage.
fileInput.addEventListener("change", async () => {
  if (!currentUser) {
    window.location.replace("login.html");
    return;
  }

  const files = Array.from(fileInput.files || []);
  fileInput.value = "";

  for (const file of files) {
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showStatus(`Skipped ${file.name}: only PDF files are allowed.`, "error");
      continue;
    }

    if (file.size === 0) {
      showStatus(`Skipped ${file.name}: the file is empty.`, "error");
      continue;
    }

    const suggestedCategory = categoryFor(file.name);
    const chosen = window.prompt(
      `Choose a subject for "${file.name}".\n\nSubjects:\n${subjects.join(", ")}`,
      suggestedCategory
    );

    if (chosen === null) continue;

    let category = subjects.find(
      subject => subject.toLowerCase() === chosen.trim().toLowerCase()
    );

    if (!category) {
      category = "Other";
    }

    const safeName = file.name.replace(/[\\/]/g, "_");
    const path =
      `${currentUser.id}/${crypto.randomUUID()}-${safeName}`;

    let uploaded = false;

    try {
      showStatus(`Uploading ${file.name}...`);

      const { error: uploadError } = await supabaseClient
        .storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false
        });

      if (uploadError) throw uploadError;
      uploaded = true;

      const { error: insertError } = await supabaseClient
        .from(TABLE)
        .insert({
          user_id: currentUser.id,
          name: file.name,
          size: file.size,
          category,
          storage_path: path
        });

      if (insertError) throw insertError;

      if (!subjects.includes(category)) {
        subjects.push(category);
      }

      showStatus(`${file.name} uploaded successfully.`, "success");
    } catch (error) {
      console.error("Upload error:", error);

      // Remove the Storage file if the database insert failed.
      if (uploaded) {
        const { error: cleanupError } = await supabaseClient
          .storage
          .from(BUCKET)
          .remove([path]);

        if (cleanupError) {
          console.error("Upload cleanup error:", cleanupError);
        }
      }

      showStatus(
        `Could not upload ${file.name}: ${error.message}`,
        "error"
      );
    }
  }

  await loadPdfs();
});

// Open a PDF using a temporary signed URL.
pdfGrid.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const pdf = pdfs.find(item => item.id === button.dataset.id);
  if (!pdf || !currentUser) return;

  if (button.dataset.action === "open") {
    const openedWindow = window.open("", "_blank");

    if (!openedWindow) {
      showStatus(
        "Your browser blocked the PDF window. Allow pop-ups and try again.",
        "error"
      );
      return;
    }

    openedWindow.opener = null;
    openedWindow.document.title = pdf.name;
    openedWindow.document.body.style.margin = "0";
    const viewer = openedWindow.document.createElement("iframe");
    viewer.title = pdf.name;
    viewer.style.width = "100vw";
    viewer.style.height = "100vh";
    viewer.style.border = "0";
    openedWindow.document.body.appendChild(viewer);

    try {
      button.disabled = true;

      const { data, error } = await supabaseClient
        .storage
        .from(BUCKET)
        .createSignedUrl(pdf.storage_path, 60);

      if (error) throw error;

      viewer.src = data.signedUrl;
    } catch (error) {
      openedWindow.close();
      showStatus(`Could not open PDF: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Permanently delete "${pdf.name}" from your cloud library?`
    );

    if (!confirmed) return;

    try {
      button.disabled = true;
      showStatus(`Deleting ${pdf.name}...`);

      const { error: storageError } = await supabaseClient
        .storage
        .from(BUCKET)
        .remove([pdf.storage_path]);

      if (storageError) throw storageError;

      const { error: rowError } = await supabaseClient
        .from(TABLE)
        .delete()
        .eq("id", pdf.id)
        .eq("user_id", currentUser.id);

      if (rowError) {
        showStatus(
          "The file was deleted from Storage, but its database record could not be removed. Check your database policies.",
          "error"
        );
        await loadPdfs();
        return;
      }

      showStatus("PDF deleted successfully.", "success");
      await loadPdfs();
    } catch (error) {
      showStatus(`Could not delete PDF: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  }
});

// Add a subject folder.
$("addSubjectBtn").addEventListener("click", () => {
  const enteredName = window.prompt("Enter the new subject name:");

  if (enteredName === null) return;

  const subject = enteredName.trim();

  if (!subject) {
    showStatus("Enter a subject name.", "error");
    return;
  }

  if (subjects.some(item => item.toLowerCase() === subject.toLowerCase())) {
    showStatus("That subject already exists.", "error");
    return;
  }

  subjects.push(subject);
  syncSubjectOptions();
  categoryFilter.value = subject;
  currentCategory = subject;
  renderLibrary();
  showStatus("Subject added for this browser session.", "success");
});

// Search, filter and sort.
searchInput.addEventListener("input", renderLibrary);

categoryFilter.addEventListener("change", () => {
  currentCategory = categoryFilter.value;
  renderLibrary();
});

sortSelect.addEventListener("change", renderLibrary);

// Sign out.
$("signOutBtn").addEventListener("click", async () => {
  $("signOutBtn").disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    window.location.replace("login.html");
  } catch (error) {
    showStatus(`Could not sign out: ${error.message}`, "error");
    $("signOutBtn").disabled = false;
  }
});

// Protect the library page.
async function initializeLibrary() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      window.location.replace("login.html");
      return;
    }

    currentUser = data.session.user;
    loadingScreen.hidden = true;
    libraryMain.hidden = false;

    await loadPdfs();

    // Handle expiration or sign-out in another tab.
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("login.html");
      }
    });
  } catch (error) {
    console.error("Initialization error:", error);
    loadingScreen.textContent =
      `Could not initialize your library: ${error.message}`;
  }
}

initializeLibrary();
