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

// --- INTEGRASI API: MENGAMBIL DATA SUMMARY ---
async function loadLibrarySummary() {
    try {
        const response = await fetch('/api/library/summary');
        const data = await response.json();

        const tableBody = document.querySelector('table tbody');
        if (!tableBody) return;

        tableBody.innerHTML = ''; // Kosongkan data statik asal

        // Guna for...of untuk membolehkan penggunaan await di dalam gelung
        for (const item of data) {
            // Ambil tarikh sahaja dari timestamp (YYYY-MM-DD)
            const displayDate = item.last_update ? item.last_update.split(' ')[0] : '-';
            
            const row = document.createElement('tr');
            row.className = 'clickable-row';

            // Menunggu proses enkripsi ID selesai
            const encrypted = await encryptionID(item.library_id);
            
            // Simpan id dalam URL supaya page folder boleh guna
            row.dataset.href = `./folder?id=${encodeURIComponent(encrypted)}&name=${encodeURIComponent(item.document_name)}`;

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
                </td>
                <td class="align-middle text-center">
                    <button class="btn btn-link p-0 m-0 border-0 view-stats-btn" data-id="${item.library_id}">
                        <i class="material-icons text-secondary position-relative text-lg">assessment</i>
                    </button>
                </td>
            `;

            // Event listener untuk row click
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
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

// --- INITIALIZATION & SIDENAV LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
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

    saveFolderBtn?.addEventListener('click', async () => {
        const folderName = folderNameInput.value.trim();
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const userId = userData.id || 1; 

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