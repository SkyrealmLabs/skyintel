/**
 * Optimized Backend Handler for SkyIntel (Final Version)
 * Features:
 * - Smooth CSS Transitions for markers
 * - DOM Caching for high performance
 * - Google Maps Integration
 * - Fixed-Wing Fatal Crash Prediction (Kinematic Trajectory)
 * - Visual Safety Alerts (Pulsing Icons & Warning Triangles)
 */

let parameter_config = {};
let simulatedDroneArr = [];
let selectedDroneID = -1; // -1 means no drone selected
let isHMBData = false;
let warningAudio = null; // Single audio instance

// State Tracking
const drawnWaypoints = new Map();
const targetMarkers = {};
const droneTargetStates = {};
const dronePreviousPositions = {};
const locationLegend = L.control({ position: 'bottomright' });
const handledFatalStates = new Set();
const conflictedDrones = new Set();
const objectDetectionMarkers = new Map();
const droneMarkers = {};

// <<< OPTIMIZATION: DOM CACHE >>>
// Stores references to specific DOM elements to prevent expensive lookups
const droneUICache = new Map();

const tokenKey = "ePRvptm58jaEIhCQW8I7JMZyAzkT6Ys9";

// Inject CSS for smooth marker transitions AND Fatal Pulse Effect
const style = document.createElement('style');
style.innerHTML = `
    .smooth-drone-icon {
        transition: transform 0.5s linear;
        will-change: transform;
    }
    .location-legend-container {
        background-color: rgba(255, 255, 255, 0.7); 
        padding: 10px; 
        border-radius: 5px; 
        color: black; 
        font-size: 16px;
    }
    /* Fatal Error Pulsing Animation */
    @keyframes pulse-red {
        0% { filter: drop-shadow(0 0 0 rgba(255, 0, 0, 0.7)); }
        50% { filter: drop-shadow(0 0 15px rgba(255, 0, 0, 1)); }
        100% { filter: drop-shadow(0 0 0 rgba(255, 0, 0, 0.7)); }
    }
    .fatal-drone-icon {
        animation: pulse-red 1s infinite; /* Flashes every 1 second */
        z-index: 1000 !important; /* Keep on top */
    }
    .blinking-icon {
        animation: blink 1s infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", function () {
    // 1. Map Setup
    var map = L.map('map').setView([5.15233, 100.49557], 18);

    // Check for Google Mutant Plugin
    if (L.gridLayer.googleMutant) {
        var googleRoadmap = L.gridLayer.googleMutant({
            type: 'roadmap' // Options: 'roadmap', 'satellite', 'terrain', 'hybrid'
        }).addTo(map);
    } else {
        console.error("Google Mutant plugin not loaded. Please check index.html");
        // Fallback to OSM if Google fails
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    }

    // 2. Load Obstacles
    function loadObstacles() {
        fetch('./assets/js/obstacle.geojson')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                L.geoJSON(data, {
                    style: { color: "#e60000", weight: 2, opacity: 0.8, fillColor: "#ff4d4d", fillOpacity: 0.4 },
                    onEachFeature: (feature, layer) => layer.bindPopup('<strong>Obstacle Area</strong>')
                }).addTo(map);
            })
            .catch(error => console.error('Error loading obstacle data:', error));
    }
    loadObstacles();

    // 3. Legend Setup
    locationLegend.onAdd = function () {
        const div = L.DomUtil.create('div', 'location-legend');
        div.innerHTML = `
            <div class="location-legend-container">
                <h5>Target Locations</h5>
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="background-color: red; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> Pickup Point
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="background-color: blue; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> Dropoff Point
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="background-color: green; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> Home Point
                </div>
            </div>`;
        return div;
    };
    locationLegend.addTo(map);

    // 4. Icons
    const flightIcon = L.Icon.extend({
        options: {
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            className: 'smooth-drone-icon'
        }
    });

    var greenDroneIcon = new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-green.png' });
    var redDroneIcon = new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-red.png' });
    var orangeDroneIcon = new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-orange.png' });
    var blueDroneIcon = new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-blue.png' });

    const targetIcons = {
        pickup: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        dropoff: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        home: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-green.png', iconSize: [25, 41], iconAnchor: [12, 41] })
    };

    // 5. Event Listeners (Delegated)
    function setupEventListeners() {
        document.body.addEventListener('click', function (e) {
            // Handle Recenter Click
            if (e.target.closest('.recenter')) {
                const icon = e.target.closest('.recenter');
                const droneId = parseInt(icon.dataset.droneId, 10);

                const wasActive = icon.classList.contains('active');
                document.querySelectorAll('.recenter').forEach(el => {
                    el.classList.remove('active');
                    el.classList.add('inactive');
                });

                if (!wasActive) {
                    selectedDroneID = droneId;
                    icon.classList.add('active');
                    icon.classList.remove('inactive');
                } else {
                    selectedDroneID = -1;
                }
                e.stopPropagation();
            }

            // Prevent map clicks from bubbling when interacting with switch
            if (e.target.closest('.btn-color-mode-switch input')) {
                e.stopPropagation();
            }
        });

        // HMB Toggle Listener
        document.addEventListener('change', function (e) {
            if (e.target.name === 'data_mode') {
                isHMBData = !e.target.checked;
            }
        });
    }
    setupEventListeners();


    // ==========================================
    // ===       OPTIMIZED DATA FETCH LOOP    ===
    // ==========================================

    async function runDataLoop() {
        const droneApiURL = 'https://gcs.zulsyah.com/rpi_drone_feedback?token=' + tokenKey;
        const missionApiURL = 'https://gcs.zulsyah.com/active_mission_list?token=' + tokenKey;
        const hmbApiURL = 'https://gcs.zulsyah.com/hmb_drone_feedback?token=' + tokenKey;
        const options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };

        try {
            // Promise.allSettled ensures one failed request doesn't kill the app
            const results = await Promise.allSettled([
                fetch(droneApiURL, options).then(r => r.ok ? r.json() : {}),
                fetch(missionApiURL, options).then(r => r.ok ? r.json() : []),
                fetch(hmbApiURL, options).then(r => r.ok ? r.json() : {})
            ]);

            const droneData = results[0].status === 'fulfilled' ? results[0].value : {};
            const missionData = results[1].status === 'fulfilled' ? results[1].value : [];
            const hmbData = results[2].status === 'fulfilled' ? results[2].value : {};

            updateDroneState(droneData);
            updateMapElements(droneData);
            updateUserInterface();
            updateMissionDetails(missionData);

        } catch (error) {
            console.error("Data Loop Error:", error);
        }

        // Recursive call: waits for previous finish before starting new one (avoids stacking)
        setTimeout(runDataLoop, 500);
    }

    // Start the loop
    runDataLoop();


    // ==========================================
    // ===        LOGIC & STATE UPDATES       ===
    // ==========================================

    function updateDroneState(droneData) {
        if (!droneData) return;

        Object.values(droneData).forEach(liveDrone => {
            let droneToUpdate = simulatedDroneArr.find(d => d.id === liveDrone.id);

            if (!droneToUpdate) {
                // New Drone Found
                droneToUpdate = {
                    id: liveDrone.id,
                    feedback: {},
                    eta: {},
                    connectivity: {},
                    object_detection: []
                };
                simulatedDroneArr.push(droneToUpdate);

                // Initialize Marker
                const newMarker = L.marker([2.9100729431148187, 101.65520813904638], { icon: greenDroneIcon });
                newMarker.addTo(map).bindPopup(`<div class="droneInfo">Drone ID : ${liveDrone.id}</div>`);
                droneMarkers[liveDrone.id] = newMarker;
            }

            // Update properties
            Object.assign(droneToUpdate.feedback, liveDrone.feedback);
            droneToUpdate.eta = liveDrone.eta;
            droneToUpdate.connectivity = liveDrone.connectivity;
            droneToUpdate.object_detection = liveDrone.object_detection;
            droneToUpdate.healthState = liveDrone.healthState || {};
        });
    }

    function updateMapElements(droneData) {
        const liveDroneIds = new Set();
        const allSeenObjectKeys = new Set();
        const nonMissionStates = new Set(['N/A', 'Idle', 'Ready', 'Landed', 'Mission finished']);

        // 1. Process Live Drones
        Object.values(droneData).forEach(drone => {
            liveDroneIds.add(drone.id);

            // --- Marker Update Logic ---
            const marker = droneMarkers[drone.id];
            if (marker) {
                const newLatLng = L.latLng(drone.feedback.currentPosition[0], drone.feedback.currentPosition[1]);
                marker.setLatLng(newLatLng); // CSS transition handles smoothing

                if (typeof marker.setRotationAngle === 'function') {
                    marker.setRotationAngle(drone.feedback.currentHeading);
                }

                // >>> UPDATED ICON PRIORITY LOGIC <<<
                const isFatal = drone.feedback.fsmState === 'Fatal error';

                if (isFatal) {
                    // Priority 1: Fatal Error
                    marker.setIcon(redDroneIcon); // Pastikan ini greenDroneIcon, BUKAN redDroneIcon
                    if (marker._icon) marker._icon.classList.add('fatal-drone-icon');
                } else if (selectedDroneID === drone.id) {
                    // Priority 2: Selected (Red, no pulse)
                    marker.setIcon(blueDroneIcon);
                    if (!userZooming) map.setView(newLatLng);
                    if (marker._icon) marker._icon.classList.remove('fatal-drone-icon');
                } else {
                    // Priority 3: Normal (Green)
                    if (marker.options.icon !== greenDroneIcon) marker.setIcon(greenDroneIcon);
                    if (marker._icon) marker._icon.classList.remove('fatal-drone-icon');
                }
            }

            // --- Path History Logic ---
            if (!nonMissionStates.has(drone.feedback.fsmState)) {
                updateDroneHistoricalPath(drone);
            } else {
                clearDroneHistoricalPath(drone.id);
            }

            // --- Object Detection Logic ---
            if (drone.object_detection && Array.isArray(drone.object_detection)) {
                drone.object_detection.forEach(obj => {
                    if (!obj?.object_id || !obj?.position || obj.position.length < 2) return;
                    const objectKey = `${drone.id}-${obj.object_id}`;
                    allSeenObjectKeys.add(objectKey);

                    const objPos = L.latLng(obj.position[0], obj.position[1]);
                    if (objectDetectionMarkers.has(objectKey)) {
                        objectDetectionMarkers.get(objectKey).setLatLng(objPos);
                    } else {
                        const m = L.circleMarker(objPos, { radius: 8, color: 'orange', fillColor: '#FFA500', fillOpacity: 0.6 })
                            .bindPopup(`<strong>Detected Object</strong><br>ID: ${obj.object_id}<br>Class: ${obj.class_name}`)
                            .addTo(map);
                        objectDetectionMarkers.set(objectKey, m);
                    }
                });
            }

            updateTargetMarkers(drone);

            if (drone.feedback.fsmState === 'Fatal error' && !handledFatalStates.has(drone.id)) {
                handleFatalError(drone);
            }
        });

        // 2. Cleanup Stale Detection Markers
        objectDetectionMarkers.forEach((marker, key) => {
            if (!allSeenObjectKeys.has(key)) {
                map.removeLayer(marker);
                objectDetectionMarkers.delete(key);
            }
        });

        // 3. Cleanup Disconnected Drones
        // We iterate backwards to safely remove items from the array
        for (let i = simulatedDroneArr.length - 1; i >= 0; i--) {
            const drone = simulatedDroneArr[i];

            // If the drone is NOT in the latest live data
            if (!liveDroneIds.has(drone.id)) {
                if (droneMarkers[drone.id]) {
                    map.removeLayer(droneMarkers[drone.id]);
                    delete droneMarkers[drone.id];
                }
                clearDroneHistoricalPath(drone.id);
                if (targetMarkers[drone.id]) {
                    map.removeLayer(targetMarkers[drone.id]);
                    delete targetMarkers[drone.id];
                }
                // Remove from Data Array (so UI updates automatically next cycle)
                simulatedDroneArr.splice(i, 1);
            }
        }
    }

    // ==========================================
    // ===    OPTIMIZED UI UPDATES (CACHE)    ===
    // ==========================================

    function updateUserInterface() {
        const query = document.getElementById("searchQueryInput").value.trim().toLowerCase();

        // Filter Data
        const filteredDrones = simulatedDroneArr.filter(drone => {
            if (drone.feedback.connectionStatus !== 'Connected') return false;
            if (!query) return true;
            return drone.id.toString().includes(query);
        });

        const droneDataContainer = document.getElementById("droneDataContainer");
        const visibleDroneIds = new Set(filteredDrones.map(d => d.id));

        // 1. Remove UI elements for drones that are gone or filtered out
        droneUICache.forEach((cache, id) => {
            if (!visibleDroneIds.has(id)) {
                const el = document.getElementById(`accordion-item-${id}`);
                if (el) el.remove();
                droneUICache.delete(id);
            }
        });

        // 2. Create or Update UI Elements
        filteredDrones.forEach(drone => {
            if (!droneUICache.has(drone.id)) {
                createDroneUIElement(drone, droneDataContainer);
            }
            updateDroneUIElement(drone);
            handleDroneWarningsAndButtons(drone);
        });

        // 3. "No Drones" message
        let noDronesMsg = droneDataContainer.querySelector('.no-drones-message');
        if (filteredDrones.length === 0) {
            if (!noDronesMsg) {
                droneDataContainer.insertAdjacentHTML('beforeend',
                    `<div class="no-drones-message" style="text-align: center; padding: 20px; color: #888;">No online drones found.</div>`);
            }
        } else if (noDronesMsg) {
            noDronesMsg.remove();
        }
    }

    function createDroneUIElement(drone, container) {
        // One-time creation of the HTML structure
        const div = document.createElement('div');
        div.className = 'accordion-item';
        div.id = `accordion-item-${drone.id}`;
        div.dataset.droneId = drone.id;

        // Attributes added for switch toggles
        div.innerHTML = `
            <h6 class="accordion-header" id="heading-${drone.id}">
                <div class="accordion-button collapsed">
                    <img src="./assets/img/icons/svg/blue-drone.svg" alt="Drone Icon">
                    <span class="accordion-drone-name flex-grow-1" data-bs-toggle="collapse" data-bs-target="#collapse-${drone.id}" style="cursor: pointer;">
                        Drone ${drone.id}
                    </span>
                    <span class="ms-auto d-flex align-items-center gap-2">
                         <i id="health-btn-${drone.id}" class="bi bi-info-circle-fill health-icon-btn text-success" 
                           onclick="toggleHealthPanel(${drone.id}, event)"></i>
                        <div id="error-state-${drone.id}"></div>
                        <div class="signal-bar" id="signal-bar-${drone.id}"></div>
                        <i class="recenter bi bi-cursor-fill inactive" data-drone-id="${drone.id}"></i>
                        
                        <label class="switch btn-color-mode-switch">
                            <input type="checkbox" name="data_mode" id="data_mode-${drone.id}" value="1" data-drone-id="${drone.id}">
                            <label for="data_mode-${drone.id}" data-on="HMB" data-off="RPI" class="btn-color-mode-switch-inner"></label>
                        </label>
                    </span>
                </div>
            </h6>
            <div id="collapse-${drone.id}" class="accordion-collapse collapse">
                <div class="accordion-body">
                    <hr class="horizontal dark my-1">
                    <span><strong>Connection Status:</strong> <span id="conn-status-${drone.id}" class="connected"></span></span>
                    <p><strong>Drone Timestamp:</strong> <span id="ts-${drone.id}"></span></p>
                    <p><strong>FSM State:</strong> <span id="fsm-${drone.id}"></span></p>
                    <p><strong>Current Altitude:</strong> <span id="alt-${drone.id}"></span> m</p>
                    <p><strong>Current Position:</strong> <span id="pos-${drone.id}"></span></p>
                    <p><strong>Current Speed:</strong> <span id="spd-${drone.id}"></span> m/s</p>
                    <p><strong>Heading:</strong> <span id="head-${drone.id}"></span>°</p>
                    <p><strong>Distance to Target:</strong> <span id="dist-${drone.id}"></span> m</p>
                    
                    <p><strong>Battery Level:</strong> <span id="batt-${drone.id}"></span> %</p>
                    
                    <p><strong>Battery Health:</strong> <span id="batt-soh-${drone.id}"></span></p>
                    <hr class="horizontal dark my-1" style="border-top: 1px dashed #ccc;"> <p><strong>ETA Pickup:</strong> <span id="eta-p-${drone.id}"></span></p>
                    <p><strong>ETA Dropoff:</strong> <span id="eta-d-${drone.id}"></span></p>
                    <p><strong>ETA Home:</strong> <span id="eta-h-${drone.id}"></span></p>
                    <p><strong>Signal:</strong> <span id="sig-txt-${drone.id}"></span></p>
                </div>
                <div id="rtl-button-${drone.id}" class="rtl-button"></div>
            </div>`;

        container.appendChild(div);

        // Cache references
        droneUICache.set(drone.id, {
            connStatus: div.querySelector(`#conn-status-${drone.id}`),
            ts: div.querySelector(`#ts-${drone.id}`),
            fsm: div.querySelector(`#fsm-${drone.id}`),
            alt: div.querySelector(`#alt-${drone.id}`),
            pos: div.querySelector(`#pos-${drone.id}`),
            spd: div.querySelector(`#spd-${drone.id}`),
            head: div.querySelector(`#head-${drone.id}`),
            dist: div.querySelector(`#dist-${drone.id}`),
            batt: div.querySelector(`#batt-${drone.id}`),
            battSOH: div.querySelector(`#batt-soh-${drone.id}`),
            etaP: div.querySelector(`#eta-p-${drone.id}`),
            etaD: div.querySelector(`#eta-d-${drone.id}`),
            etaH: div.querySelector(`#eta-h-${drone.id}`),
            sigTxt: div.querySelector(`#sig-txt-${drone.id}`),
            signalBar: div.querySelector(`#signal-bar-${drone.id}`),
            rtlBtnContainer: div.querySelector(`#rtl-button-${drone.id}`),
            errorState: div.querySelector(`#error-state-${drone.id}`)
        });
    }

    function updateDroneUIElement(drone) {
        const cache = droneUICache.get(drone.id);
        if (!cache) return;

        const f = drone.feedback;
        const eta = drone.eta;
        // Ambil data healthState (pastikan wujud)
        const health = drone.healthState || {};

        // Update textContent bias (pantas)
        cache.connStatus.textContent = f.connectionStatus;
        cache.ts.textContent = convertToReadableTimestamp(f.droneTimestamp);
        cache.fsm.textContent = f.fsmState;
        cache.alt.textContent = f.currentAltitude;
        cache.pos.textContent = `[${f.currentPosition.map(n => n.toFixed(5)).join(", ")}]`;
        cache.spd.textContent = f.currentSpeed.toFixed(2);
        cache.head.textContent = f.currentHeading.toFixed(2);
        cache.dist.textContent = f.distToTarget.toFixed(1);
        cache.batt.textContent = f.batteryLevel.toFixed(1);

        // ==========================================
        // ===      LOGIK BATTERY HEALTH SOH      ===
        // ==========================================
        const sohValue = health.batterySOH || "N/A";
        let dotClass = "dot-na";
        let textClass = "";

        // Tentukan warna berdasarkan string SOH
        if (sohValue === "Healthy" || sohValue === "Good") {
            dotClass = "dot-healthy";
            textClass = "text-healthy";
        } else if (sohValue === "Aging") {
            dotClass = "dot-aging";
            textClass = "text-aging";
        } else if (sohValue === "Degraded" || sohValue === "Bad") {
            dotClass = "dot-degraded";
            textClass = "text-degraded";
        }

        // Render HTML Dot + Teks
        cache.battSOH.innerHTML = `<span class="status-dot ${dotClass}"></span><span class="${textClass}">${sohValue}</span>`;
        // ==========================================

        cache.etaP.textContent = timeFormat(eta.pickup);
        cache.etaD.textContent = timeFormat(eta.dropoff);
        cache.etaH.textContent = timeFormat(eta.rtl);

        const rsrp = getRSRPQuality(drone.connectivity?.lteRSRP);
        cache.sigTxt.innerHTML = `<span style="color:${rsrp.color}; font-weight:bold;">${rsrp.label}</span>`;

        const newSignalHTML = generateSignalBars(rsrp.level);
        if (cache.signalBar.innerHTML !== newSignalHTML) {
            cache.signalBar.innerHTML = newSignalHTML;
        }
    }

    function handleDroneWarningsAndButtons(drone) {
        const cache = droneUICache.get(drone.id);
        if (!cache) return;

        const fsmState = (drone.feedback.fsmState || '').toLowerCase();
        const isFatal = fsmState === 'fatal error';
        const isDaaConflict = fsmState === 'forward daa conflict';
        const droneId = drone.id;
        const displayId = (droneId === 1000) ? 0 : droneId;
        const hasActiveMission = !['n/a', 'idle', 'ready', 'landed', 'mission finished'].includes(fsmState);

        // --- RTL Button ---
        if (hasActiveMission && !cache.rtlBtnContainer.hasChildNodes()) {
            const rtlBtn = document.createElement('button');
            rtlBtn.textContent = 'RTL';
            rtlBtn.className = 'btn btn-warning w-100 justify-content-center';
            rtlBtn.onclick = () => sendRTLCommandToDrone(displayId);
            cache.rtlBtnContainer.innerHTML = '';
            cache.rtlBtnContainer.appendChild(rtlBtn);
        } else if (!hasActiveMission) {
            cache.rtlBtnContainer.innerHTML = '';
        }

        // --- ERROR ICONS (Fatal & Conflict) ---
        let errorIconsHTML = '';

        // 1. FATAL ICON
        if (isFatal) {
            errorIconsHTML += `<i class="bi bi-exclamation-triangle-fill text-danger fs-5 blinking-icon me-2" title="FATAL ERROR"></i>`;
        }

        // 2. CONFLICT ICON
        if (isDaaConflict) {
            if (!conflictedDrones.has(droneId)) {
                showModernToast('warning', 'Warning!', `Forward DAA conflict: Drone ${droneId}`);

                const proceedBtn = document.createElement('button');
                proceedBtn.textContent = 'Proceed';
                proceedBtn.className = 'btn btn-info w-100 justify-content-center mt-1';
                proceedBtn.onclick = () => proceedWithMission(displayId);
                cache.rtlBtnContainer.appendChild(proceedBtn);

                requestDroneVideoStream(displayId, document.getElementById("drone-video-feed"));
                conflictedDrones.add(droneId);
            }
            errorIconsHTML += `<i class="bi bi-exclamation-triangle-fill text-warning fs-5 blinking-icon me-2" title="DAA Conflict"></i>`;
        } else {
            if (conflictedDrones.has(droneId)) {
                const streamContainer = document.getElementById(`drone-stream-container-${displayId}`);
                if (streamContainer) streamContainer.remove();
                conflictedDrones.delete(droneId);
                fetch(`https://gcs.zulsyah.com/disconnect_drone_camera/${displayId}?token=${tokenKey}`).catch(e => console.error(e));
            }
        }

        cache.errorState.innerHTML = errorIconsHTML;

        // --- AUDIO ALERT ---
        if ((conflictedDrones.size > 0 || handledFatalStates.size > 0) && !warningAudio) {
            warningAudio = new Audio('../assets/audio/warning-alert.mp3');
            warningAudio.loop = true;
            warningAudio.play().catch(e => console.warn(e));
        } else if (conflictedDrones.size === 0 && handledFatalStates.size === 0 && warningAudio) {
            warningAudio.pause();
            warningAudio = null;
        }

        // 1. Dapatkan elemen butang info
        const infoBtn = document.getElementById(`health-btn-${drone.id}`);

        if (infoBtn) {
            const overallStatus = calculateOverallHealth(drone.healthState);

            infoBtn.className = "bi health-icon-btn";

            if (overallStatus === 'error') {
                // Merah & Pangkah
                infoBtn.classList.add('bi-x-circle-fill', 'text-danger');
            }
            else if (overallStatus === 'warning') {
                // Kuning & Segitiga Amaran
                infoBtn.classList.add('bi-exclamation-triangle-fill', 'text-warning');
            }
            else {
                infoBtn.classList.add('bi-check-circle-fill', 'text-success');
            }
        }
    }

    // ==========================================
    // ===          UTILITY FUNCTIONS         ===
    // ==========================================

    function updateTargetMarkers(drone) {
        const targetPos = drone.feedback.targetPosition;
        if (targetPos && targetPos[0] !== 0) {
            if (!droneTargetStates[drone.id]) droneTargetStates[drone.id] = 'pickup';

            const prevPos = dronePreviousPositions[drone.id];
            if (!prevPos || prevPos[0] !== targetPos[0] || prevPos[1] !== targetPos[1]) {
                dronePreviousPositions[drone.id] = targetPos;

                let type = droneTargetStates[drone.id];
                if (type === 'pickup') droneTargetStates[drone.id] = 'dropoff';
                else if (type === 'dropoff') droneTargetStates[drone.id] = 'home';
                else if (type === 'home') delete droneTargetStates[drone.id];

                if (type) {
                    const latLng = L.latLng(targetPos[0], targetPos[1]);
                    if (targetMarkers[drone.id]) {
                        targetMarkers[drone.id].setLatLng(latLng).setIcon(targetIcons[type]);
                    } else {
                        targetMarkers[drone.id] = L.marker(latLng, { icon: targetIcons[type] }).addTo(map);
                    }
                }
            }
        }
    }

    // function handleFatalError(drone) {
    //     console.log(`Fatal Error Drone ${drone.id}`);
    //     const pos = drone.feedback.currentPosition;
    //     const range = drone.feedback.currentAltitude * 5; 
    //     L.circle(pos, { color: 'red', fillColor: '#f03', fillOpacity: 0.5, radius: range }).addTo(map);
    //     handledFatalStates.add(drone.id);
    // }

    function handleFatalError(drone) {
        if (handledFatalStates.has(drone.id)) return;

        console.log(`Fatal Error Drone ${drone.id}`);
        const pos = drone.feedback.currentPosition;
        const alt = drone.feedback.currentAltitude;
        const heading = drone.feedback.currentHeading;
        const speed = drone.feedback.currentSpeed;

        // 1. Safety Perimeter
        const safetyRadius = alt * 5;
        L.circle(pos, {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.1,
            weight: 1,
            radius: safetyRadius
        }).addTo(map);

        // 2. Kinematic Distance (Speed * Time)
        const estimatedSinkRate = 3.0; // Fixed Wing Sink Rate assumption
        const timeToImpact = alt / estimatedSinkRate;
        let estimatedDistance = (speed > 1) ? (speed * timeToImpact) : (alt * 4.0);
        if (estimatedDistance > safetyRadius) estimatedDistance = safetyRadius;

        // 3. Project Crash Coordinate
        const earthRadius = 6371000;
        const latRad = pos[0] * (Math.PI / 180);
        const lngRad = pos[1] * (Math.PI / 180);
        const headingRad = heading * (Math.PI / 180);

        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(estimatedDistance / earthRadius) +
            Math.cos(latRad) * Math.sin(estimatedDistance / earthRadius) * Math.cos(headingRad));

        const newLngRad = lngRad + Math.atan2(Math.sin(headingRad) * Math.sin(estimatedDistance / earthRadius) * Math.cos(latRad),
            Math.cos(estimatedDistance / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad));

        const crashPos = [newLatRad * (180 / Math.PI), newLngRad * (180 / Math.PI)];

        // 4. Trajectory Line (Orange Dashed)
        L.polyline([pos, crashPos], {
            color: 'orange',
            weight: 4,
            dashArray: '10, 10',
            opacity: 0.9
        }).addTo(map);

        // 5. Crash Marker
        const crashIcon = L.divIcon({
            className: 'crash-marker-icon',
            html: `<div style="
                background-color: #000; 
                color: #FFD700; 
                border: 3px solid #FF4500; 
                border-radius: 50%; 
                width: 35px; 
                height: 35px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-weight: 900;
                font-family: sans-serif;
                font-size: 16px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);">!</div>`,
            iconSize: [35, 35],
            iconAnchor: [17, 17]
        });

        L.marker(crashPos, { icon: crashIcon })
            .bindPopup(`
                <div style="text-align:center; min-width: 150px;">
                    <strong style="color:#d9534f; font-size:14px;">PROJECTED IMPACT</strong>
                    <hr style="margin:5px 0;">
                    <div style="text-align:left; font-size:12px;">
                        <strong>Current Speed:</strong> ${speed.toFixed(1)} m/s<br>
                        <strong>Est. Fall Time:</strong> ${timeToImpact.toFixed(1)} s<br>
                        <strong>Impact Dist:</strong> ${estimatedDistance.toFixed(0)} m
                    </div>
                </div>`)
            .addTo(map).openPopup();

        handledFatalStates.add(drone.id);
    }

    async function updateDroneHistoricalPath(drone) {
        try {
            const res = await fetch(`https://gcs.zulsyah.com/drone_historical_path/${drone.id}?token=${tokenKey}`);
            if (!res.ok) return;
            const pathData = await res.json();
            if (!Array.isArray(pathData) || pathData.length < 2) return;

            const validPath = pathData.filter(p => p[0] !== 0);
            if (droneMarkers[drone.id].historicalPath) {
                droneMarkers[drone.id].historicalPath.setLatLngs(validPath);
            } else {
                droneMarkers[drone.id].historicalPath = L.polyline(validPath, { color: 'blue' }).addTo(map);
            }
        } catch (e) { /* ignore */ }
    }

    function clearDroneHistoricalPath(id) {
        if (droneMarkers[id]?.historicalPath) {
            map.removeLayer(droneMarkers[id].historicalPath);
            delete droneMarkers[id].historicalPath;
        }
    }

    function convertToReadableTimestamp(ts) {
        if (!ts) return 'N/A';
        return new Date(ts).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    }

    function timeFormat(eta) {
        if (!eta || eta === "N/A") return "N/A";
        return new Date(eta).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true });
    }

    function getRSRPQuality(rsrp) {
        if (rsrp == null || isNaN(rsrp)) return { label: "N/A", color: "gray", level: 0 };
        if (rsrp >= -80) return { label: "Excellent", color: "green", level: 4 };
        if (rsrp >= -90) return { label: "Good", color: "limegreen", level: 3 };
        if (rsrp >= -100) return { label: "Fair", color: "orange", level: 2 };
        if (rsrp >= -120) return { label: "Weak", color: "red", level: 1 };
        return { label: "No Signal", color: "darkred", level: 0 };
    }

    function generateSignalBars(level) {
        let bars = '';
        for (let i = 1; i <= 4; i++) bars += `<span class="bar ${i <= level ? 'active' : ''}"></span>`;
        return bars;
    }

    function sendRTLCommandToDrone(id) {
        fetch('https://gcs.zulsyah.com/request_rtl?token=' + tokenKey, {
            method: 'POST', body: JSON.stringify({ drone_id: id }), headers: { 'Content-Type': 'application/json' }
        }).then(() => showModernToast('success', 'Success', `RTL sent to Drone ${id}`));
    }

    function proceedWithMission(id) {
        fetch('https://gcs.zulsyah.com/resume_mission?token=' + tokenKey, {
            method: 'POST', body: JSON.stringify({ drone_id: id }), headers: { 'Content-Type': 'application/json' }
        }).then(() => showModernToast('info', 'Info', `Mission Resumed Drone ${id}`));
    }

    function requestDroneVideoStream(droneId, container) {
        if (!container) return;
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.id = `drone-stream-container-${droneId}`;
        wrapper.style.cssText = "position: relative; width: 420px; height: 240px; border: 2px solid #ccc; background: #000; z-index: 10000;";

        const img = document.createElement('img');
        img.src = `https://gcs.zulsyah.com/drone_camera/${droneId}?token=${tokenKey}`;
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";

        const close = document.createElement('i');
        close.className = 'bi bi-x-circle-fill';
        close.style.cssText = "position: absolute; top: 5px; right: 5px; color: white; cursor: pointer; font-size: 20px;";
        close.onclick = () => {
            wrapper.remove();
            fetch(`https://gcs.zulsyah.com/disconnect_drone_camera/${droneId}?token=${tokenKey}`);
        };

        wrapper.append(img, close);
        container.appendChild(wrapper);
    }

    function calculateOverallHealth(healthState) {
        if (!healthState) return 'good'; // Default Good jika tiada data

        const values = Object.values(healthState).map(v => v.toLowerCase());

        // 1. Priority TERTINGGI: Danger/Error
        if (values.includes('error') || values.includes('danger') || values.includes('fail')) {
            return 'error';
        }

        // 2. Priority SEDERHANA: Warning
        if (values.includes('warning')) {
            return 'warning';
        }

        // 3. Jika tiada isu
        return 'good';
    }

    function updateMissionDetails(missionData) {
        if (!Array.isArray(missionData)) return;

        missionData.forEach(m => {
            if (m.mission_complete) {
                if (drawnWaypoints.has(m.mission_id)) {
                    drawnWaypoints.get(m.mission_id).forEach(l => map.removeLayer(l));
                    drawnWaypoints.delete(m.mission_id);
                }
                return;
            }
            if (drawnWaypoints.has(m.mission_id)) return;

            const layers = [];
            const draw = (coords, col) => {
                if (coords && coords.length > 1) layers.push(L.polyline(coords, { color: col }).addTo(map));
            };
            if (m.afpp_waypoints) {
                draw(m.afpp_waypoints.pickup, "grey");
                draw(m.afpp_waypoints.dropoff, "grey");
                draw(m.afpp_waypoints.rtl, "grey");
            }
            if (layers.length > 0) drawnWaypoints.set(m.mission_id, layers);
        });
    }

    let userZooming = false;
    map.on('zoomstart', () => userZooming = true);
    map.on('zoomend', () => userZooming = false);

    function showModernToast(type, title, message) {
        const container = document.getElementById('modern-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `modern-toast toast-${type}`;
        toast.innerHTML = `<div class="toast-content"><strong>${title}</strong><br>${message}</div>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    const searchInput = document.getElementById("searchQueryInput");
    if (searchInput) {
        searchInput.addEventListener("input", updateUserInterface);
    }

    // 1. Data Mock untuk simulasi Health Check (Dikemaskini dengan Good/Warning/Error)
    function getHealthStatus(droneId) {
        // Helper function untuk menjana status secara rawak
        // Kebarangkalian: 70% Good, 20% Warning, 10% Error
        function getRandomStatus() {
            const rand = Math.random();
            if (rand > 0.3) return "Good";
            if (rand > 0.1) return "Warning";
            return "Error";
        }

        // Kita tetapkan beberapa sistem kritikal sentiasa "Good" untuk demo yang kemas,
        // manakala sensor lain berubah-ubah.
        return [
            { name: "Mavlink Communication", status: "Good" },
            { name: "Left LIDAR", status: getRandomStatus() },
            { name: "Main LIDAR", status: "Good" },
            { name: "Right LIDAR", status: getRandomStatus() },
            { name: "Forward Camera", status: "Good" },
            { name: "Downward Camera", status: getRandomStatus() },
            { name: "Winch Module", status: "Good" },
            { name: "PRS Module", status: getRandomStatus() },
            { name: "Health Monitoring Module", status: "Good" }
        ];
    }

    // 2. Fungsi untuk Render Icon berdasarkan status (Good/Warning/Error)
    function getStatusIcon(status) {
        if (!status) return `<span>-</span>`; // Handle jika data tiada

        const s = status.toLowerCase();

        // Tambah check untuk 'healthy'
        if (s === 'good' || s === 'ok' || s === 'healthy') {
            return `<i class="bi bi-check-circle-fill status-icon ok" style="color: #4CAF50; font-size: 20px;" title="${status}"></i>`;
        } else if (s === 'warning') {
            return `<i class="bi bi-exclamation-triangle-fill status-icon warning" style="color: #FFC107; font-size: 20px;" title="${status}"></i>`;
        } else if (s === 'error') {
            return `<i class="bi bi-x-circle-fill status-icon error" style="color: #F44336; font-size: 20px;" title="${status}"></i>`;
        } else {
            // Default untuk status lain (N/A dll)
            return `<span style="font-size: 12px; color: #777;">${status}</span>`;
        }
    }

    // 3. Fungsi Utama: Toggle Panel
    window.toggleHealthPanel = function (droneId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const panel = document.getElementById('health-side-panel');
        const contentDiv = document.getElementById('health-panel-content');

        // Toggle behavior: Tutup jika klik drone yang sama
        if (panel.classList.contains('open') && panel.dataset.activeDrone == droneId) {
            closeHealthPanel();
            return;
        }

        // 1. CARI DRONE DALAM ARRAY
        const drone = simulatedDroneArr.find(d => d.id === droneId);

        // Safety check jika drone atau healthState tiada
        const health = (drone && drone.healthState) ? drone.healthState : {};

        // 2. MAPPING: Tambah property 'icon' untuk setiap item
        const healthMapping = [
            { key: 'mavlink', label: 'Mavlink Communication', icon: 'bi-hdd-network' },
            { key: 'leftLidar', label: 'Left LIDAR', icon: 'bi-arrow-left-circle' },
            { key: 'mainLidar', label: 'Main LIDAR', icon: 'bi-bullseye' },
            { key: 'rightLidar', label: 'Right LIDAR', icon: 'bi-arrow-right-circle' },
            { key: 'forwardCamera', label: 'Forward Camera', icon: 'bi-camera-video' },
            { key: 'downwardCamera', label: 'Downward Camera', icon: 'bi-camera-video-fill' },
            { key: 'winchModule', label: 'Winch Module', icon: 'bi-gear-wide-connected' },
            { key: 'PRSmodule', label: 'PRS Module', icon: 'bi-shield-check' }, // Parachute/Safety
            { key: 'HMBmodule', label: 'Health Monitoring', icon: 'bi-heart-pulse' },
            { key: 'batterySOH', label: 'Battery SOH', icon: 'bi-battery-half' }
        ];

        let htmlContent = `<div class="p-3 bg-light border-bottom">
                            <h6 class="m-0 text-primary">Drone ${droneId} Diagnostics</h6>
                        </div>`;

        // 3. LOOP MAPPING UNTUK GENERATE LIST
        healthMapping.forEach(item => {
            // Ambil status dari object health, default ke 'N/A' jika tiada
            const currentStatus = health[item.key] || "N/A";

            htmlContent += `
                <div class="health-item">
                    <div class="d-flex align-items-center">
                        <i class="bi ${item.icon} me-3 text-secondary" style="font-size: 1.1rem;"></i>
                        <span>${item.label}</span>
                    </div>
                    
                    ${getStatusIcon(currentStatus)}
                </div>
            `;
        });

        contentDiv.innerHTML = htmlContent;
        panel.dataset.activeDrone = droneId;
        panel.classList.add('open');
    };

    window.closeHealthPanel = function () {
        const panel = document.getElementById('health-side-panel');
        panel.classList.remove('open');
        // panel.dataset.activeDrone = ""; // Optional: Boleh reset jika perlu
    };

    // 5. Pastikan panel tutup jika pengguna klik di peta (optional UX improvement)
    document.addEventListener('click', function (e) {
        const panel = document.getElementById('health-side-panel');
        const fixedPlugin = document.querySelector('.fixed-plugin');

        // Jika klik diluar panel health DAN diluar sidebar utama, tutup panel health
        if (!panel.contains(e.target) && !fixedPlugin.contains(e.target) && panel.classList.contains('open')) {
            closeHealthPanel();
        }
    });
});