let map = null;
let currentMarker = null;

// Global variables for video recording
let mediaRecorder;
let recordedChunks = [];
let mediaStream;
let finalVideoBlob = null; 
let recordingTimer; 

// Tracks the current camera direction: 'environment' (back) or 'user' (front)
let currentFacingMode = 'environment'; 


document.addEventListener('DOMContentLoaded', () => {
    // --- SIDE NAVIGATION LOGIC ---
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    openSideNav.addEventListener("click", function () {
        openSidenav();
    });

    closeSideNav.addEventListener("click", function () {
        closeSidenav();
    });

    function openSidenav() {
        document.getElementById("right-sidenav").style.width = "400px";
    }

    function closeSidenav() {
        document.getElementById("right-sidenav").style.width = "0";
    }

    initializeMap();
    
    // --- DROPDOWN ROTATION LOGIC ---
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

    // --- VIDEO RECORDING EVENT LISTENERS (FULL SCREEN MODAL) ---
    const startRecordButton = document.getElementById('start-record-button-fs');
    const stopRecordButton = document.getElementById('stop-record-button-fs');
    const switchCameraButton = document.getElementById('switch-camera-button');
    const recordModal = document.getElementById('recordVideoModal');
    const closeRecordModalButton = document.getElementById('close-record-modal-button');

    if (startRecordButton && stopRecordButton && recordModal) {
        startRecordButton.addEventListener('click', startRecording);
        stopRecordButton.addEventListener('click', stopRecording);
        
        if (switchCameraButton) {
            switchCameraButton.addEventListener('click', toggleCamera);
        }
    }
    
    // Auto-start camera when the modal is shown
    recordModal.addEventListener('shown.bs.modal', function () {
        initializeCameraStream();
        closeRecordModalButton.disabled = true;
    });

    // Clean up camera stream when the recording modal is closed
    recordModal.addEventListener('hidden.bs.modal', function () {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        // Reset controls and state
        if (startRecordButton) startRecordButton.disabled = false;
        if (stopRecordButton) stopRecordButton.disabled = true;
        if (closeRecordModalButton) closeRecordModalButton.disabled = true;
        currentFacingMode = 'environment'; // Reset to default back camera
        
        clearInterval(recordingTimer);
    });
});


// ====================================================================
// MAP FUNCTIONS
// ====================================================================

// Function called automatically when Google Maps API loads (via 'callback=initializeMap')
function initializeMap() {
    // Check if the map container exists on the current page before running setup
    if (document.getElementById('locationMap')) {
        setupLocationAutomation();
    }
}

// Main logic to get location, initialize map, and set up listeners
function setupLocationAutomation() {
    const mapContainer = document.getElementById('locationMap');

    const defaultLatLng = { lat: 3.0375, lng: 101.7513 }; 
    
    map = new google.maps.Map(mapContainer, {
        center: defaultLatLng,
        zoom: 12,
    });
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const latLng = { lat: lat, lng: lng };
                
                updateLocation(latLng, map);
                map.setZoom(16);
                map.panTo(latLng);

            },
            (error) => {
                console.error("Geolocation Error (using default location):", error.message);
            }
        );
    } 
    
    map.addListener("click", (mapsMouseEvent) => {
        const clickedLatLng = mapsMouseEvent.latLng.toJSON();
        updateLocation(clickedLatLng, map);
    });
}

function updateLocation(latLng, map) {
    const addressInput = document.getElementById('locationAddressInput');
    const coordinatesInput = document.getElementById('locationCoordinatesInput');
    
    // Get parent groups for updating the label state (Autofill Fix)
    const addressGroup = addressInput ? addressInput.closest('.input-group-outline') : null;
    const coordinatesGroup = coordinatesInput ? coordinatesInput.closest('.input-group-outline') : null;

    if (currentMarker) {
        currentMarker.setMap(null);
    }
    
    currentMarker = new google.maps.Marker({
        position: latLng,
        map: map,
        title: 'Selected Location',
    });

    // 1. Update Coordinates Input and set state
    coordinatesInput.value = `${latLng.lat}, ${latLng.lng}`;
    if (coordinatesGroup) {
        coordinatesGroup.classList.add('is-filled'); // Fixes Material Dashboard autofill overlay
    }
    
    // 2. Reverse Geocode Address
    reverseGeocode(latLng, addressInput)
        // Ensure the address autofill state is updated after the promise resolves
        .then(() => {
            if (addressGroup && addressInput.value) {
                addressGroup.classList.add('is-filled'); // Fixes Material Dashboard autofill overlay
            }
        })
        .catch(() => {
             // Handle any geocode error visually if needed
             if (addressGroup) addressGroup.classList.add('is-filled');
        });
}

