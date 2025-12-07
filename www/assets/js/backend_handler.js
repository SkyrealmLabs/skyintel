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
// <<< NEW: This Map will store markers for detected objects >>>
const objectDetectionMarkers = new Map(); // Stores "droneId-objectId" -> L.Marker
let warningAudio = null; // Global instance for the warning sound
// <<< END NEW >>>

document.addEventListener("DOMContentLoaded", function () {
    // Map setup
    var map = L.map('map').setView([5.14663451175841, 100.498455762863], 18); // Adjust center and zoom
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    // ==========================================
    // === 🗺️ NEW: LOAD OBSTACLE GEOJSON DATA ===
    // ==========================================
    /**
     * Loads and displays the obstacle polygons from obstacle.geojson on the map.
     */
    function loadObstacles() {
        // Fetch the obstacle data 
        fetch('./assets/js/obstacle.geojson')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok for obstacle.geojson');
                }
                return response.json();
            })
            .then(data => {
                // Define a style for the obstacle polygons
                const obstacleStyle = {
                    color: "#e60000",   // A strong red border
                    weight: 2,
                    opacity: 0.8,
                    fillColor: "#ff4d4d", // A semi-transparent red fill
                    fillOpacity: 0.4
                };

                // Add the GeoJSON data to the map 
                L.geoJSON(data, { // 'data' is the content of obstacle.geojson 
                    style: obstacleStyle,
                    onEachFeature: function (feature, layer) {
                        // Add a popup to identify the features as obstacles
                        layer.bindPopup('<strong>Obstacle Area</strong>');
                    }
                }).addTo(map);
            })
            .catch(error => {
                console.error('There was a problem loading the obstacle data:', error);
            });
    }

    // Call the function to load obstacles
    loadObstacles();
    // ==========================================
    // ===           END OF NEW CODE          ===
    // ==========================================


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

    // const max_drones = 100;

    const targetIcons = {
        pickup: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        dropoff: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        home: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-green.png', iconSize: [25, 41], iconAnchor: [12, 41] })
    };

    // for (let a = 0; a < max_drones; a++) {
    //     multi_drone_indicator[a] = L.marker([2.9100729431148187, 101.65520813904638], { icon: greenDroneIcon });
    //     const htmlData = `<div class="u-container-layout u-container-layout-5 droneInfo">
    //                             <p class="u-text u-text-default u-text-data margin-0">Drone ID : ` + a.toString() + `</p>
    //                             </div>`;
    //     multi_drone_indicator[a].addTo(map).bindPopup(htmlData);
    //     droneMarkers[a] = multi_drone_indicator[a];
    // }

    function updateDroneStatus() {
        // if (!simulatedDroneArr || simulatedDroneArr.length === 0) {
        //     simulatedDroneArr = new Array(max_drones).fill(null).map((_, i) => ({
        //         id: i,
        //         requestedByClient: false,
        //         command: 'N/A',
        //         state: {},
        //         feedback: {
        //             connectionStatus: 'Disconnected',
        //             droneTimestamp: 0,
        //             fsmState: 'N/A',
        //             currentAltitude: 0.0,
        //             currentPosition: [0.0, 0.0],
        //             currentSpeed: 0.0,
        //             currentHeading: 0.0,
        //             distToTarget: 0.0,
        //             batteryLevel: 0.0,
        //             weatherState: 'N/A',
        //             mannedFlightState: 'N/A',
        //         },
        //         eta: {
        //             pickup: "N/A",
        //             dropoff: "N/A",
        //             rtl: "N/A"
        //         },
        //         connectivity: {
        //             networkType: "N/A",
        //             lteCellID: "N/A",
        //             lteNetworkBand: "N/A",
        //             lteRSSI: -999,
        //             lteRSRP: -999,
        //             lteSNR: -999
        //         }
        //     }));
        // }

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

        // <<< NEW: Keep track of all object keys seen in this update cycle >>>
        const allSeenObjectKeys = new Set();
        // <<< END NEW >>>

        // Object.values(droneData).forEach(liveDrone => {
        //     const droneToUpdate = simulatedDroneArr.find(d => d.id === liveDrone.id);
        //     if (droneToUpdate) {
        //         Object.assign(droneToUpdate.feedback, liveDrone.feedback);
        //         droneToUpdate.eta = liveDrone.eta;
        //         droneToUpdate.connectivity = liveDrone.connectivity;
        //     }
        // });

        Object.values(droneData).forEach(liveDrone => {
            let droneToUpdate = simulatedDroneArr.find(d => d.id === liveDrone.id);

            // If the drone is new, create its data object and map marker
            if (!droneToUpdate) {
                droneToUpdate = {
                    id: liveDrone.id,
                    requestedByClient: false,
                    command: 'N/A',
                    state: {},
                    feedback: {}, // Will be populated below
                    eta: {},      // Will be populated below
                    connectivity: {}, // Will be populated below
                    object_detection: []
                };
                simulatedDroneArr.push(droneToUpdate);

                // Create a new marker for the new drone
                const newMarker = L.marker([2.9100729431148187, 101.65520813904638], { icon: greenDroneIcon });
                const htmlData = `<div class="u-container-layout u-container-layout-5 droneInfo">
                                <p class="u-text u-text-default u-text-data margin-0">Drone ID : ${liveDrone.id}</p>
                            </div>`;
                newMarker.addTo(map).bindPopup(htmlData);
                droneMarkers[liveDrone.id] = newMarker;
                multi_drone_indicator[liveDrone.id] = newMarker; // Ensure this is also assigned
            }

            // Now, update its details (this part is the same as before)
            Object.assign(droneToUpdate.feedback, liveDrone.feedback);
            droneToUpdate.eta = liveDrone.eta;
            droneToUpdate.connectivity = liveDrone.connectivity;
            droneToUpdate.object_detection = liveDrone.object_detection;
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

            // <<< NEW: RENDER OBJECT DETECTION MARKERS >>>
            if (drone.object_detection && Array.isArray(drone.object_detection)) {
                drone.object_detection.forEach(obj => {

                    // <<< FIX (v2): Validate the entire object structure first >>>
                    if (!obj || !obj.object_id || !obj.position || !Array.isArray(obj.position) || obj.position.length < 2) {
                        // console.warn(`Skipping invalid/incomplete object from drone ${drone.id}. Data:`, obj);
                        return; // Skip this object
                    }
                    // <<< END FIX (v2) >>>

                    // Create a unique key for this object from this drone
                    const objectKey = `${drone.id}-${obj.object_id}`;
                    allSeenObjectKeys.add(objectKey); // Mark this object as "seen"

                    // Get the object's position from your data
                    const objectPosition = L.latLng(obj.position[0], obj.position[1]);

                    // Check if marker already exists
                    if (objectDetectionMarkers.has(objectKey)) {
                        // Update existing marker position
                        objectDetectionMarkers.get(objectKey).setLatLng(objectPosition);
                    } else {
                        // Create a new marker (using a simple circle)
                        const newObjectMarker = L.circleMarker(objectPosition, {
                            radius: 8,
                            color: 'orange',      // Border color
                            weight: 2,
                            fillColor: '#FFA500', // Fill color
                            fillOpacity: 0.6
                        }).addTo(map);

                        // Add a popup with info based on your data structure
                        newObjectMarker.bindPopup(
                            `<strong>Detected Object</strong><br>` +
                            `ID: ${obj.object_id}<br>` +
                            `From Drone: ${drone.id}<br>` +
                            `Class: ${obj.class_name}<br>` +
                            `Distance: ${obj.distance_from_uav.toFixed(2)} m<br>` +
                            `Moving: ${obj.moving_object}`
                        );

                        // Store the new marker
                        objectDetectionMarkers.set(objectKey, newObjectMarker);
                    }
                });
            }
            // <<< END NEW >>>

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

        // <<< NEW: CLEAN UP STALE OBJECT DETECTION MARKERS >>>
        // After looping through all drones, check for any markers
        // that are no longer in the "allSeenObjectKeys" set.
        objectDetectionMarkers.forEach((marker, key) => {
            if (!allSeenObjectKeys.has(key)) {
                // This object was not in the latest detection data, so remove it
                map.removeLayer(marker);
                objectDetectionMarkers.delete(key); // Remove from our tracking Map
            }
        });
        // <<< END NEW >>>

        // Iterate over all drones we know about
        simulatedDroneArr.forEach(drone => {
            // If a known drone is not in the live data feed, clear its path
            if (!liveDroneIds.has(drone.id)) {
                clearDroneHistoricalPath(drone.id);
            }
        });
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
            const rsrpQuality = getRSRPQuality(drone.connectivity?.lteRSRP);
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
                <p><strong>ETA to Home Point:</strong> ${homeETA}</p>
                <p><strong>Network Type:</strong> ${drone.connectivity?.networkType ?? 'N/A'}</p>
                <p><strong>Signal Strength:</strong> 
                    <span style="color:${rsrpQuality.color}; font-weight:bold;">
                        ${rsrpQuality.label}
                    </span>
                </p>
            `;

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
                        <div class="accordion-button collapsed">
                            <img id="drone-icon-${drone.id}" src="./assets/img/icons/svg/blue-drone.svg" alt="Drone Icon">

                            <span class="accordion-drone-name flex-grow-1" 
                                data-bs-toggle="collapse" 
                                data-bs-target="#collapse-${drone.id}" 
                                aria-expanded="false" 
                                aria-controls="collapse-${drone.id}" 
                                style="cursor: pointer;">
                                Drone ${drone.id}
                            </span>

                            <span class="ms-auto d-flex align-items-center gap-2">
                                <div class="error-state-drone-${drone.id}"></div>
                                <div class="signal-bar" id="signal-bar-${drone.id}" 
                                    title="Signal Strength: ${rsrpQuality.label}">
                                    ${generateSignalBars(rsrpQuality.level)}
                                </div>
                                <i class="recenter bi bi-cursor-fill inactive" data-drone-id="${drone.id}" me-1></i>
                                <label class="switch btn-color-mode-switch">
                                    <input type="checkbox" name="data_mode" id="data_mode-${drone.id}" value="1" data-drone-id="${drone.id}">
                                    <label for="data_mode-${drone.id}" data-on="HMB" data-off="RPI" class="btn-color-mode-switch-inner"></label>
                                </label>
                            </span>
                        </div>
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

            // FIX 1: Case-insensitive check
            const fsmState = (drone.feedback.fsmState || '').toLowerCase();
            const isDaaConflict = fsmState === 'forward daa conflict';
            const droneId = (drone.id === 1000) ? 0 : drone.id;

            // Clear the container to rebuild it based on the current state
            if (rtlButtonContainer) {
                rtlButtonContainer.innerHTML = '';
            }

            // Add RTL button if there's any active mission
            if (hasActiveMission && rtlButtonContainer) {
                const rtlBtn = document.createElement('button');
                rtlBtn.textContent = 'RTL';
                rtlBtn.className = 'btn btn-warning w-100 justify-content-center';
                rtlBtn.onclick = () => sendRTLCommandToDrone(droneId, rtlButtonContainer, errorStateContainer, droneVideoFeedContainer);
                rtlButtonContainer.appendChild(rtlBtn);
            }

            // Handle the specific DAA conflict state
            if (isDaaConflict) {
                // Add the Proceed button ONLY in this state
                if (rtlButtonContainer) {
                    const proceedBtn = document.createElement('button');
                    proceedBtn.textContent = 'Proceed';
                    proceedBtn.className = 'btn btn-info w-100 justify-content-center';
                    proceedBtn.onclick = () => proceedWithMission(droneId, rtlButtonContainer, errorStateContainer);
                    rtlButtonContainer.appendChild(proceedBtn); // Append, don't replace
                }

                // FIX 2: Check if the stream was closed by the user. If so, reset the state so it can reopen if needed.
                const existingStream = document.getElementById(`drone-stream-container-${droneId}`);
                if (!existingStream && conflictedDrones.has(droneId)) {
                    conflictedDrones.delete(droneId);
                }

                // Handle other UI elements for DAA
                if (!conflictedDrones.has(droneId)) {
                    showModernToast('warning', 'Warning!', `Forward DAA conflicted for Drone ${drone.id}`);
                    if (errorStateContainer) {
                        errorStateContainer.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1 blinking-icon" title="Forward DAA Conflicted"></i>`;
                    }
                    requestDroneVideoStream(droneId, droneVideoFeedContainer);
                    conflictedDrones.add(droneId);
                }
            } else {
                // Clean up DAA-specific UI if the state is no longer DAA conflict
                if (conflictedDrones.has(droneId)) {
                    if (errorStateContainer) errorStateContainer.innerHTML = '';
                    const streamContainer = document.getElementById(`drone-stream-container-${droneId}`);
                    if (streamContainer) streamContainer.remove();
                    conflictedDrones.delete(droneId);
                    const disconnectStreamAPIUrl = `https://gcs.zulsyah.com/disconnect_drone_camera/${droneId}`;
                    fetch(disconnectStreamAPIUrl)
                        .then(response => {
                            // Check if the response was successful (status in the 200-299 range)
                            if (!response.ok) {
                                // Throw an error if the HTTP status is not successful
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            console.log(`Successfully disconnect stream from the Drone ${droneId}`);
                            // If you expect a JSON response, you can parse it here:
                            // return response.json(); 
                        })
                        .catch(error => {
                            // Handle any errors that occurred during the fetch or in the .then block
                            console.error(`Failed to disconnect drone camera for Drone ${droneId}:`, error);
                        });
                }
            }

        }); // <<< END of filteredDroneArr.forEach

        // After the loop, check if *any* drone is in a conflict state
        if (conflictedDrones.size > 0) {
            // At least one drone is in conflict. Play audio if not already playing.
            if (!warningAudio) {
                warningAudio = new Audio('../assets/audio/warning-alert.mp3');
                warningAudio.loop = true; // Loop the audio for a persistent warning
                warningAudio.play().catch(err => console.warn('Audio play failed:', err));
            }
        } else {
            // NO drones are in conflict. Stop the audio if it is playing.
            if (warningAudio) {
                warningAudio.pause();
                warningAudio.currentTime = 0; // Reset to start
                warningAudio = null; // Clear the instance
            }
        }
        // ===============================================

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

    function getRSRPQuality(rsrp) {
        if (rsrp === undefined || rsrp === null || isNaN(rsrp)) {
            return { label: "N/A", color: "gray" };
        }
        if (rsrp >= -80) {
            return { label: "Excellent", color: "green", level: 4 };
        } else if (rsrp >= -90) {
            return { label: "Good", color: "limegreen", level: 3 };
        } else if (rsrp >= -100) {
            return { label: "Fair", color: "orange", level: 2 };
        } else if (rsrp >= -120) {
            return { label: "Weak", color: "red", level: 1 };
        } else {
            return { label: "No Signal", color: "darkred", level: 0 };
        }
    }

    function generateSignalBars(level) {
        // level: 0 = worst, 4 = best
        let bars = '';
        for (let i = 1; i <= 4; i++) {
            bars += `<span class="bar ${i <= level ? 'active' : ''}"></span>`;
        }
        return bars;
    }

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

    // FIX 3: Update CSS and size to ensure video appears floating
    function requestDroneVideoStream(droneId, droneVideoFeedContainer) {
        if (droneVideoFeedContainer.querySelector('img')) {
            // If an image (stream) already exists, remove it before adding the new one.
            droneVideoFeedContainer.innerHTML = '';
        }

        const videoStreamId = (droneId === 1000) ? 0 : droneId;
        const streamUrl = `https://gcs.zulsyah.com/drone_camera/${videoStreamId}`;

        // 1. Create a container for the image and control elements (optional but good for structure)
        const streamContainer = document.createElement('div');
        streamContainer.id = `drone-stream-container-${droneId}`;
        Object.assign(streamContainer.style, {
            position: 'relative',
            display: 'block',
            width: '420px',
            height: '240px',
            marginTop: '0px',
            border: '2px solid #ccc',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#000',
            zIndex: '10000'
        });

        // 2. Use a simple <img> tag to handle the MJPEG stream
        const mjpegImg = document.createElement('img');
        mjpegImg.id = `drone-stream-${droneId}`;
        mjpegImg.src = streamUrl; // Set the source directly to the MJPEG API
        mjpegImg.alt = `Live stream from Drone ${droneId}`;

        // Add an onerror handler just like in the provided HTML for robustness
        mjpegImg.onerror = function () {
            this.onerror = null;
            // Optional: You can set a placeholder image here if available, 
            // or simply remove the stream to stop continuous attempts.
            // For now, let's just log a message.
            console.error(`Failed to load stream for Drone ${droneId}`);
            // Remove the container if the stream fails
            streamContainer.remove();
        };

        // Ensure the image fills the container
        Object.assign(mjpegImg.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
        });

        // 3. Create overlay text and close button (retaining the useful UI controls)
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
            // You should still call the disconnect API when the user closes the stream
            const disconnectStreamAPIUrl = `https://gcs.zulsyah.com/disconnect_drone_camera/${videoStreamId}`;
            fetch(disconnectStreamAPIUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    console.log(`Successfully disconnect stream from the Drone ${droneId}`);
                })
                .catch(error => {
                    console.error(`Failed to disconnect drone camera for Drone ${droneId}:`, error);
                });
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