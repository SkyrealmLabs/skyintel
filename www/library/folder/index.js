/**
 * index.js - Library Folder Management (Main & Archieve View)
 */

// Global Variables
let fileCount = 0;
let totalSize = 0;
let userData = null; 

// --- 1. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Load user data
    userData = JSON.parse(localStorage.getItem("user"));
    
    // Setup UI Components
    setupSidenav();
    setupUploadUI();
    
    // Load Dynamic Data (Main/Archieve Table)
    initFolderPage();
});

// --- 2. CORE LOGIC: LOAD FOLDER DATA ---

async function initFolderPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const encryptedId = urlParams.get('id');
    const folderName = urlParams.get('name');

    // Set Title
    if (folderName) {
        document.getElementById("folderTitle").innerText = folderName.replace(/_/g, ' ');
    }

    if (!encryptedId) {
        console.error("No ID found in URL");
        return;
    }

    // Decrypt ID
    const libraryId = await handleIdDecryption(encryptedId);
    if (!libraryId) return;

    // Fetch details for Main & Archieve
    loadFolderDetails(libraryId, encryptedId);
}

async function loadFolderDetails(libraryId, encryptedId) {
    try {
        const response = await fetch(`/api/library/folder-details/${libraryId}`);
        const data = await response.json();

        const tableBody = document.getElementById('folderTableBody');
        if (!tableBody) return; // Safety check

        tableBody.innerHTML = ''; // Clear loading/static state

        // Define hardcoded structure
        const folders = [
            { key: 'Main', name: 'Main', icon: 'folder.png' },
            { key: 'Archieve', name: 'Archieve', icon: 'folder.png' } 
        ];

        folders.forEach(folder => {
            const info = data[folder.key] || { version: '-', author: '-', date: '-', timeAgo: '-' };
            
            // Format tarikh (YYYY-MM-DD kepada DD/MM/YYYY)
            const displayDate = info.date && info.date !== '-' 
                ? new Date(info.date).toLocaleDateString('en-GB') 
                : '-';

            const row = document.createElement('tr');
            row.className = 'clickable-row';
            
            // Link ke view-files dengan parameter folder_type (Main/Archieve)
            row.dataset.href = `./view-files?library_id=${encodeURIComponent(encryptedId)}&folder_type=${folder.key}`;

            row.innerHTML = `
                <td>
                    <div class="d-flex px-2 py-1">
                        <div>
                            <img src="../../assets/img/${folder.icon}" class="avatar-sm me-3" alt="folder">
                        </div>
                        <div class="d-flex flex-column justify-content-center">
                            <h6 class="mb-0 font-weight-bold">${folder.name}</h6>
                        </div>
                    </div>
                </td>
                <td><p class="font-weight-normal mb-0">${info.author || '-'}</p></td>
                <td class="align-middle text-center"><p class="mb-0 font-weight-normal">${displayDate}</p></td>
                <td class="align-middle text-center"><p class="mb-0 font-weight-normal">${info.timeAgo || '-'}</p></td>
                <td class="align-middle text-center"><p class="mb-0 font-weight-normal">${info.version || '-'}</p></td>
            `;

            // Row click handler
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    window.location.href = row.dataset.href;
                }
            });

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading folder details:", error);
        showNotification("Gagal memuatkan data folder.", "error");
    }
}

// --- 3. HELPER: DECRYPTION ---

async function handleIdDecryption(encryptedId) {
    try {
        if (typeof decryptionID === 'function') {
            const originalId = await decryptionID(encryptedId);
            return originalId;
        } else {
            console.error("decryptionID function not found!");
            return null;
        }
    } catch (err) {
        console.error("Decryption failed:", err);
        return null;
    }
}

// --- 4. UPLOAD LOGIC ---

