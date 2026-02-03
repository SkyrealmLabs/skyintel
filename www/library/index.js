/**
 * index.js - Full Updated Code
 */

const dropbox = document.getElementById('dropbox');
const fileInput = document.getElementById('fileInput');
const filePreviews = document.getElementById('filePreviews');
const notification = document.getElementById('notification');
const browseBtn = document.querySelector('.browse-btn');
const uploadStats = document.getElementById('uploadStats');
const fileCountEl = document.getElementById('fileCount');
const totalSizeEl = document.getElementById('totalSize');
const progressFill = document.getElementById('progressFill');
const emptyState = document.getElementById('emptyState');
const closeUploadModal = document.getElementById('closeUploadModal');
const progressBar = document.getElementById('progress-bar');

let fileCount = 0;
let totalSize = 0;
let currentReportData = [];
let currentReportTitle = "Report";

// --- INTEGRASI API: MENGAMBIL DATA SUMMARY ---
async function loadLibrarySummary() {
    try {
        // 1. Dapatkan info user semasa dari LocalStorage
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const currentUserId = userData.id;
        const currentUserRole = userData.role; // 1: Admin, 2: SuperAdmin, 4: Member

        // 2. Pass user_id ke API
        const response = await fetch(`/api/library/summary?user_id=${currentUserId}`);
        const data = await response.json();

        const tableBody = document.querySelector('table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = ''; 

        for (const item of data) {
            const displayDate = item.last_update ? item.last_update.split(' ')[0] : '-';
            const row = document.createElement('tr');
            row.className = 'clickable-row';

            const encrypted = await encryptionID(item.library_id);
            row.dataset.href = `./folder?id=${encodeURIComponent(encrypted)}&name=${encodeURIComponent(item.document_name)}`;

            // --- LOGIC UI STATUS ---
            let statusColumnContent = '';

            if (currentUserRole === 4) { 
                // === VIEW UNTUK MEMBER (Status Diri Sendiri) ===
                if (item.user_ack_status === 1) {
                    statusColumnContent = `
                        <span class="badge badge-sm bg-gradient-success">Acknowledged</span>
                    `;
                } else {
                    statusColumnContent = `
                        <span class="badge badge-sm bg-gradient-warning">Pending</span>
                    `;
                }
            } else {
                // === VIEW UNTUK ADMIN/SUPERADMIN (Progress Bar Keseluruhan) ===
                statusColumnContent = `
                    <div class="d-flex align-items-center justify-content-center">
                        <div class="progress-wrapper d-flex align-items-center gap-2">
                            <div class="progress" style="height: 6px; width: 100px;">
                                <div class="progress-bar bg-gradient-info" role="progressbar" 
                                    aria-valuenow="${item.ack_percentage}" aria-valuemin="0" aria-valuemax="100" 
                                    style="width: ${item.ack_percentage}%; height: 6px;"></div>
                            </div>
                            <div class="progress-info">
                                <span class="text-sm font-weight-bold">${item.ack_percentage}%</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Masukkan content ke dalam row HTML
            row.innerHTML = `
                <td>
                    <div class="d-flex px-2 py-1">
                        <div>
                            <img src="../assets/img/folder.png" class="avatar-sm me-3" alt="folder">
                        </div>
                        <div class="d-flex flex-column justify-content-center">
                            <h6 class="mb-0 font-weight-bold">${item.document_name}</h6>
                        </div>
                    </div>
                </td>
                <td><p class="font-weight-normal mb-0">${item.last_version || '-'}</p></td>
                <td><p class="font-weight-normal mb-0">${item.author || 'System'}</p></td>
                <td class="align-middle text-center"><p class="mb-0 font-weight-normal">${displayDate}</p></td>
                
                <td class="align-middle text-center">
                    ${statusColumnContent}
                </td>

                <td class="align-middle text-center">
                    <div class="dropdown">
                        <button class="btn btn-link text-secondary mb-0" 
                                type="button" 
                                id="dropdownMenuButton-${item.library_id}" 
                                data-bs-toggle="dropdown" 
                                aria-expanded="false"
                                onclick="event.stopPropagation()"> <i class="material-icons text-lg">more_vert</i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end px-2 py-3" aria-labelledby="dropdownMenuButton-${item.library_id}">
                            <li>
                                <a class="dropdown-item border-radius-md" href="javascript:;" 
                                onclick="viewReport(${item.library_id}, event)">
                                    <i class="material-icons text-sm me-2">assessment</i> View Report
                                </a>
                            </li>
                            ${currentUserRole !== 4 ? `
                            <li>
                                <a class="dropdown-item border-radius-md" href="javascript:;" 
                                onclick="editLibrary(${item.library_id}, '${item.document_name}', event)">
                                    <i class="material-icons text-sm me-2">edit</i> Edit
                                </a>
                            </li>
                            <li>
                                <hr class="dropdown-divider">
                            </li>
                            <li>
                                <a class="dropdown-item border-radius-md text-danger" href="javascript:;" 
                                onclick="deleteLibrary(${item.library_id}, event)">
                                    <i class="material-icons text-sm me-2">delete</i> Delete
                                </a>
                            </li>
                            ` : ''}
                        </ul>
                    </div>
                </td>
            `;

            row.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    const href = row.dataset.href;
                    if (href) window.location.href = href;
                }
            });

            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error("Error loading library summary:", error);
    }
}

// --- LOGIK ASAL ANDA (MAINTAINED) ---

updateDisplay();

dropbox.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropbox.classList.add('dragover');
});

dropbox.addEventListener('dragleave', () => {
    dropbox.classList.remove('dragover');
});

dropbox.addEventListener('drop', (e) => {
    e.preventDefault();
    dropbox.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    handleFiles(files);
});

dropbox.addEventListener('click', () => {
    fileInput.click();
});

browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

function handleFiles(files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (files.length > 0) {
        let validFiles = 0;
        let invalidFiles = 0;

        Array.from(files).forEach(file => {
            if (!allowedTypes.includes(file.type)) {
                showNotification(`${file.name} is not a valid file type.`, 'error');
                invalidFiles++;
                return;
            }

            if (file.size > maxSize) {
                showNotification(`${file.name} is too large. Maximum file size is 5 MB.`, 'error');
                invalidFiles++;
                return;
            }

            displayFilePreview(file);
            validFiles++;
        });

        if (validFiles > 0) {
            simulateUpload(validFiles);
            showNotification(`${validFiles} file${validFiles !== 1 ? 's' : ''} added successfully.`, 'success');
        }
    }
}

function displayFilePreview(file) {
    removeAllPreviews();
    progressBar.style.display = 'block';
    const reader = new FileReader();
    const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    reader.onload = function (event) {
        const preview = document.createElement('div');
        preview.classList.add('file-preview');
        preview.id = fileId;
        const isImage = file.type.startsWith('image/');

        preview.innerHTML = `
            <div class="preview-img-container">
                ${isImage ? `<img src="${event.target.result}" class="preview-img">` : `<div class="file-icon">📄</div>`}
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
                <div class="file-actions">
                <button class="remove-btn">Remove</button>
                </div>
            </div>
        `;

        preview.querySelector('.remove-btn').addEventListener('click', () => {
            removeFile(fileId, file.size);
        });

        filePreviews.appendChild(preview);
        fileCount++;
        totalSize += file.size;
        updateDisplay();
    };
    reader.readAsDataURL(file);
}

function removeFile(fileId, size) {
    const fileElement = document.getElementById(fileId);
    if (fileElement) {
        fileElement.remove();
        fileCount--;
        totalSize -= size;
        updateDisplay();
    }
    if (fileCount === 0) {
        uploadStats.style.display = 'none';
        progressBar.style.display = 'none';
    }
    resetFileInput();
}

function removeAllPreviews() {
    filePreviews.innerHTML = '';
    fileCount = 0;
    totalSize = 0;
    updateDisplay();
    uploadStats.style.display = 'none';
    progressBar.style.display = 'none';
}

function updateDisplay() {
    fileCountEl.textContent = fileCount;
    totalSizeEl.textContent = formatFileSize(totalSize);
    emptyState.style.display = fileCount > 0 ? 'none' : 'block';
    if (fileCount > 0) uploadStats.style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'success') {
    const notificationContainer = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    if (!notificationText) return;

    notificationText.textContent = message;
    notificationContainer.className = `notification show ${type}`;

    setTimeout(() => {
        notificationContainer.classList.remove('show');
    }, 3000);
}

function simulateUpload(fileCount) {
    progressFill.style.width = '0%';
    setTimeout(() => { progressFill.style.width = '100%'; }, 500);
}

function resetFileInput() {
    fileInput.value = '';
}

// Function untuk BUKA Modal Edit
function editLibrary(libraryId, currentName, event) {
    // 1. Halang event bubbling (Wajib ada)
    if (event) {
        event.stopPropagation();
        event.preventDefault();

        // --- KOD TAMBAHAN: TUTUP DROPDOWN SECARA MANUAL ---
        // Cari menu dropdown yang sedang terbuka (element <ul> parent kepada butang Edit)
        const dropdownMenu = event.target.closest('.dropdown-menu');

        if (dropdownMenu) {
            // Buang class 'show' dari menu
            dropdownMenu.classList.remove('show');

            // Cari butang toggle (icon 3 titik) dan reset statusnya juga
            // (Biasanya ia adalah sibling sebelum <ul>, atau dalam wrapper .dropdown)
            const dropdownToggle = dropdownMenu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
            if (dropdownToggle) {
                dropdownToggle.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        }
        // --- TAMAT KOD TAMBAHAN ---
    }

    // 2. Dapatkan elemen modal dan input
    const inputEl = document.getElementById('editFolderNameInput');
    const saveBtn = document.getElementById('saveEditFolderBtn');
    const modalEl = document.getElementById('editFolderModal');

    // 3. Masukkan nama asal ke dalam input field
    if (inputEl) {
        inputEl.value = currentName;
        // UI Fix: Pastikan label input "naik" ke atas
        inputEl.parentElement.classList.add('is-focused');
    }

    // 4. Simpan ID library pada butang Save
    if (saveBtn) {
        saveBtn.dataset.libraryId = libraryId;
    }

    // 5. Buka Modal
    if (modalEl) {
        const myModal = new bootstrap.Modal(modalEl);
        myModal.show();
    }
}

async function deleteLibrary(libraryId, event) {
    // 1. Halang event bubbling & Tutup Dropdown (PENTING)
    if (event) {
        event.stopPropagation();
        event.preventDefault();

        // Manual close dropdown
        const dropdownMenu = event.target.closest('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
            const dropdownToggle = dropdownMenu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
            if (dropdownToggle) {
                dropdownToggle.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // 2. Confirmation Dialog
    const confirmDelete = confirm("Are you sure you want to delete this folder? All files inside will be hidden.");
    if (!confirmDelete) return;

    try {
        // 3. Panggil API Delete
        const response = await fetch('/api/library/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ library_id: libraryId })
        });

        const result = await response.json();

        if (response.ok) {
            // 4. Notification & Refresh Table
            if (typeof showNotification === "function") {
                showNotification("Folder deleted successfully", "success");
            } else {
                alert("Folder deleted successfully");
            }

            // Reload table untuk hilangkan folder yang dah delete
            loadLibrarySummary();

        } else {
            alert("Failed to delete: " + (result.message || "Unknown error"));
        }

    } catch (error) {
        console.error("Delete Error:", error);
        alert("System error while deleting folder.");
    }
}

async function viewReport(libraryId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
        // ... (kod tutup dropdown sedia ada kekal sama) ...
        const dropdownMenu = event.target.closest('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
            const toggle = dropdownMenu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
            if (toggle) toggle.classList.remove('show');
        }
    }

    try {
        const response = await fetch(`/api/library/report/${libraryId}`);
        const result = await response.json();

        const tableBody = document.getElementById('reportTableBody');
        const noFileMsg = document.getElementById('noFileMessage');
        const modalEl = document.getElementById('reportModal');
        const downloadBtn = document.getElementById('downloadReportBtn'); // Ambil butang download

        tableBody.innerHTML = '';

        if (!result.hasFile) {
            tableBody.style.display = 'none';
            noFileMsg.style.display = 'block';
            downloadBtn.disabled = true; // Disable button jika tiada data
            currentReportData = []; // Kosongkan data
        } else {
            tableBody.style.display = 'table-row-group';
            noFileMsg.style.display = 'none';
            downloadBtn.disabled = false; // Enable button

            // SIMPAN DATA KE VARIABLE GLOBAL (PENTING!)
            currentReportData = result.data;

            // Kita boleh set nama report (pilihan tambahan jika anda nak pass nama folder)
            currentReportTitle = `Acknowledgement Report (Ref ID: ${libraryId})`;

            result.data.forEach(user => {
                // ... (kod generate table row HTML kekal sama macam sebelum ni) ...
                // Copy paste logic table row anda di sini

                // Contoh ringkas logic table row:
                let statusBadge = user.status === 1
                    ? `<span class="badge badge-sm bg-gradient-success">Acknowledged</span>`
                    : `<span class="badge badge-sm bg-gradient-secondary">Pending</span>`;

                let dateDisplay = '-';
                if (user.status === 1 && user.ack_date) {
                    const dateObj = new Date(user.ack_date);
                    dateDisplay = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><h6 class="mb-0 text-sm px-2">${user.user_name}</h6></td>
                    <td><p class="text-xs font-weight-bold mb-0">${user.role_name}</p></td>
                    <td class="align-middle text-center text-sm">${statusBadge}</td>
                    <td class="align-middle text-center"><span class="text-secondary text-xs font-weight-bold">${dateDisplay}</span></td>
                `;
                tableBody.appendChild(tr);
            });
        }

        const reportModal = new bootstrap.Modal(modalEl);
        reportModal.show();

    } catch (error) {
        console.error("Report Error:", error);
        alert("Failed to load report.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Logic untuk butang Update dalam Edit Modal
    document.getElementById('saveEditFolderBtn').addEventListener('click', async function () {
        const saveBtn = this;
        const libraryId = saveBtn.dataset.libraryId; // Ambil ID yang kita simpan tadi
        const inputEl = document.getElementById('editFolderNameInput');
        const newName = inputEl.value.trim();

        // 1. Validasi
        if (!newName) {
            alert("Folder name cannot be empty.");
            return;
        }

        // Ubah text butang untuk tunjuk progress
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Updating...";
        saveBtn.disabled = true;

        try {
            // 2. Panggil API Update
            const response = await fetch('/api/library/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: libraryId,
                    name: newName
                })
            });

            const result = await response.json();

            if (response.ok) {
                // 3. Tutup Modal
                const modalEl = document.getElementById('editFolderModal');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                modalInstance.hide();

                // 4. Refresh Table & Tunjuk Notification
                showNotification("Folder updated successfully", "success");
                loadLibrarySummary();
            } else {
                alert("Failed to update: " + (result.message || "Unknown error"));
            }

        } catch (error) {
            console.error("Update Error:", error);
            alert("System error while updating folder.");
        } finally {
            // Reset butang
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    });

    // Event Listener untuk Download PDF
    document.getElementById('downloadReportBtn').addEventListener('click', function () {
        // Pastikan library jsPDF dah load
        if (!window.jspdf) {
            alert("PDF Library not loaded properly.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Tajuk PDF
        doc.setFontSize(18);
        doc.text("User Acknowledgement Report", 14, 20);

        doc.setFontSize(11);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // 2. Format Data untuk Table PDF
        // Kita map data dari variable global 'currentReportData' kepada format array
        const tableRows = currentReportData.map(user => {
            let dateDisplay = '-';
            if (user.status === 1 && user.ack_date) {
                const dateObj = new Date(user.ack_date);
                dateDisplay = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return [
                user.user_name,       // Column 1: Name
                user.role_name,       // Column 2: Role
                user.status === 1 ? 'Acknowledged' : 'Pending', // Column 3: Status (Text)
                dateDisplay           // Column 4: Date
            ];
        });

        // 3. Generate Table menggunakan plugin 'autoTable'
        doc.autoTable({
            startY: 35,
            head: [['Member Name', 'Role', 'Status', 'Date']], // Header Table
            body: tableRows, // Isi Table
            theme: 'grid',   // 'striped', 'grid', atau 'plain'
            headStyles: { fillColor: [66, 66, 66] }, // Warna header (Dark Grey)
            styles: { fontSize: 10 },
            // Custom style untuk highlight status
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    if (data.cell.raw === 'Pending') {
                        data.cell.styles.textColor = [255, 0, 0]; // Merah untuk Pending
                    } else {
                        data.cell.styles.textColor = [0, 128, 0]; // Hijau untuk Acknowledged
                    }
                }
            }
        });

        // 4. Save file
        doc.save(`Acknowledgement_Report_${Date.now()}.pdf`);
    });

    // Jalankan load data dari API
    loadLibrarySummary();

    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    openSideNav?.addEventListener("click", () => {
        document.getElementById("right-sidenav").style.width = "400px";
    });

    closeSideNav?.addEventListener("click", () => {
        document.getElementById("right-sidenav").style.width = "0";
    });

    // Dropdown Logic
    const droneListTarget = document.querySelector('#droneDropdown');
    const adminListTarget = document.querySelector('#adminDropdown');

    droneListTarget?.addEventListener('show.bs.collapse', () => {
        document.getElementById('droneDropdownIcon').classList.add('rotate-180');
    });
    droneListTarget?.addEventListener('hide.bs.collapse', () => {
        document.getElementById('droneDropdownIcon').classList.remove('rotate-180');
    });

    // Save Folder Logic
    const saveFolderBtn = document.getElementById('saveFolderBtn');
    const folderNameInput = document.getElementById('folderNameInput');
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = userData.id;
    const userRoleId = userData.role;

    saveFolderBtn?.addEventListener('click', async () => {
        const folderName = folderNameInput.value.trim();

        if (!folderName) {
            alert("Please enter a folder name.");
            return;
        }

        saveFolderBtn.disabled = true;
        saveFolderBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/library/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName, user_id: userId }),
            });

            if (response.status === 201) {
                bootstrap.Modal.getInstance(document.getElementById('createFolderModal')).hide();
                loadLibrarySummary(); // Refresh table tanpa reload page
                folderNameInput.value = '';
                showNotification('Folder created successfully', 'success');
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            saveFolderBtn.disabled = false;
            saveFolderBtn.textContent = 'Save';
        }
    });
});