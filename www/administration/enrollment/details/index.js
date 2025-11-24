// Global variables for Map and Location
let map;
let marker;
let currentLocationID; // Menyimpan ID lokasi untuk digunakan dalam Approval/Rejection
let currentUserName; // Menyimpan nama pengguna yang sedang log masuk
let currentUserID;   // Menyimpan ID pengguna yang sedang log masuk

const params = new URLSearchParams(window.location.search);
const encryptedId = params.get('id');

// --- Global variables for ArUco scanning ---
let videoElement = null;
let canvasOutput = null;
let videoStream = null;
let src = null;
let dst = null;
let dictionary = null;
let detector = null;
let processingInterval = null;
const ARUCO_DICT = 4; // Menggunakan DICT_6X6_250

document.addEventListener('DOMContentLoaded', () => {
    // ... (Sidebar & Dropdown Logic - KEPT AS IS) ...
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    if (openSideNav) openSideNav.addEventListener("click", () => openSidenav());
    if (closeSideNav) closeSideNav.addEventListener("click", () => closeSidenav());

    function openSidenav() { document.getElementById("right-sidenav").style.width = "400px"; }
    function closeSidenav() { document.getElementById("right-sidenav").style.width = "0"; }

    const droneListTarget = document.querySelector('#droneDropdown');
    const adminListTarget = document.querySelector('#adminDropdown');

    if (droneListTarget) {
        const icon = document.querySelector('#droneDropdownIcon');
        droneListTarget.addEventListener('show.bs.collapse', () => icon.classList.add('rotate-180'));
        droneListTarget.addEventListener('hide.bs.collapse', () => icon.classList.remove('rotate-180'));
    }
    if (adminListTarget) {
        const icon = document.querySelector('#adminDropdownIcon');
        adminListTarget.addEventListener('show.bs.collapse', () => icon.classList.add('rotate-180'));
        adminListTarget.addEventListener('hide.bs.collapse', () => icon.classList.remove('rotate-180'));
    }

    // --- Initialization ---
    initMap(); 

    videoElement = document.getElementById('videoElement');
    canvasOutput = document.getElementById('canvasOutput');
    
    if (!videoElement || !canvasOutput) {
        console.error("Critical Error: videoElement or canvasOutput not found in HTML.");
        // Anda boleh tambah Swal.fire di sini jika perlu.
    }
    
    // Dapatkan maklumat pengguna yang log masuk
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        currentUserID = user.id;
        currentUserName = user.name;
    }


    if (encryptedId) {
        handleUserDecryption(encryptedId);
    } else {
        console.error("No ID found in URL");
        Swal.fire("Error", "No Location ID provided in URL", "error");
    }
});

function initMap() {
    // Initialize map centered on Kuala Lumpur (Default)
    map = L.map('mapid').setView([3.139, 101.6869], 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    var customIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });

    // Create marker but don't add to map yet, or add at default
    marker = L.marker([3.139, 101.6869], { icon: customIcon }).addTo(map);
}

async function handleUserDecryption(encryptedId) {
    try {
        // Assuming decryptionID is available globally from login.js or similar
        // Jika decryptionID tidak global, anda perlu mengimplementasikannya di sini:
        const response = await fetch('/api/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encrypted: encryptedId })
        });
        const result = await response.json();
        
        if (response.ok && result.id) {
            currentLocationID = result.id; // Simpan ID lokasi yang tidak disulitkan
            fetchLocationDetails(currentLocationID);
        } else {
            throw new Error(result.error || "Decryption API failed");
        }
        
    } catch (err) {
        console.error("Decryption failed:", err);
        Swal.fire("Error", "Failed to decrypt ID", "error");
    }
}

async function fetchLocationDetails(id) {
    try {
        const response = await fetch('/api/location/getLocationDetailsById', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ID: id })
        });

        const result = await response.json();

        if (response.ok && result.data && result.data.length > 0) {
            updateUI(result.data[0]);
        } else {
            Swal.fire("Error", result.message || "Location not found", "error");
        }

    } catch (error) {
        console.error("API Error:", error);
        Swal.fire("Error", "Failed to connect to server", "error");
    }
}

function updateUI(data) {
    // 1. Update Text Fields
    document.getElementById('detail-name').innerText = data.name || "Unknown";
    document.getElementById('detail-email').innerText = data.email || "N/A";
    document.getElementById('detail-aruco').innerText = data.aruco_id || "Not Stated Yet";
    document.getElementById('detail-address').innerText = data.locationAddress || "Address not available";
    document.getElementById('detail-coordinates').innerText = `${data.latitude}, ${data.longitude}`;

    // 2. Update Map
    if (data.latitude && data.longitude) {
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);

        map.setView([lat, lng], 18);
        marker.setLatLng([lat, lng])
            .bindPopup(`<b>${data.name}</b><br>${lat}, ${lng}`)
            .openPopup();
    }

    // 3. Update Video
    if (data.mediaPath) {
        const videoPlayer = document.getElementById('videoPlayer');
        const filename = data.mediaPath.split(/[\\/]/).pop(); // Split by both '\' or '/'

        // Pastikan URL video sepadan dengan konfigurasi server anda
        const videoUrl = `/uploads/${filename}`; 

        console.log("Loading video from:", videoUrl);

        videoPlayer.src = videoUrl;
        videoPlayer.load(); 
    }
}