function setupUploadUI() {
    const dropbox = document.getElementById('dropbox');
    const fileInput = document.getElementById('fileInput');
    const saveBtn = document.getElementById('saveUploadFile');
    const browseBtn = document.querySelector('.browse-btn');

    if (!dropbox || !fileInput) return; // Safety check jika elemen tiada

    // Drag & Drop Events
    dropbox.addEventListener('dragover', (e) => { e.preventDefault(); dropbox.classList.add('dragover'); });
    dropbox.addEventListener('dragleave', () => dropbox.classList.remove('dragover'));
    dropbox.addEventListener('drop', (e) => {
        e.preventDefault();
        dropbox.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // Click Events
    dropbox.addEventListener('click', () => fileInput.click());
    if(browseBtn) browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Save Button Logic
    if(saveBtn) saveBtn.addEventListener('click', handleUpload);
}

async function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const versionInput = document.getElementById('fileVersion');
    const saveBtn = document.getElementById('saveUploadFile');
    
    const file = fileInput.files[0];
    const version = versionInput.value;

    const urlParams = new URLSearchParams(window.location.search);
    const encryptedLibraryId = urlParams.get('id');
    const libraryId = await handleIdDecryption(encryptedLibraryId);

    // Validation
    if (!file || !version || !libraryId) {
        showNotification('Sila pilih fail, masukkan versi, dan pastikan ID sah.', 'error');
        return;
    }

    if (!userData || !userData.id) {
        showNotification('Sila log masuk semula.', 'error');
        return;
    }

    // Prepare Payload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', version);
    formData.append('library_id', libraryId);
    formData.append('upload_user_id', userData.id);

    // UI Feedback
    saveBtn.disabled = true;
    saveBtn.innerText = 'Uploading...';

    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Fail berjaya dimuat naik!', 'success');
            
            // Close Modal
            const modalEl = document.getElementById('uploadFileModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            // Reset UI
            versionInput.value = '';
            removeAllPreviews();
            
            // Refresh Data tanpa reload page
            loadFolderDetails(libraryId, encryptedLibraryId);
        } else {
            showNotification('Ralat: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Gagal menghubungi server.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save';
    }
}

// --- 5. FILE HANDLING UI (FIXED) ---

function handleFiles(files) {
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (files.length > 0) {
        let validFiles = 0;
        Array.from(files).forEach(file => {
            // FIX: Check extension juga sebagai fallback jika file.type kosong
            const fileName = file.name.toLowerCase();
            const isImage = file.type.startsWith('image/') || fileName.endsWith('.jpg') || fileName.endsWith('.png');
            const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

            if (!isImage && !isPdf) {
                showNotification(`${file.name} format tidak sah. Hanya PDF, JPG, PNG.`, 'error');
                return;
            }
            if (file.size > maxSize) {
                showNotification(`${file.name} terlalu besar (>5MB).`, 'error');
                return;
            }
            displayFilePreview(file);
            validFiles++;
        });

        if (validFiles > 0) simulateUploadProgress();
    }
}

function displayFilePreview(file) {
    removeAllPreviews(); // Limit to 1 file upload per time logic
    
    const filePreviews = document.getElementById('filePreviews');
    const progressBar = document.getElementById('progress-bar');
    
    // Safety check
    if(progressBar) progressBar.style.display = 'block';
    
    const reader = new FileReader();
    const fileId = `file-${Date.now()}`;

    reader.onload = function (event) {
        const preview = document.createElement('div');
        preview.classList.add('file-preview');
        preview.id = fileId;
        const fileName = file.name.toLowerCase();
        const isImage = file.type.startsWith('image/') || fileName.endsWith('.jpg') || fileName.endsWith('.png');

        preview.innerHTML = `
            <div class="preview-img-container">
                ${isImage ? `<img src="${event.target.result}" class="preview-img">` : `<div class="file-icon">📄</div>`}
            </div>
            <div class="file-info">
                <div class="file-name text-truncate" style="max-width: 200px;">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
                <button type="button" class="btn btn-sm btn-outline-danger mt-1 remove-btn">Remove</button>
            </div>
        `;

        preview.querySelector('.remove-btn').addEventListener('click', () => removeFile(fileId, file.size));
        
        if(filePreviews) filePreviews.appendChild(preview);

        fileCount = 1; 
        totalSize = file.size;
        updateStatsUI();
    };
    reader.readAsDataURL(file);
}

function removeFile(fileId, size) {
    const el = document.getElementById(fileId);
    if (el) el.remove();
    fileCount = 0;
    totalSize = 0;
    const input = document.getElementById('fileInput');
    if(input) input.value = ''; 
    updateStatsUI();
}

function removeAllPreviews() {
    const previews = document.getElementById('filePreviews');
    if(previews) previews.innerHTML = '';
    fileCount = 0;
    totalSize = 0;
    updateStatsUI();
}

// FIX: Added Null Checks to prevent 'reading style of null' error
function updateStatsUI() {
    const fileCountEl = document.getElementById('fileCount');
    const totalSizeEl = document.getElementById('totalSize');
    const emptyState = document.getElementById('emptyState');
    const uploadStats = document.getElementById('uploadStats');
    const progressBar = document.getElementById('progress-bar');

    if (fileCountEl) fileCountEl.textContent = fileCount;
    if (totalSizeEl) totalSizeEl.textContent = formatFileSize(totalSize);

    if (fileCount > 0) {
        if (emptyState) emptyState.style.display = 'none';
        if (uploadStats) uploadStats.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'block';
        if (uploadStats) uploadStats.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
    }
}

// --- 6. UTILS & UI HELPERS ---

function setupSidenav() {
    const openBtn = document.getElementById("open-sidenav-button");
    const closeBtn = document.getElementById("close-sidenav-button");
    const sidenav = document.getElementById("right-sidenav");

    if(openBtn) openBtn.addEventListener("click", () => sidenav.style.width = "400px");
    if(closeBtn) closeBtn.addEventListener("click", () => sidenav.style.width = "0");
}

function showNotification(message, type = 'success') {
    alert(`${type.toUpperCase()}: ${message}`); 
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function simulateUploadProgress() {
    const fill = document.getElementById('progressFill');
    if(fill) {
        fill.style.width = '0%';
        setTimeout(() => fill.style.width = '100%', 500);
    }
}