// Global variables for Map and Location
let map;
let marker;
let currentLocationID; // Menyimpan ID lokasi dari URL (tidak disulitkan)
let currentUserName; // Menyimpan nama pengguna yang sedang log masuk
let currentUserID;   // Menyimpan ID pengguna yang sedang log masuk

const params = new URLSearchParams(window.location.search);
const encryptedId = params.get('id');

// --- Global variables for ArUco scanning ---
let videoElement = null;
let canvasOutput = null; 
let videoStream = null;
let processingInterval = null;
let isScanning = false; 

document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar & Dropdown Logic (Kept as is) ---
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
    
    // PENTING: Inisialisasi elemen DOM scanner
    videoElement = document.getElementById('videoElement');
    canvasOutput = document.getElementById('canvasOutput');

    if (!videoElement || !canvasOutput) {
        console.error("Critical Error: Scanner elements (videoElement or canvasOutput) not found in HTML.");
    }
    
    // Dapatkan maklumat pengguna yang log masuk dari localStorage
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
        const response = await fetch('/api/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encrypted: encryptedId })
        });
        const result = await response.json();
        
        if (response.ok && result.id) {
            currentLocationID = result.id;
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
        const filename = data.mediaPath.split(/[\\/]/).pop(); 

        const videoUrl = `https://skyintel.zulsyah.com/uploads/${filename}`; 

        console.log("Loading video from:", videoUrl);

        videoPlayer.src = videoUrl;
        videoPlayer.load(); 
        videoPlayer.style.height = "350px";
    }
}

function captureAndScanFrame() {
    if (!videoElement || !canvasOutput || !isScanning) return;

    let context = canvasOutput.getContext('2d');
    
    // Pastikan video mempunyai data yang mencukupi
    if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
        
        // Tetapkan saiz canvas kepada saiz video
        canvasOutput.width = videoElement.videoWidth;
        canvasOutput.height = videoElement.videoHeight;
        
        // Lukis frame video ke canvas
        context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);
        
        // Tukar gambar canvas kepada Base64 Data URL (PNG)
        const dataURL = canvasOutput.toDataURL('image/png');
        
        // Hantar gambar ke server
        sendImageToServer(dataURL);
    }
}

/**
 * Menghantar gambar Base64 ke server untuk pengesanan ArUco.
 */
async function sendImageToServer(dataURL) {
    if (!isScanning) return; 

    try {
        const response = await fetch('/api/aruco/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ image: dataURL })
        });

        const result = await response.json();

        if (result.success && result.arucoId) {
            // Marker Ditemui!
            const arucoId = result.arucoId;
            
            // 1. Hentikan kamera dan pemprosesan
            stopArucoScan(); 
            
            // 2. Tutup modal kamera dan paparkan dialog loading
            Swal.fire({
                title: 'Processing...',
                html: `ArUco ID ${arucoId} detected. Submitting review.`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // 🔥 TINDAKAN KRITIKAL: Gunakan setTimeout untuk melambatkan proses submit selama 3 saat (3000ms)
            await new Promise(resolve => setTimeout(resolve, 3000)); 

            // 3. Terus panggil fungsi submit (Approve status = 2)
            await saveReviewStatus(currentLocationID, 2, arucoId, 'approved');

        } else if (result.error) {
            // Server gagal mencari marker atau menghadapi ralat.
            console.warn("Server Scan Message:", result.error);
        }
    } catch (error) {
        console.error("Network Error during scan or failed response:", error);
    }
}


/**
 * Menghentikan akses kamera dan pemprosesan.
 */
function stopArucoScan() {
    isScanning = false; // Set flag kepada false
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
    }
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    // Pindah balik elemen video ke body dan sembunyi
    if (videoElement && videoElement.parentElement) {
        videoElement.style.display = 'none';
        document.body.appendChild(videoElement);
    }
    console.log("ArUco scan stopped.");
}

/**
 * Memulakan akses kamera dan mula mengimbas.
 */