// ------------------------------------
// --- ArUco SCANNER IMPLEMENTATION ---
// ------------------------------------

/**
 * Memulakan akses kamera dan mula mengimbas.
 */
function startArucoScan() {
    if (!videoElement || !canvasOutput) {
        console.error("Scanner elements are not ready.");
        Swal.showValidationMessage('Scanner initialization failed.');
        return;
    }

    // Minta akses kamera
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
            videoStream = stream;
            videoElement.srcObject = stream;
            videoElement.play();

            videoElement.onloadedmetadata = () => {
                videoElement.width = videoElement.videoWidth;
                videoElement.height = videoElement.videoHeight;
                canvasOutput.width = videoElement.videoWidth;
                canvasOutput.height = videoElement.videoHeight;
                
                // Mula pemprosesan ArUco
                initOpenCVProcessing();
            };
        })
        .catch((err) => {
            console.error("Error accessing camera: ", err);
            Swal.showValidationMessage(`Gagal mengakses kamera: ${err.name}`);
        });
}

/**
 * Menghentikan akses kamera dan pemprosesan.
 */
function stopArucoScan() {
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
    }

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    // Release memori OpenCV (PENTING)
    if (src) { src.delete(); src = null; }
    if (dst) { dst.delete(); dst = null; }
    if (dictionary) { dictionary.delete(); dictionary = null; }
    if (detector) { detector.delete(); detector = null; }

    console.log("ArUco scan stopped and resources released.");
}

/**
 * Menyediakan objek-objek OpenCV yang diperlukan.
 */
function initOpenCVProcessing() {
    // Pastikan OpenCV dimuatkan dan video mempunyai dimensi
    if (!cv || !videoElement.videoWidth || !videoElement.videoHeight) {
        setTimeout(initOpenCVProcessing, 100); // Cuba lagi
        return;
    }

    // Initialize Mat objects for processing
    src = new cv.Mat(videoElement.height, videoElement.width, cv.CV_8UC4);
    dst = new cv.Mat();
    
    // Initialize ArUco detector
    dictionary = cv.getPredefinedDictionary(ARUCO_DICT);
    detector = new cv.ArucoDetector(dictionary);

    // Mula interval pemprosesan (contoh: 30ms untuk ~30 FPS)
    processingInterval = setInterval(processVideoFrame, 30);
}

/**
 * Pemprosesan bingkai video untuk mengesan ArUco Marker.
 */
function processVideoFrame() {
    if (!videoElement.videoWidth || !detector || !cv || !src) return;

    // 1. Tangkap frame dari video
    let context = canvasOutput.getContext('2d');
    context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);
    
    // 2. Salin data kanvas ke Mat OpenCV
    let imageData = context.getImageData(0, 0, canvasOutput.width, canvasOutput.height);
    src = cv.matFromImageData(imageData);

    // 3. Tukar kepada skala kelabu
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

    // 4. Deteksi ArUco Marker
    const corners = new cv.MatVector();
    const ids = new cv.Mat();

    detector.detectMarkers(dst, corners, ids);

    // 5. Semak jika marker ditemui
    if (ids.rows > 0) {
        // Hanya ambil ID marker pertama
        const arucoId = ids.data32S[0]; 
        console.log("ArUco Marker Detected:", arucoId);

        // Hentikan imbasan
        stopArucoScan();
        
        // Kemas kini input field
        const inputField = document.getElementById('aruco-id-input');
        if (inputField) inputField.value = arucoId;

        // Tutup dialog SweetAlert dan teruskan pengesahan
        Swal.close();
        
        // Tiru klik butang Sahkan (Confirm) untuk meneruskan dengan ID
        // Ini adalah hacks, tetapi berkesan untuk mencetuskan `.then((inputResult) => {})`
        const reviewBtn = document.querySelector('.swal2-confirm');
        if (reviewBtn) {
             reviewBtn.click();
        }

    }

    corners.delete();
    ids.delete();
}

/**
 * Fungsi yang dipanggil apabila ikon imbasan ditekan.
 */
