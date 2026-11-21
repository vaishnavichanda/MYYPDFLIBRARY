// Subjects: upload, search, organize, open, download, rename, move and delete PDFs.

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

// Load the current user's PDFs and refresh the page.
async function loadPdfs() {
  if (!currentUser) return;

  try {
    pdfs = await fetchPdfs(currentUser.id);
    subjects = buildSubjectList(currentUser.id, pdfs);
    syncSubjectOptions();
    renderLibrary();
  } catch (error) {
    console.error("Load PDFs error:", error);
    showStatus(`Could not load PDFs: ${error.message}`, "error");
  }
}

// Update subject folders and PDF cards.
function renderLibrary() {
  if (!currentUser) return;

  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filtered = pdfs.filter(pdf => {
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
        categoryFilter.value = subject;
        renderLibrary();
      });

      subjectFolders.appendChild(folder);
    });
  } else {
    $("sectionTitle").textContent = `${selectedCategory} folder`;

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "secondary-btn back-btn";
    backButton.textContent = "← All subject folders";

    backButton.addEventListener("click", () => {
      categoryFilter.value = "All";
      searchInput.value = "";
      renderLibrary();
    });

    subjectFolders.appendChild(backButton);
  }

  if (filtered.length === 0) {
    emptyState.hidden = false;
    pdfGrid.hidden = true;

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
    card.innerHTML = pdfCardHtml(pdf, true);
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

    const category =
      subjects.find(
        subject => subject.toLowerCase() === chosen.trim().toLowerCase()
      ) || "Other";

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

// Open, download, rename, move and delete buttons on the PDF cards.
pdfGrid.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const pdf = pdfs.find(item => item.id === button.dataset.id);
  if (!pdf || !currentUser) return;

  const action = button.dataset.action;

  if (action === "open") {
    button.disabled = true;
    await openPdf(pdf);
    button.disabled = false;
    return;
  }

  if (action === "download") {
    button.disabled = true;
    await downloadPdf(pdf);
    button.disabled = false;
    return;
  }

  // Rename only changes the display name in the database.
  // The Storage file and its path are never touched.
  if (action === "rename") {
    const entered = window.prompt("Enter the new PDF name:", pdf.name);
    if (entered === null) return;

    let newName = entered.trim().replace(/[\\/]/g, "_");

    if (!newName) {
      showStatus("Enter a PDF name.", "error");
      return;
    }
    if (!newName.toLowerCase().endsWith(".pdf")) {
      newName += ".pdf";
    }
    if (newName === pdf.name) return;

    try {
      button.disabled = true;
      showStatus(`Renaming ${pdf.name}...`);

      const { error } = await supabaseClient
        .from(TABLE)
        .update({ name: newName })
        .eq("id", pdf.id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      showStatus("PDF renamed.", "success");
      await loadPdfs();
    } catch (error) {
      showStatus(`Could not rename PDF: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
    return;
  }

  // Move changes the subject (category) of the PDF record.
  if (action === "move") {
    const chosen = window.prompt(
      `Move "${pdf.name}" to which subject?\n\nSubjects:\n${subjects.join(", ")}`,
      pdf.category
    );
    if (chosen === null) return;

    const target = subjects.find(
      subject => subject.toLowerCase() === chosen.trim().toLowerCase()
    );

    if (!target) {
      showStatus(
        "That subject does not exist. Use + Add Subject first.",
        "error"
      );
      return;
    }
    if (target === pdf.category) return;

    try {
      button.disabled = true;
      showStatus(`Moving ${pdf.name} to ${target}...`);

      const { error } = await supabaseClient
        .from(TABLE)
        .update({ category: target })
        .eq("id", pdf.id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      showStatus(`Moved to ${target}.`, "success");
      await loadPdfs();
    } catch (error) {
      showStatus(`Could not move PDF: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (action === "delete") {
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

// Add a subject folder (remembered in this browser).
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

  saveCustomSubject(currentUser.id, subject);
  subjects = buildSubjectList(currentUser.id, pdfs);
  syncSubjectOptions();
  categoryFilter.value = subject;
  renderLibrary();
  showStatus("Subject added.", "success");
});

// Search, filter and sort.
searchInput.addEventListener("input", renderLibrary);
categoryFilter.addEventListener("change", renderLibrary);
sortSelect.addEventListener("change", renderLibrary);

(async function initializeSubjects() {
  currentUser = await requireSession();
  if (!currentUser) return;

  revealPage();
  showStatus("Loading your PDFs...");

  await loadPdfs();
  showStatus("");

  // Dashboard links open a subject with ?subject=Name.
  const wanted = new URLSearchParams(window.location.search).get("subject");

  if (wanted) {
    const match = subjects.find(
      subject => subject.toLowerCase() === wanted.toLowerCase()
    );

    if (match) {
      categoryFilter.value = match;
      renderLibrary();
    }
  }
})();
