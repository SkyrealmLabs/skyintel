/**
 * index.js - View Files & Acknowledgement Logic
 */

let userData = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load User Data
    userData = JSON.parse(localStorage.getItem("user"));

    // 2. Setup UI
    setupSidenav();

    // 3. Initialize Page Logic
    initFilePage();

    // 4. Setup Modal Logic
    setupPdfModal();
});

// --- CORE LOGIC: LOAD FILES ---

async function initFilePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const encryptedId = urlParams.get('library_id');
    const folderType = urlParams.get('folder_type'); // 'Main' atau 'Archieve'

    // Set Tajuk Halaman
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = folderType || 'Files';

    if (!encryptedId || !folderType) {
        console.error("Missing library_id or folder_type params");
        return;
    }

    // Dekripsi ID
    const libraryId = await handleIdDecryption(encryptedId);
    if (!libraryId) return;

    // Panggil API
    loadFiles(libraryId, folderType);
}

async function loadFiles(libraryId, folderType) {
    try {
        const userId = userData ? userData.id : 0;

        // Fetch files dari API
        const response = await fetch(`/api/library/files?library_id=${libraryId}&folder_type=${folderType}&user_id=${userId}`);
        const files = await response.json();

        const container = document.getElementById('filesContainer');
        container.innerHTML = ''; // Clear container

        if (files.length === 0) {
            container.innerHTML = `<div class="col-12 text-center mt-5"><p class="text-muted">No files found in ${folderType}.</p></div>`;
            return;
        }

        files.forEach(file => {
            // Format Tarikh
            const dateObj = new Date(file.updated_at);
            const displayDate = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY

            // Bersihkan path file (jika server guna Windows backslash)
            // Pastikan server anda serve static folder 'uploads'
            const cleanPath = file.file_path.replace(/\\/g, '/');
            const fileUrl = `/${cleanPath}`;

            // Check acknowledgement status untuk badge
            const isAck = file.is_acknowledged === 1;
            const badgeHtml = isAck ? '<span class="badge bg-gradient-success mt-2">Acknowledged</span>' : '';

            // Generate HTML Card
            const cardHtml = `
                <div class="col-xl-3 col-lg-3 col-md-4 col-sm-6 mb-4">
                    <div class="card pdf-card h-100 text-center position-relative" 
                        id="file-card-${file.id}" 
                        style="overflow: visible;">
                        
                        <div class="dropdown position-absolute top-0 end-0 mt-2 me-2" style="z-index: 10;">
                            <button class="btn btn-link text-secondary p-0 m-0" 
                                    type="button" 
                                    id="dropdownMenu${file.id}" 
                                    data-bs-toggle="dropdown" 
                                    aria-expanded="false">
                                <i class="material-icons">more_vert</i>
                            </button>
                            
                            <ul class="dropdown-menu dropdown-menu-end" 
                                aria-labelledby="dropdownMenu${file.id}" 
                                style="z-index: 9999;">
                                <li>
                                    <a class="dropdown-item text-danger" 
                                    href="javascript:void(0)" 
                                    onclick="deleteFile(${file.id})">
                                    <i class="material-icons text-sm me-2">delete</i> Delete
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div class="card-body d-flex flex-column align-items-center justify-content-center pt-4 clickable-card"
                            style="cursor: pointer;"
                            data-bs-toggle="modal"
                            data-bs-target="#pdfViewerModal"
                            data-pdf="${fileUrl}"
                            data-filename="${file.file_name}"
                            data-fileid="${file.id}"
                            data-acknowledged="${file.is_acknowledged}">
                            
                            <i class="material-icons text-danger mb-2" style="font-size:48px;">picture_as_pdf</i>
                            <h6 class="font-weight-bold text-truncate w-100 mb-1" title="${file.file_name}">${file.file_name}</h6>
                            <p class="text-muted text-xs mb-0">${file.author || 'System'}</p>
                            <p class="text-xs text-muted mb-0">Modified: ${displayDate}</p>
                            <p class="text-xs text-muted mb-0">v${file.version}</p>
                            <div id="badge-container-${file.id}">
                                ${badgeHtml}
                            </div>
                        </div>
                        
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });

    } catch (error) {
        console.error("Error loading files:", error);
    }
}

// --- MODAL & ACKNOWLEDGEMENT LOGIC ---

function setupPdfModal() {
    const pdfModal = document.getElementById('pdfViewerModal');
    const pdfIframe = document.getElementById('pdfIframe');
    const modalTitle = document.getElementById('pdfViewerModalLabel');
    const ackCheckbox = document.getElementById('acknowledgeCheckbox');
    const ackButton = document.getElementById('btnAcknowledge');

    let currentFileId = null;

    if (!pdfModal) return;

    // 1. EVENT: Modal Dibuka
    pdfModal.addEventListener('show.bs.modal', (event) => {
        const button = event.relatedTarget; // Element kad yang diklik

        // Ambil data dari attribute
        let rawPath = button.getAttribute('data-pdf');
        const fileName = button.getAttribute('data-filename');
        const isAck = button.getAttribute('data-acknowledged') === '1';
        currentFileId = button.getAttribute('data-fileid');

        rawPath = rawPath.replace(/\\/g, '/');

        let relativePath = rawPath;
        if (rawPath.includes('/uploads/')) {
            relativePath = rawPath.split('/uploads/')[1];
        }

        const finalUrl = `https://skyintel.zulsyah.com/uploads/${relativePath}`;

        // Update Content
        modalTitle.textContent = fileName;
        pdfIframe.src = finalUrl;

        // Reset Button State
        // Kita guna cloneNode untuk buang event listener lama supaya tak double click
        const newAckButton = ackButton.cloneNode(true);
        ackButton.parentNode.replaceChild(newAckButton, ackButton);
        const activeAckButton = document.getElementById('btnAcknowledge');

        if (isAck) {
            // UI: Sudah Acknowledge
            setButtonState(activeAckButton, ackCheckbox, true);
        } else {
            // UI: Belum Acknowledge
            setButtonState(activeAckButton, ackCheckbox, false);

            // Tambah event listener untuk POST ke API
            activeAckButton.addEventListener('click', async () => {
                if (!ackCheckbox.checked) {
                    alert("Please tick the checkbox to confirm.");
                    return;
                }
                await processAcknowledgement(currentFileId, activeAckButton, ackCheckbox);
            });
        }
    });

    // 2. EVENT: Modal Ditutup
    pdfModal.addEventListener('hidden.bs.modal', () => {
        pdfIframe.src = ''; // Clear src jimat memory
        currentFileId = null;
    });
}

// Fungsi Proses API Acknowledge
async function processAcknowledgement(fileId, btn, checkbox) {
    if (!userData || !userData.id) {
        alert("Session invalid. Please login.");
        return;
    }

    const originalText = btn.textContent;
    btn.textContent = "Processing...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/files/acknowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userData.id,
                file_id: fileId
            })
        });

        if (response.ok) {
            // Success: Update Modal UI
            setButtonState(btn, checkbox, true);

            // Success: Update Card UI (Background)
            updateCardBadge(fileId);

            // Update attribute data pada card (penting jika user buka balik modal tanpa refresh)
            const card = document.querySelector(`.clickable-card[data-fileid="${fileId}"]`);
            if (card) card.setAttribute('data-acknowledged', '1');

        } else {
            const res = await response.json();
            alert("Error: " + res.message);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        console.error("Ack Error:", error);
        alert("Server error.");
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Function Delete File API
async function deleteFile(fileId) {
    
    const confirmAction = confirm("Are you sure you want to delete this file?");
    if (!confirmAction) return;

    try {
        // 2. Panggil API Delete
        const response = await fetch('/api/library/files/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file_id: fileId })
        });

        const result = await response.json();

        if (response.ok) {
            
            const cardElement = document.getElementById(`file-card-${fileId}`);
            
            if (cardElement) {
                const columnElement = cardElement.closest('.col-xl-3'); 
                if (columnElement) {
                    columnElement.remove();
                } else {
                    cardElement.remove();
                }
            }
            
            // Optional: Tunjuk alert kecil atau toast
            alert("File deleted successfully."); 
            
            // Cek jika container kosong selepas delete
            const container = document.getElementById('filesContainer');
            if (container && container.children.length === 0) {
                container.innerHTML = `<div class="col-12 text-center mt-5"><p class="text-muted">No files found.</p></div>`;
            }

        } else {
            // 4. Jika gagal (contoh: server error)
            alert("Failed to delete: " + (result.message || "Unknown error"));
        }

    } catch (error) {
        console.error("Delete Error:", error);
        alert("System error. Please try again later.");
    }
}

