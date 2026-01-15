let map;
let marker;

document.addEventListener('DOMContentLoaded', () => {
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    openSideNav.addEventListener("click", () => {
        document.getElementById("right-sidenav").style.width = "400px";
    });

    closeSideNav.addEventListener("click", () => {
        document.getElementById("right-sidenav").style.width = "0";
    });

    // Dropdown logic (unchanged)
    const droneListTarget = document.querySelector('#droneDropdown');
    const adminListTarget = document.querySelector('#adminDropdown');
    const droneDropdownIcon = document.querySelector('#droneDropdownIcon');
    const adminDropdownIcon = document.querySelector('#adminDropdownIcon');

    if (droneListTarget) {
        droneListTarget.addEventListener('show.bs.collapse', () => droneDropdownIcon.classList.add('rotate-180'));
        droneListTarget.addEventListener('hide.bs.collapse', () => droneDropdownIcon.classList.remove('rotate-180'));
    }

    if (adminListTarget) {
        adminListTarget.addEventListener('show.bs.collapse', () => adminDropdownIcon.classList.add('rotate-180'));
        adminListTarget.addEventListener('hide.bs.collapse', () => adminDropdownIcon.classList.remove('rotate-180'));
    }

    initMap();

    // ✅ Async block
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const encryptedLocationId = urlParams.get('id');

        if (!encryptedLocationId) {
            console.warn("No ID provided in URL parameters.");
            return;
        }

        const decodedEncryptedId = decodeURIComponent(encryptedLocationId);
        const locationId = await decryptLocationID(decodedEncryptedId);

        console.log('Decrypted Location ID:', locationId);

        if (locationId) {
            fetchLocationDetails(locationId);
        }
    })();
});


async function decryptLocationID(locationID) {
    const encryptedLocationId = await decryptionID(locationID);
    return encryptedLocationId;
}

/**
 * Fetches location data from API and updates UI
 */
async function fetchLocationDetails(id) {
    try {
        const response = await fetch('/api/location/getLocationDetailsById', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ID: id })
        });

        const result = await response.json();

        if (response.ok && result.data && result.data.length > 0) {
            updateDashboard(result.data[0]);
        } else {
            Swal.fire('Error', result.message || 'Location not found', 'error');
        }
    } catch (error) {
        console.error('API Fetch Error:', error);
    }
}

/**
 * Updates UI text, map position, and video source
 */
function updateDashboard(data) {
    // 1. Text Details
    document.getElementById('detail-name').textContent = data.name;
    document.getElementById('detail-email').textContent = data.email;
    document.getElementById('detail-coordinates').textContent = `${data.latitude}, ${data.longitude}`;
    document.getElementById('detail-aruco').textContent = data.aruco_id;
    document.getElementById('detail-address').textContent = data.locationAddress;
    const tag = document.getElementById("statusTag");
    tag.textContent = data.status;

    //2. Status
    tag.className = "badge fs-7 " + (
        data.status === "approved" ? "badge-success" :
            data.status === "rejected" ? "badge-danger" :
                "badge-warning"
    );

    // 3. Map Marker & View
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    if (map && marker) {
        const newCoords = [lat, lng];
        marker.setLatLng(newCoords);
        map.setView(newCoords, 18);
    }

    // 4. Video Source
    if (data.mediaPath) {
        const videoPlayer = document.getElementById('videoPlayer');
        const fileName = data.mediaPath.split('/').pop();
        videoPlayer.src = `https://skyintel.zulsyah.com/uploads/${fileName}`;
        videoPlayer.load();
    }


}

/**
 * Leaflet Map Initialization
 */
function initMap() {
    map = L.map('mapid').setView([3.139, 101.6869], 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    const customIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    marker = L.marker([3.139, 101.6869], { icon: customIcon }).addTo(map);
}