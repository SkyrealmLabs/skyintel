document.addEventListener('DOMContentLoaded', () => {
    // --- Existing Sidebar/Dropdown Logic (Keep this as is) ---
    const openSideNav = document.getElementById("open-sidenav-button");
    const closeSideNav = document.getElementById("close-sidenav-button");

    if (openSideNav) openSideNav.addEventListener("click", openSidenav);
    if (closeSideNav) closeSideNav.addEventListener("click", closeSidenav);

    function openSidenav() { document.getElementById("right-sidenav").style.width = "400px"; }
    function closeSidenav() { document.getElementById("right-sidenav").style.width = "0"; }

    // (Include your existing Dropdown logic here...)

    // --- NEW: Pagination & API Logic ---

    // 1. Setup Global Variables
    let allLocationData = []; // Store all data from API
    let currentPage = 1;
    const rowsPerPage = 10;

    // 2. Initial Fetch
    fetchLocationData();

    // 3. Attach Event Listeners to Pagination Buttons
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        const totalPages = Math.ceil(allLocationData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // 4. Fetch Function
    async function fetchLocationData() {
        try {
            const response = await fetch('/api/location/get');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();

            if (result.data) {
                allLocationData = result.data; // Store full list
                updateDashboardCounts(allLocationData); // Update top cards
                currentPage = 1; // Reset to page 1
                renderTable(); // Render first page
            }
        } catch (error) {
            console.error("Failed to fetch locations:", error);
            document.querySelector('#datatable-basic tbody').innerHTML =
                `<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>`;
        }
    }

    // 5. Render Table (Slices data for current page)
    // 1. Make the function async
    async function renderTable() {
        const tbody = document.querySelector('#datatable-basic tbody');
        tbody.innerHTML = '';

        // Calculate start and end index for slicing
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;

        // Slice the data array
        const pageData = allLocationData.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No records found</td></tr>`;
            updatePaginationInfo(0, 0, 0);
            return;
        }

        // 2. Use a 'for...of' loop with entries() to get both index and item
        // This allows us to use 'await' inside the loop while maintaining row order
        for (const [index, item] of pageData.entries()) {
            const status = item.status ? item.status.toLowerCase() : 'unknown';
            const badgeInfo = getStatusBadge(status);
            const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
            const rowNumber = startIndex + index + 1;

            // 3. Await the encryption ID
            const encrypted = await encryptionID(item.id);

            const safeUrlId = encodeURIComponent(encrypted);

            const row = `
            <tr>
                <td class="text-sm font-weight-normal">${rowNumber}</td>
                
                <td class="text-sm font-weight-bold">
                    <a href="details/?id=${safeUrlId}" class="address-column" title="${item.locationAddress}">
                        ${item.locationAddress || 'N/A'}
                    </a>
                </td>

                <td class="text-sm font-weight-normal">${item.name || 'Unknown'}</td>
                <td class="text-sm font-weight-normal">${item.email || 'N/A'}</td>
                <td class="text-sm font-weight-normal">
                    <span class="badge ${badgeInfo.class}">${displayStatus}</span>
                </td>
                <td class="text-sm font-weight-normal">
                    <a href="details/?id=${encrypted}">
                        <i class="material-icons text-secondary position-relative text-lg">visibility</i>
                    </a>
                </td>
            </tr>
        `;
            tbody.insertAdjacentHTML('beforeend', row);
        }

        // Update buttons and text
        updatePaginationInfo(startIndex + 1, Math.min(endIndex, allLocationData.length), allLocationData.length);
    }

    // 6. Update Pagination Controls (Buttons & Text)
    function updatePaginationInfo(start, end, total) {
        const totalPages = Math.ceil(total / rowsPerPage);

        // Update Text
        const infoText = document.getElementById('page-info');
        infoText.innerText = `Showing ${start} to ${end} of ${total} entries`;

        // Update Buttons
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');

        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages || total === 0;
    }

    function updateDashboardCounts(data) {
        const pendingCount = data.filter(item => item.status.toLowerCase() === 'pending').length;
        const approvedCount = data.filter(item => item.status.toLowerCase() === 'approved').length;
        const rejectedCount = data.filter(item => item.status.toLowerCase() === 'rejected').length;

        document.getElementById('status-pending').innerText = pendingCount;
        document.getElementById('status-approved').innerText = approvedCount;
        document.getElementById('status-rejected').innerText = rejectedCount;
    }

    function getStatusBadge(status) {
        switch (status) {
            case 'approved': return { class: 'badge-success' };
            case 'rejected': return { class: 'badge-danger' };
            case 'pending': return { class: 'badge-warning' };
            default: return { class: 'badge-secondary' };
        }
    }
});