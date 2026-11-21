// Shared code used by every page after login:
// Supabase client, sign-in check, helpers and PDF actions.

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

// Display a status message.
function showStatus(text, type = "", elementId = "statusMessage") {
  const status = $(elementId);
  if (!status) return;

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
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

// Make sure the person is signed in. Returns the user, or null after
// sending the person to the login page.
async function requireSession() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      window.location.replace("login.html");
      return null;
    }

    // Handle expiration or sign-out in another tab.
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("login.html");
      }
    });

    return data.session.user;
  } catch (error) {
    console.error("Initialization error:", error);

    const loading = $("loadingScreen");
    if (loading) {
      loading.textContent =
        `Could not check your sign-in: ${error.message}`;
    }

    return null;
  }
}

// Show the page content once the person is confirmed as signed in.
function revealPage() {
  const loading = $("loadingScreen");
  const main = $("pageMain");

  if (loading) loading.hidden = true;
  if (main) main.hidden = false;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;

  window.location.replace("login.html");
}

// ---------- Subjects ----------
// Subjects you add yourself are remembered in this browser.

function subjectStorageKey(userId) {
  return `mypdflibrary.subjects.${userId}`;
}

function loadCustomSubjects(userId) {
  try {
    const raw = localStorage.getItem(subjectStorageKey(userId));
    const list = raw ? JSON.parse(raw) : [];

    return Array.isArray(list)
      ? list.filter(item => typeof item === "string")
      : [];
  } catch (error) {
    return [];
  }
}

function saveCustomSubject(userId, subject) {
  const list = loadCustomSubjects(userId);

  if (!list.includes(subject)) {
    list.push(subject);

    try {
      localStorage.setItem(
        subjectStorageKey(userId),
        JSON.stringify(list)
      );
    } catch (error) {
      console.error("Could not remember the subject:", error);
    }
  }
}

// Default subjects + subjects you added + subjects already used by PDFs.
function buildSubjectList(userId, pdfs) {
  const subjects = [...DEFAULT_SUBJECTS];
  const extras = [
    ...loadCustomSubjects(userId),
    ...pdfs.map(pdf => pdf.category)
  ];

  extras.forEach(subject => {
    const exists = subjects.some(
      item => item.toLowerCase() === subject.toLowerCase()
    );

    if (!exists) subjects.push(subject);
  });

  return subjects;
}

// ---------- PDFs ----------

// Load only the current user's PDF records.
async function fetchPdfs(userId) {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("id, user_id, name, size, category, storage_path, added_at")
    .eq("user_id", userId);

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    size: Number(row.size),
    category: row.category || "Other",
    storage_path: row.storage_path,
    addedAt: row.added_at ? new Date(row.added_at).getTime() : 0
  }));
}

// HTML for one PDF card. "full" adds Rename, Move and Delete.
function pdfCardHtml(pdf, full = false) {
  const dateText = pdf.addedAt
    ? new Date(pdf.addedAt).toLocaleDateString()
    : "Date unavailable";

  const id = escapeHtml(pdf.id);

  const extraActions = full
    ? `
      <div class="card-actions">
        <button class="delete-btn" type="button" data-action="rename"
          data-id="${id}">Rename</button>
        <button class="delete-btn" type="button" data-action="move"
          data-id="${id}">Move</button>
        <button class="delete-btn" type="button" data-action="delete"
          data-id="${id}">Delete</button>
      </div>`
    : "";

  return `
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
        data-id="${id}">Open PDF ↗</button>
      <button class="download-btn" type="button" data-action="download"
        data-id="${id}">Download</button>
    </div>
    ${extraActions}
  `;
}

// Open a PDF using a temporary signed URL.
async function openPdf(pdf) {
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
    const { data, error } = await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrl(pdf.storage_path, 60);

    if (error) throw error;

    viewer.src = data.signedUrl;
  } catch (error) {
    openedWindow.close();
    showStatus(`Could not open PDF: ${error.message}`, "error");
  }
}

// Download a PDF using a temporary signed URL.
async function downloadPdf(pdf) {
  try {
    const { data, error } = await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrl(pdf.storage_path, 60, { download: pdf.name });

    if (error) throw error;

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    showStatus(`Could not download PDF: ${error.message}`, "error");
  }
}
