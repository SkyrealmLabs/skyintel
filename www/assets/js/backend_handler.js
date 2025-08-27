let parameter_config = {};
let simulatedDroneArr = []; // This will be the master array for UI state
let fetchedDroneArr = [];
let selectedDroneID = -1;
let dronePaths = [];
let droneCoordinate = [];
let isViewed = false;
let multi_drone_indicator = [];
let targetPositionMarkers = [];
let previousTargetPositions = [];
let targetPositionChangeCounters = [];
let droneMarkers = []; // Store markers for each drone
let selectedDrone = -1;
let wasZoomed = false;
let userZooming = false;
let isHMBData = false;
const drawnWaypoints = new Map();

const targetMarkers = {};
const droneTargetStates = {};
const dronePreviousPositions = {};
const locationLegend = L.control({ position: 'bottomright' });
const handledFatalStates = new Set();
const fatalCoordinates = {};
const renderedDrones = new Set();
const conflictedDrones = new Set();

document.addEventListener("DOMContentLoaded", function () {
    // Map setup
    var map = L.map('map').setView([5.14663451175841, 100.498455762863], 18); // Adjust center and zoom
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    locationLegend.onAdd = function () {
        const div = L.DomUtil.create('div', 'location-legend'); // Create the div for the control
        div.innerHTML = `
            <div style="background-color: rgba(255, 255, 255, 0.7); padding: 10px; border-radius: 5px; color: black; font-size: 16px;">
                <h5>Target Locations</h5>
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="background-color: red; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> 
                    Pickup Point
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="background-color: blue; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> 
                    Dropoff Point
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="background-color: green; width: 15px; height: 15px; border-radius: 50%; margin-right: 5px;"></span> 
                    Home Point
                </div>
            </div>
        `;
        return div;
    };

    // Add the custom control to the map
    locationLegend.addTo(map);

    const flightIcon = L.Icon.extend({
        options: {
            iconSize: [40, 40], // Adjust the icon size as needed
            iconAnchor: [40 / 2, 40 / 2]
        }
    });

    var greenDroneIcon = new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-green.png' });

    const max_drones = 100;
    
    const targetIcons = {
        pickup: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        dropoff: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        home: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-green.png', iconSize: [25, 41], iconAnchor: [12, 41] })
    };

    for (let a = 0; a < max_drones; a++) {
        multi_drone_indicator[a] = L.marker([2.9100729431148187, 101.65520813904638], { icon: greenDroneIcon });
        const htmlData = `<div class="u-container-layout u-container-layout-5 droneInfo">
                                <p class="u-text u-text-default u-text-data margin-0">Drone ID : ` + a.toString() + `</p>
                                </div>`;
        multi_drone_indicator[a].addTo(map).bindPopup(htmlData);
        droneMarkers[a] = multi_drone_indicator[a];
    }

    function updateDroneStatus() {
        if (!simulatedDroneArr || simulatedDroneArr.length === 0) {
            simulatedDroneArr = new Array(max_drones).fill(null).map((_, i) => ({
                id: i,
                requestedByClient: false,
                command: 'N/A',
                state: {},
                feedback: {
                    connectionStatus: 'Disconnected',
                    droneTimestamp: 0,
                    fsmState: 'N/A',
                    currentAltitude: 0.0,
                    currentPosition: [0.0, 0.0],
                    currentSpeed: 0.0,
                    currentHeading: 0.0,
                    distToTarget: 0.0,
                    batteryLevel: 0.0,
                    weatherState: 'N/A',
                    mannedFlightState: 'N/A',
                },
                eta: {
                    pickup: "N/A",
                    dropoff: "N/A",
                    rtl: "N/A"
                }
            }));
        }

        updateDroneListBySearch("");

        $(document).on("click", ".recenter, .btn-color-mode-switch input", function (event) {
            event.stopPropagation();
        });

        $(document).on("change", "input[name='data_mode']", function () {
            dataModePreview(this);
        });

        function dataModePreview(mode) {
            let droneId = $(mode).data("drone-id");
            isHMBData = !$(mode).prop("checked");
        }

        $(document).on('click', '.recenter', function (event) {
            event.stopPropagation();
            const icon = this;
            const droneId = parseInt(icon.dataset.droneId, 10);

            if ($(icon).hasClass('active')) {
                $(icon).removeClass('active').addClass('inactive');
                selectedDrone = -1;
                console.log("Selected Drone: None");
            } else {
                selectedDrone = droneId;
                console.log("Selected Drone:", selectedDrone);
                $('.recenter').removeClass('active').addClass('inactive');
                $(icon).addClass('active').removeClass('inactive');
            }
        });
    }

    updateDroneStatus();

    function fetchDroneData() {
        try {
            const droneApiURL = 'https://gcs.zulsyah.com/rpi_drone_feedback';
            const missionApiURL = 'https://gcs.zulsyah.com/active_mission_list';
            const hmbApiURL = 'https://gcs.zulsyah.com/hmb_drone_feedback';
            const options = {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            };

            Promise.all([
                fetch(droneApiURL, options).then(response => response.ok ? response.json() : Promise.reject('Failed to fetch drone data')),
                fetch(missionApiURL, options).then(response => response.ok ? response.json() : Promise.reject('Failed to fetch mission data')),
                fetch(hmbApiURL, options).then(response => response.ok ? response.json() : Promise.reject('Failed to fetch HMB data'))
            ])
                .then(([droneData, missionData, hmbData]) => {
                    updateDroneDetails(droneData, hmbData);
                    updateMissionDetails(missionData);
                })
                .catch(error => {
                    console.error(error);
                });

        } catch (error) {
            console.error(error);
        }
    }

    setInterval(fetchDroneData, 500);

    function updateDroneDetails(droneData, hmbData) {
        const liveDroneIds = new Set(Object.values(droneData).map(d => d.id));
        const nonMissionStates = new Set(['N/A', 'Idle', 'Ready', 'Landed', 'Mission finished']);
    
        Object.values(droneData).forEach(liveDrone => {
            const droneToUpdate = simulatedDroneArr.find(d => d.id === liveDrone.id);
            if (droneToUpdate) {
                Object.assign(droneToUpdate.feedback, liveDrone.feedback);
                droneToUpdate.eta = liveDrone.eta;
            }
        });
    
        const currentQuery = document.getElementById("searchQueryInput").value.trim();
        updateDroneListBySearch(currentQuery);
    
        Object.values(droneData).forEach(drone => {
            const hasActiveMission = !nonMissionStates.has(drone.feedback.fsmState);
    
            if (hasActiveMission) {
                if (droneMarkers[drone.id]) {
                    const newLatLng = L.latLng(drone.feedback.currentPosition[0], drone.feedback.currentPosition[1]);
                    droneMarkers[drone.id].setLatLng(newLatLng);
                    updateDroneHistoricalPath(drone);
                }
            } else {
                clearDroneHistoricalPath(drone.id);
            }
            
            updateDronePosition(drone);
    
            if (drone.feedback.fsmState === 'Fatal error' && !handledFatalStates.has(drone.id)) {
                console.log(`FSM State is Fatal for Drone ${drone.id}, rendering prediction on map.`);
                const fatalState = {
                    position: drone.feedback.currentPosition,
                    altitude: drone.feedback.currentAltitude,
                    yawAngle: drone.feedback.currentHeading
                };
                const CL = 0.765, CD = 0.153;
                const liftToDragRatio = CL / CD;
                const range = predictRangeArea(liftToDragRatio, fatalState.altitude);
                L.circle(fatalState.position, { color: 'red', fillColor: '#f03', fillOpacity: 0.5, radius: range }).addTo(map);
                const headingAngle = getQuadrant(fatalState.yawAngle, range);
                const predictedCoordinate = getCrashLocation(headingAngle, fatalState.position);
                L.marker(predictedCoordinate, { icon: L.icon({ iconUrl: 'assets/img/icons/drone/location_fatal.png', iconSize: [24, 24], iconAnchor: [12, 24] }) }).addTo(map);
                L.polyline([fatalState.position, predictedCoordinate], { color: 'red', weight: 3, opacity: 0.8 }).addTo(map);
                handledFatalStates.add(drone.id);
            }
    
            const targetPosition = drone.feedback.targetPosition;
            if (targetPosition && targetPosition[0] !== 0 && targetPosition[1] !== 0) {
                if (!droneTargetStates[drone.id]) {
                    droneTargetStates[drone.id] = 'pickup';
                }
                const previousTargetPosition = dronePreviousPositions[drone.id];
                if (!previousTargetPosition || !arraysAreEqual(previousTargetPosition, targetPosition)) {
                    dronePreviousPositions[drone.id] = targetPosition;
                    let targetType = null;
                    if (droneTargetStates[drone.id] === 'pickup') {
                        targetType = 'pickup';
                        droneTargetStates[drone.id] = 'dropoff';
                    } else if (droneTargetStates[drone.id] === 'dropoff') {
                        targetType = 'dropoff';
                        droneTargetStates[drone.id] = 'home';
                    } else if (droneTargetStates[drone.id] === 'home') {
                        targetType = 'home';
                        delete droneTargetStates[drone.id];
                    }
                    if (targetType) {
                        const targetLatLng = L.latLng(targetPosition[0], targetPosition[1]);
                        if (targetMarkers[drone.id]) {
                            targetMarkers[drone.id].setLatLng(targetLatLng).setIcon(targetIcons[targetType]);
                        } else {
                            targetMarkers[drone.id] = L.marker(targetLatLng, { icon: targetIcons[targetType] }).addTo(map);
                        }
                    }
                }
            }
        });
    
        for (let i = 0; i < max_drones; i++) {
            if (!liveDroneIds.has(i) && droneMarkers[i] && droneMarkers[i].historicalPath) {
                clearDroneHistoricalPath(i);
            }
        }
    }

    function updateDroneListBySearch(query) {
        const filteredDroneArr = simulatedDroneArr.filter(drone => {
            if (drone.feedback.connectionStatus !== 'Connected') return false;
            const searchTerm = query.toLowerCase();
            if (!searchTerm) return true;
            return drone.id.toString().includes(searchTerm);
        });

        const droneDataContainer = document.getElementById("droneDataContainer");
        const existingDroneIds = new Set();
        droneDataContainer.querySelectorAll('.accordion-item').forEach(el => {
            existingDroneIds.add(parseInt(el.dataset.droneId, 10));
        });

        const newDroneIds = new Set(filteredDroneArr.map(d => d.id));

        existingDroneIds.forEach(id => {
            if (!newDroneIds.has(id)) {
                const elToRemove = document.getElementById(`accordion-item-${id}`);
                if (elToRemove) elToRemove.remove();
            }
        });
        
        // Define states that indicate a drone is NOT on an active mission
        const nonMissionStates = new Set(['N/A', 'Idle', 'Ready', 'Landed', 'Mission finished']);

        filteredDroneArr.forEach(drone => {
            const existingElement = document.getElementById(`accordion-item-${drone.id}`);
            const pickupETA = timeFormat(drone.eta.pickup);
            const dropoffETA = timeFormat(drone.eta.dropoff);
            const homeETA = timeFormat(drone.eta.rtl);
            const detailsHTML = `
            <hr class="horizontal dark my-1">
            <span><strong>Connection Status:</strong></span><span class="connected"> ${drone.feedback.connectionStatus}</span>
            <p><strong>Drone Timestamp:</strong> ${convertToReadableTimestamp(drone.feedback.droneTimestamp)}</p>
            <p><strong>FSM State:</strong> ${drone.feedback.fsmState}</p>
            <p><strong>Current Altitude:</strong> ${drone.feedback.currentAltitude} m</p>
            <p><strong>Current Position:</strong> [${drone.feedback.currentPosition.join(", ")}]</p>
            <p><strong>Current Speed:</strong> ${drone.feedback.currentSpeed.toFixed(2)} m/s</p>
            <p><strong>Heading:</strong> ${drone.feedback.currentHeading.toFixed(6)}°</p>
            <p><strong>Distance to Target:</strong> ${drone.feedback.distToTarget.toFixed(1)} m</p>
            <p><strong>Battery Level:</strong> ${drone.feedback.batteryLevel.toFixed(2)} %</p>
            <p><strong>ETA to Pickup Point:</strong> ${pickupETA}</p>
            <p><strong>ETA to Dropoff Point:</strong> ${dropoffETA}</p>
            <p><strong>ETA to Home Point:</strong> ${homeETA}</p>`;

            if (existingElement) {
                const droneDetailsElement = existingElement.querySelector(`#drone-details-${drone.id}`);
                if (droneDetailsElement.innerHTML !== detailsHTML) {
                    droneDetailsElement.innerHTML = detailsHTML;
                }
            } else {
                const newDroneElement = document.createElement('div');
                newDroneElement.className = 'accordion-item';
                newDroneElement.id = `accordion-item-${drone.id}`;
                newDroneElement.dataset.droneId = drone.id;

                newDroneElement.innerHTML = `
                <h6 class="accordion-header" id="heading-${drone.id}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${drone.id}" aria-expanded="false" aria-controls="collapse-${drone.id}">
                        <img id="drone-icon-${drone.id}" src="./assets/img/icons/svg/blue-drone.svg" alt="Drone Icon">
                        <span>Drone ${drone.id}</span>
                        <span class="ms-auto d-flex align-items-center gap-2">
                            <div class="error-state-drone-${drone.id}"></div>
                            <i class="recenter bi bi-cursor-fill inactive" data-drone-id="${drone.id}" me-1></i>
                            <label class="switch btn-color-mode-switch">
                                <input type="checkbox" name="data_mode" id="data_mode-${drone.id}" value="1" data-drone-id="${drone.id}">
                                <label for="data_mode-${drone.id}" data-on="HMB" data-off="RPI" class="btn-color-mode-switch-inner"></label>
                            </label>
                        </span>
                    </button>
                </h6>
                <div id="collapse-${drone.id}" class="accordion-collapse collapse" aria-labelledby="heading-${drone.id}">
                    <div class="accordion-body" id="drone-details-${drone.id}">${detailsHTML}</div>
                    <div id="rtl-button-${drone.id}" class="rtl-button"></div>
                </div>`;
                droneDataContainer.appendChild(newDroneElement);
            }

            // --- MODIFIED: Handle dynamic UI elements like RTL buttons and error icons ---
            const rtlButtonContainer = document.getElementById(`rtl-button-${drone.id}`);
            const errorStateContainer = document.querySelector(`.error-state-drone-${drone.id}`);
            const droneVideoFeedContainer = document.getElementById("drone-video-feed");

            const hasActiveMission = !nonMissionStates.has(drone.feedback.fsmState);
            const isDaaConflict = drone.feedback.fsmState === 'Forward DAA conflict';

            // Clear the container to rebuild it based on the current state
            if (rtlButtonContainer) {
                rtlButtonContainer.innerHTML = '';
            }
        
            // Add RTL button if there's any active mission
            if (hasActiveMission && rtlButtonContainer) {
                const rtlBtn = document.createElement('button');
                rtlBtn.textContent = 'RTL';
                rtlBtn.className = 'btn btn-warning w-100 justify-content-center';
                rtlBtn.onclick = () => sendRTLCommandToDrone(drone.id, rtlButtonContainer, errorStateContainer, droneVideoFeedContainer);
                rtlButtonContainer.appendChild(rtlBtn);
            }
        
            // Handle the specific DAA conflict state
            if (isDaaConflict) {
                // Add the Proceed button ONLY in this state
                if (rtlButtonContainer) {
                    const proceedBtn = document.createElement('button');
                    proceedBtn.textContent = 'Proceed';
                    proceedBtn.className = 'btn btn-info w-100 justify-content-center';
                    proceedBtn.onclick = () => proceedWithMission(drone.id, rtlButtonContainer, errorStateContainer);
                    rtlButtonContainer.appendChild(proceedBtn); // Append, don't replace
                }
        
                // Handle other UI elements for DAA
                if (!conflictedDrones.has(drone.id)) {
                    showModernToast('warning', 'Warning!', `Forward DAA conflicted for Drone ${drone.id}`);
                    if (errorStateContainer) {
                        errorStateContainer.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1 blinking-icon" title="Forward DAA Conflicted"></i>`;
                    }
                    requestDroneVideoStream(drone.id, droneVideoFeedContainer);
                    conflictedDrones.add(drone.id);
                }
            } else {
                // Clean up DAA-specific UI if the state is no longer DAA conflict
                if (conflictedDrones.has(drone.id)) {
                    if (errorStateContainer) errorStateContainer.innerHTML = '';
                    const streamContainer = document.getElementById(`drone-stream-container-${drone.id}`);
                    if (streamContainer) streamContainer.remove();
                    conflictedDrones.delete(drone.id);
                }
            }
        });

        const hasDrones = droneDataContainer.querySelector('.accordion-item');
        const noDronesMessage = droneDataContainer.querySelector('.no-drones-message');

        if (!hasDrones && !noDronesMessage) {
            const message = query ? `No drone found for "${query}"` : "No online drones.";
            droneDataContainer.innerHTML = `<div class="no-drones-message" style="text-align: center; padding: 20px; color: #888;">${message}</div>`;
        } else if (hasDrones && noDronesMessage) {
            noDronesMessage.remove();
        }
    }

    const completedMissions = new Set();

    function timeFormat(eta) {
        return eta && eta !== "N/A"
            ? new Date(eta).toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kuala_Lumpur"
            })
            : "N/A";
    }

    function updateMissionDetails(missionData) {
        if (!missionData || !Array.isArray(missionData)) return;
        missionData.forEach(mission => {
            const { mission_id, mission_complete, afpp_waypoints, closest_pickup_point, closest_dropoff_point, home_point } = mission;
            if (mission_complete) {
                if (drawnWaypoints.has(mission_id)) {
                    drawnWaypoints.get(mission_id).forEach(layer => map.removeLayer(layer));
                    drawnWaypoints.delete(mission_id);
                }
                completedMissions.add(mission_id);
                return;
            }
            if (completedMissions.has(mission_id) || drawnWaypoints.has(mission_id)) return;
            if (afpp_waypoints) {
                const { pickup, dropoff, rtl } = afpp_waypoints;
                let layers = [];
                if (pickup && pickup.length > 1) layers.push(drawLine(pickup, "grey"));
                if (dropoff && dropoff.length > 1) layers.push(drawLine(dropoff, "grey"));
                if (rtl && rtl.length > 1) layers.push(drawLine(rtl, "grey"));
                if (closest_pickup_point) layers.push(addMarker(closest_pickup_point, "assets/img/icons/drone/pickup.png"));
                if (closest_dropoff_point) layers.push(addMarker(closest_dropoff_point, "assets/img/icons/drone/dropoff.png"));
                if (home_point) layers.push(addMarker(home_point, "assets/img/icons/drone/home.png"));
                drawnWaypoints.set(mission_id, layers.filter(layer => layer));
            }
        });
    }

    function drawLine(coordinates, color) {
        if (!coordinates || coordinates.length < 2) return null;
        let latLngs = coordinates.map(coord => [coord[0], coord[1]]);
        return L.polyline(latLngs, { color: color }).addTo(map);
    }

    function addMarker(coordinate, iconUrl) {
        if (!coordinate) return null;
        let icon = L.icon({
            iconUrl: iconUrl,
            iconSize: [40, 40],
            iconAnchor: [15, 15],
            popupAnchor: [0, -30]
        });
        return L.marker([coordinate.lat, coordinate.long], { icon }).addTo(map);
    }

    function clearDroneHistoricalPath(droneId) {
        if (droneMarkers[droneId] && droneMarkers[droneId].historicalPath) {
            map.removeLayer(droneMarkers[droneId].historicalPath);
            delete droneMarkers[droneId].historicalPath;
        }
    }

    function sendRTLCommandToDrone(droneId, rtlButtonContainer, errorStateContainer, droneVideoFeedContainer) {
        fetch('https://gcs.zulsyah.com/request_rtl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drone_id: droneId })
        })
            .then(res => res.json())
            .then(data => {
                console.log(`RTL triggered for drone ${droneId}:`, data);
                showModernToast('success', 'Success!', `Drone ${droneId} will Return To Launch.`);
                if (rtlButtonContainer) rtlButtonContainer.innerHTML = '';
                if (errorStateContainer) errorStateContainer.innerHTML = '';
            })
            .catch(err => {
                console.error('RTL request failed:', err);
                alert('Failed to trigger RTL');
            });
    }

    function proceedWithMission(droneId, rtlButtonContainer, errorStateContainer) {
        fetch('https://gcs.zulsyah.com/resume_mission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drone_id: droneId })
        })
            .then(res => res.json())
            .then(data => {
                console.log(`Resume mission for drone ${droneId}:`, data);
                showModernToast('info', 'Info!', `Resume mission for drone ${droneId}`);
                if (rtlButtonContainer) rtlButtonContainer.innerHTML = '';
                if (errorStateContainer) errorStateContainer.innerHTML = '';
            })
            .catch(err => {
                console.error('Resume mission request failed:', err);
                alert('Resume mission to trigger RTL');
            });
    }

    function showModernToast(type, title, message) {
        const container = document.getElementById('modern-toast-container');
        const toast = document.createElement('div');
        toast.className = `modern-toast toast-${type}`;
        let iconChar = type === 'success' ? '✓' : type === 'error' ? '✖' : type === 'warning' ? '!' : 'ℹ';
        toast.innerHTML = `<div class="toast-icon">${iconChar}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div><button class="toast-close" aria-label="Close">&times;</button>`;
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function requestDroneVideoStream(droneId, droneVideoFeedContainer) {
        if (document.getElementById(`drone-stream-container-${droneId}`)) return;
        const streamContainer = document.createElement('div');
        streamContainer.id = `drone-stream-container-${droneId}`;
        Object.assign(streamContainer.style, { position: 'relative', display: 'inline-block', width: '420px', height: '236px', marginTop: '10px', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' });
        const mjpegImg = document.createElement('img');
        mjpegImg.id = `drone-stream-${droneId}`;
        mjpegImg.src = `https://gcs.zulsyah.com/drone_camera/${droneId}`;
        Object.assign(mjpegImg, { width: 420, height: 236, alt: `Live stream from Drone ${droneId}` });
        mjpegImg.style.display = 'block';
        const overlayText = document.createElement('div');
        overlayText.textContent = `🔴 Live stream from Drone ${droneId}`;
        Object.assign(overlayText.style, { position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' });
        const closeBtn = document.createElement('i');
        closeBtn.className = 'bi bi-x-circle-fill';
        Object.assign(closeBtn.style, { position: 'absolute', top: '6px', right: '8px', fontSize: '20px', color: 'white', cursor: 'pointer' });
        closeBtn.title = 'Close Stream';
        closeBtn.onclick = () => {
            streamContainer.remove();
            console.log(`Stream for Drone ${droneId} removed!`);
        };
        streamContainer.append(mjpegImg, overlayText, closeBtn);
        droneVideoFeedContainer.appendChild(streamContainer);
    }

    map.on('zoomstart', () => userZooming = true);
    map.on('zoomend', () => userZooming = false);

    function updateDronePosition(drone) {
        const droneMarker = multi_drone_indicator[drone.id];
        if (droneMarker) {
            droneMarker.setLatLng(drone.feedback.currentPosition);
            if (typeof droneMarker.setRotationAngle === 'function') {
                droneMarker.setRotationAngle(drone.feedback.currentHeading);
            }
            if (selectedDrone !== -1 && drone.id === selectedDrone) {
                droneMarker.setIcon(new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-red.png' }));
                if (!userZooming) {
                    map.setView(drone.feedback.currentPosition);
                }
            } else {
                droneMarker.setIcon(new flightIcon({ iconUrl: 'assets/img/icons/drone/drone-green.png' }));
            }
        }
    }

    async function updateDroneHistoricalPath(drone) {
        try {
            const response = await fetch(`https://gcs.zulsyah.com/drone_historical_path/${drone.id}`);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const pathData = await response.json();
            if (!Array.isArray(pathData) || pathData.length === 0) {
                clearDroneHistoricalPath(drone.id);
                return;
            }
            const validPath = pathData.filter(pos => Array.isArray(pos) && pos.length === 2 && pos[0] !== 0 && pos[1] !== 0);
            if (validPath.length < 2) {
                clearDroneHistoricalPath(drone.id);
                return;
            }
            if (droneMarkers[drone.id].historicalPath) {
                droneMarkers[drone.id].historicalPath.setLatLngs(validPath);
            } else {
                droneMarkers[drone.id].historicalPath = L.polyline(validPath, { color: 'blue' }).addTo(map);
            }
        } catch (error) {
            console.warn(`Could not fetch path for drone ${drone.id}:`, error.message);
        }
    }

    function arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    function predictRangeArea(liftToDragRatio, altitude) {
        return liftToDragRatio * altitude;
    }

    function getCrashLocation(rangeComponent, lastPoint) {
        const { rn, re } = rangeComponent;
        const [lat, lon] = lastPoint;
        const { dLat, dLon } = convertToLatLng(rn, re, lat);
        const predictedLat = lat + (dLat * (180 / Math.PI));
        const predictedLon = lon + (dLon * (180 / Math.PI));
        return [predictedLat, predictedLon];
    }

    function convertToLatLng(Rn, Re, lat_original) {
        const earthRadius = 6378137;
        const latInRadians = lat_original * (Math.PI / 180);
        const dLat = Rn / earthRadius;
        const dLon = Re / (earthRadius * Math.cos(latInRadians));
        return { dLat, dLon };
    }

    function calculateComponent(angle, range, quadrant) {
        const R = range;
        const theta = angle * (Math.PI / 180);
        let Rn, Re;
        switch (quadrant) {
            case 1: Rn = R * Math.cos(theta); Re = R * Math.sin(theta); break;
            case 2: Rn = -R * Math.cos(theta); Re = R * Math.sin(theta); break;
            case 3: Rn = -R * Math.cos(theta); Re = -R * Math.sin(theta); break;
            case 4: Rn = R * Math.cos(theta); Re = -R * Math.sin(theta); break;
        }
        return { rn: Rn, re: Re };
    }

    function getQuadrant(yaw, range) {
        let quadrant, angle;
        if (yaw >= 0 && yaw < 90) { quadrant = 1; angle = yaw; }
        else if (yaw >= 90 && yaw < 180) { quadrant = 2; angle = 180 - yaw; }
        else if (yaw >= 180 && yaw < 270) { quadrant = 3; angle = yaw - 180; }
        else { quadrant = 4; angle = 360 - yaw; }
        return calculateComponent(angle, range, quadrant);
    }

    function convertToReadableTimestamp(timestamp) {
        if (!timestamp || timestamp === 0) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    }

    const searchQueryInput = document.getElementById("searchQueryInput");
    const searchQuerySubmit = document.getElementById("searchQuerySubmit");

    searchQueryInput.addEventListener("input", function () {
        updateDroneListBySearch(this.value.trim());
    });

    searchQuerySubmit.addEventListener("click", function () {
        updateDroneListBySearch(searchQueryInput.value.trim());
    });
});