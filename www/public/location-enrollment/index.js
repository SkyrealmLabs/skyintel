document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION CHECK ---
    // Retrieve user data from localStorage set during login
    const user = JSON.parse(localStorage.getItem("user")) || null;
    const locationContainer = document.getElementById("location-list-container");

    /**
     * Fetches locations from the API specifically for the logged-in User ID
     */
    async function fetchUserLocations() {
        if (!user || !user.id) {
            console.error("No user found in session.");
            return;
        }

        try {
            const response = await fetch('/api/location/getLocationByUserId', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID: user.id })
            });

            const result = await response.json();

            if (response.ok && result.data) {
                renderLocations(result.data);
                updateStatusCounters(result.data);
            } else {
                if (locationContainer) {
                    locationContainer.innerHTML = `<div class="col-12 text-center"><p class="text-secondary">${result.message || "No locations found."}</p></div>`;
                }
            }
        } catch (error) {
            console.error("Error fetching locations:", error);
        }
    }

    /**
     * Dynamically creates HTML cards for each location returned by the API
     */
    function renderLocations(locations) {
        if (!locationContainer) return;
        locationContainer.innerHTML = ""; // Clear static placeholders

        locations.forEach(loc => {
            // Logic to determine badge color based on API status value
            let badgeClass = "badge-warning"; // Default for Pending
            if (loc.status.toLowerCase() === 'approved') badgeClass = "badge-success";
            if (loc.status.toLowerCase() === 'rejected') badgeClass = "badge-danger";

            const cardHtml = `
                <div class="col-lg-4 col-md-6 mb-4">
                    <div class="card h-100">
                        <div class="card-body p-3">
                            <div class="d-flex mt-n2">
                                <div class="avatar avatar-xl bg-gradient-dark border-radius-xl p-2 mt-n4">
                                    <img src="../../../assets/img/small-logos/location-icon.svg" style="width: 80% !important;" alt="location_icon">
                                </div>
                                <div class="ms-3 my-auto">
                                    <span class="badge ${badgeClass} badge-md">${loc.status.toUpperCase()}</span>
                                </div>
                                <div class="ms-auto">
                                    <div class="dropdown">
                                        <button class="btn btn-link text-secondary ps-0 pe-2" data-bs-toggle="dropdown">
                                            <i class="material-icons">more_vert</i>
                                        </button>
                                        <div class="dropdown-menu dropdown-menu-end">
                                            <a class="dropdown-item" href="details/?id=${loc.id}">Details</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p class="text-sm mt-3 text-truncate-3" style="min-height: 4.5rem;">${loc.locationAddress}</p>
                            <hr class="horizontal dark">
                            <div class="row">
                                <div class="col-6">
                                    <i class="material-icons text-sm">qr_code</i> <span class="text-xs">Aruco ID: ${loc.aruco_id}</span>
                                </div>
                                <div class="col-6 text-end">
                                    <p class="text-secondary text-sm font-weight-normal mb-0">${user.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            locationContainer.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    /**
     * Updates the top counter numbers (Pending, Approved, Rejected) based on the data
     */
    function updateStatusCounters(locations) {
        const pending = locations.filter(l => l.status.toLowerCase() === 'pending').length;
        const approved = locations.filter(l => l.status.toLowerCase() === 'approved').length;
        const rejected = locations.filter(l => l.status.toLowerCase() === 'rejected').length;

        const s1 = document.getElementById("status1");
        const s2 = document.getElementById("status2");
        const s3 = document.getElementById("status3");

        if (s1) s1.innerText = pending;
        if (s2) s2.innerText = approved;
        if (s3) s3.innerText = rejected;
    }

    // Initialize API call
    fetchUserLocations();

    // --- SIDE NAVIGATION LOGIC ---
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    if (openSideNav) {
        openSideNav.addEventListener("click", () => {
            document.getElementById("right-sidenav").style.width = "400px";
        });
    }

    if (closeSideNav) {
        closeSideNav.addEventListener("click", () => {
            document.getElementById("right-sidenav").style.width = "0";
        });
    }
    
    // --- DROPDOWN ROTATION LOGIC ---
    const droneToggle = document.querySelector('[data-bs-toggle="collapse"][href="#droneDropdown"]');
    const adminToggle = document.querySelector('[data-bs-toggle="collapse"][href="#adminDropdown"]');

    if (droneToggle) {
        const droneList = document.querySelector('#droneDropdown');
        const icon = droneToggle.querySelector('#droneDropdownIcon');
        droneList.addEventListener('show.bs.collapse', () => icon.classList.add('rotate-180'));
        droneList.addEventListener('hide.bs.collapse', () => icon.classList.remove('rotate-180'));
    }

    if (adminToggle) {
        const adminList = document.querySelector('#adminDropdown');
        const icon = adminToggle.querySelector('#adminDropdownIcon');
        adminList.addEventListener('show.bs.collapse', () => icon.classList.add('rotate-180'));
        adminList.addEventListener('hide.bs.collapse', () => icon.classList.remove('rotate-180'));
    }
});