function scanArucoMarker() {
    const inputField = document.getElementById('aruco-id-input');
    if (!inputField) return;

    Swal.fire({
        title: 'Imbas ArUco Marker',
        html: `
            <div id="scanner-container" style="width: 100%; height: 300px; background: #000; display: flex; justify-content: center; align-items: center; border-radius: 5px;">
                <p style="color: white;">Kamera sedang memuatkan... (Pastikan OpenCV.js dimuatkan)</p>
            </div>
            <p>Sila letakkan marker di hadapan kamera.</p>
            `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        allowOutsideClick: false,
        didOpen: () => {
            // Pindah elemen video/canvas ke dalam container SweetAlert
            const scannerContainer = document.getElementById('scanner-container');
            videoElement.style.display = 'block';
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'contain'; 
            scannerContainer.innerHTML = ''; 
            scannerContainer.appendChild(videoElement);
            
            startArucoScan();
        },
        willClose: () => {
            // Hentikan imbasan apabila dialog ditutup
            stopArucoScan();
            // Pindah balik elemen video ke body dan sembunyikannya
            if (videoElement) {
                videoElement.style.display = 'none';
                document.body.appendChild(videoElement); 
            }
        }
    });
}

// ------------------------------------
// --- REVIEW/APPROVAL LOGIC ---
// ------------------------------------

function reviewLocation() {
    if (!currentLocationID) {
        Swal.fire("Error", "Location ID is not available.", "error");
        return;
    }
    
    Swal.fire({
        title: 'What action would you like to take?',
        text: 'You can approve, reject, or cancel this enrollment.',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Approve',
        denyButtonText: 'Reject',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0d6efd',
        denyButtonColor: '#dc3545',
    }).then((result) => {
        if (result.isConfirmed) {
            handleApprove();
        } else if (result.isDenied) {
            handleReject();
        }
    });
}

function handleApprove() {
    Swal.fire({
        title: 'Enter Aruco ID',
        html: `
            <div style="display: flex; align-items: center; border: 1px solid #ccc; border-radius: 5px; padding: 5px;">
                <input id="aruco-id-input" type="text" placeholder="Enter Aruco ID here..." class="swal2-input" style="flex-grow: 1; border: none; box-shadow: none; margin: 0; padding: 0;">
                <i id="scan-icon" class="material-icons" style="cursor: pointer; font-size: 28px; margin-left: 10px; color: #6c757d;">qr_code_scanner</i>
            </div>
        `,
        focusConfirm: false,
        preConfirm: (arucoId) => {
            // Fallback: jika preConfirm dipanggil tanpa nilai (e.g., secara manual), ambil dari input field
            if (arucoId === undefined || arucoId === null) {
                arucoId = document.getElementById('aruco-id-input').value;
            }
            if (!arucoId) {
                Swal.showValidationMessage('You need to enter an ID!');
                return false;
            }
            return arucoId;
        },
        didOpen: () => {
            document.getElementById('scan-icon').addEventListener('click', scanArucoMarker);
        }
    }).then((inputResult) => {
        if (inputResult.isConfirmed) {
            // Panggil fungsi untuk menghantar Approval status ke server
            saveReviewStatus(currentLocationID, 2, inputResult.value, 'approved'); // 2 = LocationStatusId untuk Approved
        }
    });
}

function handleReject() {
    // Panggil fungsi untuk menghantar Rejected status ke server
    saveReviewStatus(currentLocationID, 3, null, 'rejected'); // 3 = LocationStatusId untuk Rejected
}


/**
 * Menghantar status semakan lokasi ke API.
 * @param {number} locationId - ID Lokasi yang tidak disulitkan.
 * @param {number} statusId - ID Status (2: Approved, 3: Rejected).
 * @param {string | null} arucoId - ID Aruco jika diluluskan.
 * @param {string} action - 'approved' atau 'rejected' untuk log.
 */
async function saveReviewStatus(locationId, statusId, arucoId, action) {
    if (!currentUserID || !currentUserName) {
        Swal.fire("Error", "User data missing. Please re-login.", "error");
        return;
    }
    
    try {
        // 1. Panggil API untuk kemas kini status Lokasi
        const reviewResponse = await fetch('/api/location/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationStatusId: statusId,
                aruco_id: arucoId,
                id: locationId
            })
        });

        if (!reviewResponse.ok) {
            throw new Error(`Failed to update status: ${reviewResponse.statusText}`);
        }

        // 2. Panggil API untuk log tindakan
        const logResponse = await fetch('/api/location/enrollment/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userID: currentUserID,
                userName: currentUserName,
                locationID: locationId,
                action: action 
            })
        });

        if (!logResponse.ok) {
            console.error("Warning: Failed to log action, but status updated.");
        }
        
        // 3. Tunjukkan mesej kejayaan
        Swal.fire(
            `${action.charAt(0).toUpperCase() + action.slice(1)}!`, // 'Approved' atau 'Rejected'
            `Enrollment has been successfully ${action}.`,
            'success'
        ).then(() => {
            // Redirect kembali ke halaman senarai (Enrollment)
            window.location.href = '../../../administration/enrollment/';
        });

    } catch (error) {
        console.error(`API Error on ${action}:`, error);
        Swal.fire("Error", `Failed to complete review process: ${error.message}`, "error");
    }
}