// Helper: Tukar rupa bentuk button
function setButtonState(btn, checkbox, isAcknowledged) {
    if (isAcknowledged) {
        btn.textContent = "Acknowledged";
        btn.className = "btn btn-success"; // Hijau
        btn.disabled = true;
        checkbox.checked = true;
        checkbox.disabled = true;
    } else {
        btn.textContent = "Acknowledge";
        btn.className = "btn btn-info"; // Biru
        btn.disabled = false;
        checkbox.checked = false;
        checkbox.disabled = false;
    }
}

// Helper: Tambah badge pada kad di belakang modal
function updateCardBadge(fileId) {
    const badgeContainer = document.getElementById(`badge-container-${fileId}`);
    if (badgeContainer) {
        badgeContainer.innerHTML = '<span class="badge bg-gradient-success mt-2">Acknowledged</span>';
    }
}

// --- UTILITIES ---

async function handleIdDecryption(encryptedId) {
    try {
        if (typeof decryptionID === 'function') {
            return await decryptionID(encryptedId);
        }
        return null;
    } catch (err) {
        console.error("Decryption failed", err);
        return null;
    }
}

function setupSidenav() {
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    if (openSideNav) openSideNav.addEventListener("click", () => document.getElementById("right-sidenav").style.width = "400px");
    if (closeSideNav) closeSideNav.addEventListener("click", () => document.getElementById("right-sidenav").style.width = "0");

    // Dropdown Logic (Existing)
    const droneListTarget = document.querySelector('#droneDropdown');
    const adminListTarget = document.querySelector('#adminDropdown');

    if (droneListTarget) {
        droneListTarget.addEventListener('show.bs.collapse', () => {
            document.getElementById('droneDropdownIcon')?.classList.add('rotate-180');
        });
        droneListTarget.addEventListener('hide.bs.collapse', () => {
            document.getElementById('droneDropdownIcon')?.classList.remove('rotate-180');
        });
    }

    if (adminListTarget) {
        adminListTarget.addEventListener('show.bs.collapse', () => {
            document.getElementById('adminDropdownIcon')?.classList.add('rotate-180');
        });
        adminListTarget.addEventListener('hide.bs.collapse', () => {
            document.getElementById('adminDropdownIcon')?.classList.remove('rotate-180');
        });
    }
}