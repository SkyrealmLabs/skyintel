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

// Initialize display
updateDisplay();

// Prevent default behavior for drag and drop events
dropbox.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropbox.classList.add('dragover');
});

dropbox.addEventListener('dragleave', () => {
    dropbox.classList.remove('dragover');
});

// Handle file drop
dropbox.addEventListener('drop', (e) => {
    e.preventDefault();
    dropbox.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// Handle file selection through the input
fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    handleFiles(files);
});

// Trigger file input when dropbox or browse button is clicked
dropbox.addEventListener('click', () => {
    fileInput.click();
});

browseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    fileInput.click();
});

// Handle files
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

            // Handle valid file
            displayFilePreview(file);
            validFiles++;
        });

        if (validFiles > 0) {
            simulateUpload(validFiles);
            showNotification(`${validFiles} file${validFiles !== 1 ? 's' : ''} added successfully.`, 'success');
        }

        if (invalidFiles > 0) {
            showNotification(`${invalidFiles} file${invalidFiles !== 1 ? 's' : ''} not added due to errors.`, 'error');
        }
    }
}

function displayFilePreview(file) {
    
    // Remove existing file
    removeAllPreviews();

    progressBar.style.display = 'block';
    const reader = new FileReader();
    const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    reader.onload = function (event) {
        const preview = document.createElement('div');
        preview.classList.add('file-preview');
        preview.id = fileId;

        // Format file size
        const fileSize = formatFileSize(file.size);

        // Determine if it's an image or PDF
        const isImage = file.type.startsWith('image/');

        let previewContent;
        if (isImage) {
            previewContent = `<img src="${event.target.result}" class="preview-img">`;
        } else {
            previewContent = `<div class="file-icon">📄</div>`;
        }

        preview.innerHTML = `
            <div class="preview-img-container">
                ${previewContent}
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${fileSize}</div>
                <div class="file-actions">
                <button class="remove-btn">Remove</button>
                </div>
            </div>
        `;

        // Add remove functionality
        const removeBtn = preview.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            removeFile(fileId, file.size);
        });
        closeUploadModal.addEventListener('click', () => {
            removeFile(fileId, file.size);
        });

        filePreviews.appendChild(preview);

        // Update statistics
        fileCount++;
        totalSize += file.size;
        updateDisplay();
    };

    reader.readAsDataURL(file);
}

function removeFile(fileId, size) {
    
    const fileElement = document.getElementById(fileId);
    if (fileElement) {
        // Animate removal
        fileElement.style.opacity = '0';
        fileElement.style.transform = 'scale(0.9)';

        setTimeout(() => {
            fileElement.remove();

            // Update statistics
            fileCount--;
            totalSize -= size;
            updateDisplay();

            showNotification('File removed', 'success');
        }, 300);
    }

    uploadStats.style.display = 'none';
    progressBar.style.display = 'none';

    resetFileInput();
}

function removeAllPreviews() {
    const previews = document.querySelectorAll('.file-preview');
    previews.forEach(preview => {
        preview.style.opacity = '0';
        preview.style.transform = 'scale(0.9)';
        setTimeout(() => preview.remove(), 300);
    });

    // Reset counters & display
    fileCount = 0;
    totalSize = 0;
    updateDisplay();
    uploadStats.style.display = 'none';
    progressBar.style.display = 'none';
}

function updateDisplay() {
    fileCountEl.textContent = fileCount;
    totalSizeEl.textContent = formatFileSize(totalSize);

    if (fileCount > 0) {
        emptyState.style.display = 'none';
        progressFill.style.width = '100%';
    } else {
        emptyState.style.display = 'block';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'success') {
    // Clear any existing timeout
    clearTimeout(notification.timeout);

    // Hide notification if it's already showing
    notification.classList.remove('show', 'success', 'error');

    // Set content and show
    document.getElementById('notificationText').textContent = message;
    notification.classList.add('show', type);

    // Reset progress bar
    const progressBar = notification.querySelector('.notification-progress');
    progressBar.style.transition = 'none';
    progressBar.style.transform = 'scaleX(0)';

    // Force reflow to restart animation
    void notification.offsetWidth;

    // Start progress animation
    progressBar.style.transition = 'transform 3s linear';
    progressBar.style.transform = 'scaleX(1)';

    // Auto-hide after 3 seconds
    notification.timeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function simulateUpload(fileCount) {
    // This would be where you'd actually upload to a server
    // For now we're just showing the progress visually
    progressFill.style.width = '0%';

    setTimeout(() => {
        progressFill.style.width = '30%';

        setTimeout(() => {
            progressFill.style.width = '60%';

            setTimeout(() => {
                progressFill.style.width = '100%';
            }, 200);
        }, 200);
    }, 100);
}

// Reset the file input after a file is removed
function resetFileInput() {
    fileInput.value = '';
}

// Initial UI setup
function initUI() {
    if (fileCount === 0) {
        uploadStats.style.display = 'none';
        emptyState.style.display = 'block';
        progressBar.style.display = 'none';
    }
}

// Initialize UI
initUI();

document.addEventListener('DOMContentLoaded', () => {
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    openSideNav.addEventListener("click", function () {
        openSidenav();
    })

    closeSideNav.addEventListener("click", function () {
        closeSidenav();
    })

    function openSidenav() {
        document.getElementById("right-sidenav").style.width = "400px";
    }

    function closeSidenav() {
        document.getElementById("right-sidenav").style.width = "0";
    }
    
    const droneToggleLink = document.querySelector('[data-bs-toggle="collapse"][href="#droneDropdown"]');
    const adminToggleLink = document.querySelector('[data-bs-toggle="collapse"][href="#adminDropdown"]');
    const droneDropdownIcon = droneToggleLink.querySelector('#droneDropdownIcon');
    const droneListTarget = document.querySelector('#droneDropdown');
    const adminDropdownIcon = adminToggleLink.querySelector('#adminDropdownIcon');
    const adminListTarget = document.querySelector('#adminDropdown');

    droneListTarget.addEventListener('show.bs.collapse', () => {
        droneDropdownIcon.classList.add('rotate-180');
    });

    droneListTarget.addEventListener('hide.bs.collapse', () => {
        droneDropdownIcon.classList.remove('rotate-180');
    });

    adminListTarget.addEventListener('show.bs.collapse', () => {
        adminDropdownIcon.classList.add('rotate-180');
    });

    adminListTarget.addEventListener('hide.bs.collapse', () => {
        adminDropdownIcon.classList.remove('rotate-180');
    });
});