function startArucoScan() {
    if (!videoElement || !canvasOutput) {
        Swal.fire("Error", 'Scanner initialization failed: DOM elements missing.', "error");
        return;
    }
    
    // Minta akses kamera
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
            videoStream = stream;
            videoElement.srcObject = stream;
            videoElement.play();

            videoElement.onloadedmetadata = () => {
                isScanning = true;
                // Mula interval untuk menangkap frame dan hantar ke server pada 5Hz (200ms)
                processingInterval = setInterval(captureAndScanFrame, 200); 
            };
        })
        .catch((err) => {
            console.error("Error accessing camera: ", err);
            Swal.fire({
                title: 'Kamera Gagal',
                text: `Gagal mengakses kamera: ${err.name}. Pastikan anda menggunakan HTTPS atau localhost dan beri kebenaran kamera.`,
                icon: 'error'
            });
        });
}

/**
 * Fungsi utama untuk mengendalikan proses imbasan.
 */
function scanArucoMarker() {
    
    Swal.fire({
        title: 'Imbas ArUco Marker',
        html: `
            <div id="scanner-container" style="width: 100%; background: #000; display: flex; justify-content: center; align-items: center; border-radius: 5px;">
                <p style="color: white; font-size: 1.2rem;">Memuatkan Kamera...</p>
            </div>
            <p style="color:#fff">Sila letakkan marker di hadapan kamera.</p>
        `,
        width: '800px',
        showConfirmButton: false, // TIDAK PERLU BUTANG CONFIRM MANUAL
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        allowOutsideClick: false,
        didOpen: () => {
            const scannerContainer = document.getElementById('scanner-container');
            
            // Pindah videoElement sebenar ke dalam container SweetAlert
            if (videoElement && scannerContainer) {
                 scannerContainer.innerHTML = '';
                 scannerContainer.appendChild(videoElement);
                 videoElement.style.display = 'block'; // Paparkan video
            }

            startArucoScan();
        },
        willClose: () => {
            // Hentikan imbasan apabila dialog ditutup
            stopArucoScan();
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
        confirmButtonText: 'Approve (Scan)',
        denyButtonText: 'Reject',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0d6efd',
        denyButtonColor: '#dc3545',
    }).then((result) => {
        if (result.isConfirmed) {
            // Jika pengguna tekan 'Approve (Scan)', terus buka kamera
            scanArucoMarker();
        } else if (result.isDenied) {
            handleReject();
        }
    });
}

// FUNGSI handleApprove() TIDAK LAGI DIPERLUKAN DAN TELAH DIBUANG.
// Logik Approve kini dikendalikan secara automatik dalam sendImageToServer.

function handleReject() {
    // Panggil fungsi untuk menghantar Rejected status ke server
    saveReviewStatus(currentLocationID, 3, null, 'rejected'); // 3 = LocationStatusId untuk Rejected
}


/**
 * Menghantar status semakan lokasi ke API dan mencatat log.
 */
async function saveReviewStatus(locationId, statusId, arucoId, action) {
    if (!currentUserID || !currentUserName) {
        Swal.fire("Error", "User data missing. Please re-login.", "error");
        return;
    }
    
    try {
        // Jika belum ada loading, paparkan loading
        if (!Swal.isVisible()) {
             Swal.fire({
                title: 'Processing...',
                html: 'Submitting review status. Please wait.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }
        
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
            `${action.charAt(0).toUpperCase() + action.slice(1)}!`, 
            `Enrollment has been successfully ${action}.`,
            'success'
        ).then((result) => {
            // 🔥 TINDAKAN KRITIKAL: Reload page HANYA selepas pengguna menekan butang OK
            if (result.isConfirmed) {
                // window.location.reload(); 
                window.location.href = "../"
            }
        });

    } catch (error) {
        console.error(`API Error on ${action}:`, error);
        Swal.fire("Error", `Failed to complete review process: ${error.message}`, "error");
    }
}       