function reverseGeocode(latLng, addressInput) {
    const geocoder = new google.maps.Geocoder();
    
    // Return the promise to allow chaining in updateLocation
    return geocoder.geocode({ 'location': latLng })
        .then((response) => {
            if (response.results && response.results.length > 0) {
                const address = response.results[0].formatted_address;
                addressInput.value = address;
            } else {
                addressInput.value = "Address not found";
                console.error('No results found for reverse geocoding.');
            }
        })
        .catch((e) => {
            addressInput.value = "Geocoding failed";
            console.error('Geocoder failed due to: ' + e);
            // Propagate the error to the .catch in updateLocation
            throw e; 
        });
}


// ====================================================================
// VIDEO RECORDING FUNCTIONS (FULL SCREEN MODAL)
// ====================================================================

// Helper function to convert Blob to Base64 
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// NEW FUNCTION: Toggles the camera facing mode and restarts the stream
function toggleCamera() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        alert("Cannot switch camera while recording.");
        return;
    }

    // Stop the current stream first
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }

    // Toggle the facing mode
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';

    // Restart the stream with the new constraints
    initializeCameraStream();
}


// Initializes the camera stream based on the currentFacingMode
async function initializeCameraStream() {
    const videoElement = document.getElementById('video-stream-fullscreen');
    const closeRecordModalButton = document.getElementById('close-record-modal-button');
    const switchCameraButton = document.getElementById('switch-camera-button');

    if (switchCameraButton) switchCameraButton.disabled = true; // Disable button during stream switch

    try {
        const constraints = {
            video: {
                facingMode: currentFacingMode // Use the tracked state ('user' or 'environment')
            }, 
            audio: true
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = mediaStream;
        
        // Enable buttons once stream is established
        closeRecordModalButton.disabled = false;
        if (switchCameraButton) switchCameraButton.disabled = false;

    } catch (err) {
        console.error("Error accessing media devices with facingMode:", currentFacingMode, err);
        alert("Could not access camera/microphone. Device may lack " + currentFacingMode + " camera.");
        
        // Ensure modal can still be closed if camera fails
        closeRecordModalButton.disabled = false;
        if (switchCameraButton) switchCameraButton.disabled = false;
    }
}

// Starts the actual recording process
function startRecording() {
    const startButton = document.getElementById('start-record-button-fs');
    const stopButton = document.getElementById('stop-record-button-fs');
    const closeRecordModalButton = document.getElementById('close-record-modal-button');
    
    if (!mediaStream) {
        alert("Camera stream not active. Please wait or check permissions.");
        return;
    }
    
    startButton.disabled = true;
    stopButton.disabled = false;
    closeRecordModalButton.disabled = true; // Cannot close while recording
    
    recordedChunks = [];
    
    const options = { mimeType: 'video/webm; codecs=vp9' }; 
    mediaRecorder = new MediaRecorder(mediaStream, options);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        finalVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        
        // Process data and close the modal immediately upon stop
        saveVideoDataAndClose();
    };

    mediaRecorder.start();
    console.log("Recording started...");
}

// Stops recording and triggers data processing
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

// Processes the video data and updates the UI in the main form
function saveVideoDataAndClose() {
    const videoDataInput = document.getElementById('video-data-input');
    const videoPreviewArea = document.getElementById('saved-video-preview-area');
    const finalVideoPreview = document.getElementById('final-video-preview');
    const videoStatus = document.getElementById('video-status');
    const recordModalElement = document.getElementById('recordVideoModal');
    
    // Hide the recording stream area
    const videoStreamFullscreen = document.getElementById('video-stream-fullscreen');
    if (videoStreamFullscreen) videoStreamFullscreen.style.display = 'none';

    if (finalVideoBlob) {
        blobToBase64(finalVideoBlob).then(base64Data => {
            
            // 2. Update Hidden Form Data
            videoDataInput.value = base64Data;
            
            // 3. Update Final Preview (in the main page)
            const videoURL = URL.createObjectURL(finalVideoBlob);
            finalVideoPreview.src = videoURL;
            videoPreviewArea.style.display = 'block';

            // 4. Update Status
            videoStatus.textContent = "Video successfully recorded and saved to form.";
            videoStatus.classList.remove('text-secondary', 'text-danger');
            videoStatus.classList.add('text-success');

        }).catch(err => {
            console.error("Error converting video to base64:", err);
            videoStatus.textContent = "Error processing video data.";
            videoStatus.classList.add('text-danger');
        });
    } else {
        videoStatus.textContent = "Recording failed. No video data saved.";
        videoStatus.classList.add('text-danger');
    }

    // 5. Hide the full-screen recording modal
    const recordModal = bootstrap.Modal.getInstance(recordModalElement) || new bootstrap.Modal(recordModalElement);
    recordModal.hide();
}