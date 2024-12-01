let parameter_config = {};
let simulatedDroneArr = []; // Object to store drone data
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

const targetMarkers = {};
const droneTargetStates = {};
const dronePreviousPositions = {};
const locationLegend = L.control({ position: 'bottomright' });
const handledFatalStates = new Set();
const fatalCoordinates = {};
const renderedDrones = new Set();

document.addEventListener("DOMContentLoaded", function () {
    // Map setup
    var map = L.map('map').setView([2.9100729431148187, 101.65520813904638], 18); // Adjust center and zoom
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
    let droneMarkers = [];
    let multi_drone_indicator = [];

    // Define marker icons with different colors for each target type
    const targetIcons = {
        pickup: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        dropoff: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
        home: L.icon({ iconUrl: 'assets/img/icons/drone/location-pin-green.png', iconSize: [25, 41], iconAnchor: [12, 41] })
    };

    // Initialize droneMarkers and multi_drone_indicator
    for (let a = 0; a < max_drones; a++) {
        multi_drone_indicator[a] = L.marker([2.9100729431148187, 101.65520813904638], { icon: greenDroneIcon });
        const htmlData = `<div class="u-container-layout u-container-layout-5 droneInfo">
                            <p class="u-text u-text-default u-text-data margin-0">Drone ID : ` + a.toString() + `</p>
                            </div>`;
        multi_drone_indicator[a].addTo(map).bindPopup(htmlData);

        // Initialize droneMarkers with markers for each drone
        droneMarkers[a] = multi_drone_indicator[a];

        // Initialize historical path from localStorage
        const storedPath = JSON.parse(localStorage.getItem(`dronePath-${a}`)) || [];
        if (storedPath.length > 0) {
            const polyline = L.polyline(storedPath, { color: 'blue' }).addTo(map);
            multi_drone_indicator[a].historicalPath = polyline; // Store the polyline on the marker for reference
        }
    }

    function updateDroneStatus() {
        let droneDataContainer = document.getElementById("droneDataContainer");
        droneDataContainer.innerHTML = "";  // Clear any previous content to avoid duplicates

        // Initialize simulatedDroneArr with default data if necessary
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
                    batteryVoltage: 0.0,
                    weatherState: 'N/A',
                    mannedFlightState: 'N/A',
                },
            }));
        }

        simulatedDroneArr.forEach(function (drone) {
            const droneHTML = `
                            <div class="accordion-item">
                                <h6 class="accordion-header" id="heading-${drone.id}">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                                        data-bs-target="#collapse-${drone.id}" aria-expanded="false" aria-controls="collapse-${drone.id}">
                                        <img src="./assets/img/icons/svg/drone-svgrepo-com.svg" alt="Drone Icon">
                                        Drone ${drone.id}
                                        <span class="ms-auto">
                                            <i class="recenter bi bi-cursor-fill inactive" data-drone-id="${drone.id}" me-1></i>
                                            <span class="ms-2 text-danger fw-bold" id="drone-connect-${drone.id}">Disconnected</span>
                                        </span>
                                    </button>
                                </h6>
                                <div id="collapse-${drone.id}" class="accordion-collapse collapse" aria-labelledby="heading-${drone.id}">
                                    <div class="accordion-body" id="drone-details-${drone.id}">
                                    </div>
                                </div>
                            </div>`;
            droneDataContainer.innerHTML += droneHTML;
        });

        // Add event listener after elements are created
        const recenterIcons = document.querySelectorAll('.recenter');

        recenterIcons.forEach(icon => {
            icon.addEventListener('click', function (event) {
                const droneId = parseInt(event.target.dataset.droneId, 10);
                
                // Update selectedDrone
                selectedDrone = droneId;
                console.log("Selected Drone:", selectedDrone);
        
                // Reset all icons to inactive state
                recenterIcons.forEach(icon => icon.classList.remove('active'));
                recenterIcons.forEach(icon => icon.classList.add('inactive'));
        
                // Set the clicked icon to active state
                icon.classList.add('active');
                icon.classList.remove('inactive');
            });
        });
    }

    updateDroneStatus();

    function fetchDroneData() {
        try {
            const apiURL = 'http://localhost:3000/drone_feedback';

            const options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }

            fetch(apiURL, options)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    updateDroneDetails(data);
                });

        } catch (error) {
            console.error(error);
        }
    }

    setInterval(function () { fetchDroneData() }, 500);

    function updateDroneDetails(droneData) {
        Object.values(droneData).forEach(drone => {
            const droneDetailsElement = document.getElementById(`drone-details-${drone.id}`);
            const connectionStatusElement = document.getElementById(`drone-connect-${drone.id}`);

            // console.log(drone.feedback)

            if (droneDetailsElement) {
                droneDetailsElement.innerHTML = `
                    <hr class="horizontal dark my-1">
                    <p><strong>Connection Status:</strong> ${drone.feedback.connectionStatus}</p>
                    <p><strong>Drone Timestamp:</strong> ${drone.feedback.droneTimestamp}</p>
                    <p><strong>FSM State:</strong> ${drone.feedback.fsmState}</p>
                    <p><strong>Current Altitude:</strong> ${drone.feedback.currentAltitude} m</p>
                    <p><strong>Current Position:</strong> [${drone.feedback.currentPosition.join(", ")}]</p>
                    <p><strong>Current Speed:</strong> ${drone.feedback.currentSpeed.toFixed(2)} m/s</p>
                    <p><strong>Heading:</strong> ${drone.feedback.currentHeading.toFixed(6)}°</p>
                    <p><strong>Distance to Target:</strong> ${drone.feedback.distToTarget} m</p>
                    <p><strong>Battery Voltage:</strong> ${drone.feedback.batteryVoltage.toFixed(2)} V</p>
                    <p><strong>Weather State:</strong> ${drone.feedback.weatherState}</p>
                    <p><strong>Manned Flight State:</strong> ${drone.feedback.mannedFlightState}</p>
                `;

                // Check if the FSM state is "Mission Finished"
                if (drone.feedback.fsmState === "Mission finished") {
                    clearDroneHistoricalPath(drone.id);
                } else {
                    // Move the drone marker based on the updated position if mission is ongoing
                    if (droneMarkers[drone.id]) {
                        const newLatLng = L.latLng(drone.feedback.currentPosition[0], drone.feedback.currentPosition[1]);
                        droneMarkers[drone.id].setLatLng(newLatLng);

                        // Update historical path
                        updateDroneHistoricalPath(drone);
                    }
                }

                // Update the drone position and heading
                updateDronePosition(drone);

                if (connectionStatusElement) {
                    connectionStatusElement.innerText = drone.feedback.connectionStatus;
                    connectionStatusElement.classList.remove('text-danger', 'text-success', 'text-warning');
                    if (drone.feedback.connectionStatus === 'Disconnected') {
                        connectionStatusElement.classList.add('text-danger');
                    } else if (drone.feedback.connectionStatus === 'Connected') {
                        connectionStatusElement.classList.add('text-success');
                    } else if (drone.feedback.connectionStatus === 'Connecting') {
                        connectionStatusElement.classList.add('text-warning');
                    }

                    // Check for FSM state "Fatal" and show warning icon if applicable
                    if (drone.feedback.fsmState === 'Fatal' && !renderedDrones.has(drone.id)) {
                        console.log(`FSM State is Fatal for Drone ${drone.id}, adding warning icon and rendering prediction.`);

                        const connectionStatusElement = document.getElementById(`drone-connect-${drone.id}`);
                        if (connectionStatusElement) {
                            const warningIcon = document.createElement('span');
                            warningIcon.classList.add('ms-2', 'text-danger', 'warning-icon');
                            warningIcon.innerHTML = '&#9888;'; // Warning icon (⚠)

                            // Add the warning icon safely without overwriting existing content
                            if (!connectionStatusElement.querySelector('.warning-icon')) {
                                connectionStatusElement.appendChild(warningIcon);
                            }
                        }

                        // Capture the fatal state details for the drone
                        const fatalState = {
                            position: drone.feedback.currentPosition,
                            altitude: drone.feedback.currentAltitude,
                            yawAngle: drone.feedback.currentHeading
                        };

                        // Calculate glide motion range for this drone
                        const CL = 0.765; // lift coefficient
                        const CD = 0.153; // drag coefficient
                        const liftToDragRatio = CL / CD; // glide ratio

                        const altitude = fatalState.altitude; // in meters
                        const yawAngle = fatalState.yawAngle;

                        // Add glide motion algorithm to predict the position
                        const range = predictRangeArea(liftToDragRatio, altitude);

                        // Add a circle to show the range of glide motion for this drone
                        L.circle(fatalState.position, {
                            color: 'red',
                            fillColor: '#f03',
                            fillOpacity: 0.5,
                            radius: range // range is in meters
                        }).addTo(map);

                        // Get the heading angle and calculate predicted crash location
                        const headingAngle = getQuadrant(yawAngle, range);
                        const predictedCoordinate = getCrashLocation(headingAngle, fatalState.position);

                        // Place the crash prediction marker for this drone
                        L.marker(predictedCoordinate, {
                            icon: L.icon({
                                iconUrl: 'assets/img/icons/drone/location_fatal.png',
                                iconSize: [24, 24],
                                iconAnchor: [12, 24] // adjust to anchor to the bottom of the icon
                            })
                        }).addTo(map);

                        // Add a red line from the current position to the predicted coordinate
                        const lineCoordinates = [fatalState.position, predictedCoordinate];
                        L.polyline(lineCoordinates, {
                            color: 'red',
                            weight: 3,
                            opacity: 0.8
                        }).addTo(map);

                        // Mark this drone as having been rendered
                        renderedDrones.add(drone.id);
                    }
                }

                // Get the targetPosition data (coordinates)
                const targetPosition = drone.feedback.targetPosition;

                // Check if targetPosition is valid (not [0, 0])
                if (targetPosition && targetPosition[0] !== 0 && targetPosition[1] !== 0) {
                    // Initialize drone target state if it doesn't exist
                    if (!droneTargetStates[drone.id]) {
                        droneTargetStates[drone.id] = 'pickup'; // Start with 'pickup'
                    }

                    // If target position has changed (not equal to previous position)
                    const previousTargetPosition = dronePreviousPositions[drone.id];

                    if (!previousTargetPosition || !arraysAreEqual(previousTargetPosition, targetPosition)) {
                        // Update previous target position
                        dronePreviousPositions[drone.id] = targetPosition;

                        // Determine the new target type based on the current state
                        let targetType = null;
                        if (droneTargetStates[drone.id] === 'pickup') {
                            targetType = 'pickup';
                            droneTargetStates[drone.id] = 'dropoff';  // Transition to dropoff
                        } else if (droneTargetStates[drone.id] === 'dropoff') {
                            targetType = 'dropoff';
                            droneTargetStates[drone.id] = 'home';  // Transition to home
                        } else if (droneTargetStates[drone.id] === 'home') {
                            targetType = 'home';
                            delete droneTargetStates[drone.id]; // Remove state after home (or reset)
                        }

                        // Create or update the target marker on the map
                        if (targetType) {
                            const targetLatLng = L.latLng(targetPosition[0], targetPosition[1]);

                            // If target marker already exists, update it; otherwise, create a new marker
                            if (targetMarkers[drone.id]) {
                                targetMarkers[drone.id].setLatLng(targetLatLng);
                                targetMarkers[drone.id].setIcon(targetIcons[targetType]);
                            } else {
                                targetMarkers[drone.id] = L.marker(targetLatLng, { icon: targetIcons[targetType] })
                                    .addTo(map);
                            }
                        }
                    }
                }

            }
        });
    }

    // Function to clear historical path and remove polyline for a specific drone
    function clearDroneHistoricalPath(droneId) {
        // Remove the path from localStorage
        localStorage.removeItem(`dronePath-${droneId}`);

        // Remove the polyline from the map if it exists
        if (droneMarkers[droneId].historicalPath) {
            map.removeLayer(droneMarkers[droneId].historicalPath);
            droneMarkers[droneId].historicalPath = null; // Clear the polyline reference
        }
    }

    // Add a property to track the drone's heading
    function updateDronePosition(drone) {
        console.log(selectedDrone)
        const droneMarker = multi_drone_indicator[drone.id];
        if (droneMarker) {
            droneMarker.setLatLng(drone.feedback.currentPosition);
            droneMarker.setRotationAngle(drone.feedback.currentHeading);

            if (selectedDrone !== -1 && drone.id === selectedDrone) {
                map.setView(L.latLng(drone.feedback.currentPosition[0], drone.feedback.currentPosition[1]), map.getMaxZoom());
            } else if (selectedDrone === -1) {
                // Reset the map to its default center and zoom level when no drone is selected
                const defaultCenter = [2.9100729431148187, 101.65520813904638]; // Replace with your default center
                const defaultZoom = 18; // Replace with your default zoom level
                map.setView(defaultCenter, defaultZoom);
            }
        }
    }

    // Update historical path and store it
    function updateDroneHistoricalPath(drone) {
        const storedPath = JSON.parse(localStorage.getItem(`dronePath-${drone.id}`)) || [];
        storedPath.push(drone.feedback.currentPosition);

        if (drone.feedback.currentPosition[0] !== 0 && drone.feedback.currentPosition[1] !== 0) {
            // Limit the path size if needed (e.g., 1000 points max)
            if (storedPath.length > 1000) {
                storedPath.shift(); // Remove the oldest coordinate
            }

            // Save the updated path in localStorage
            localStorage.setItem(`dronePath-${drone.id}`, JSON.stringify(storedPath));

            // Update the polyline on the map
            if (droneMarkers[drone.id].historicalPath) {
                droneMarkers[drone.id].historicalPath.setLatLngs(storedPath);
            } else {
                const polyline = L.polyline(storedPath, { color: 'blue' }).addTo(map);
                droneMarkers[drone.id].historicalPath = polyline;
            }

        }
    }

    // Helper function to compare arrays
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
        const Rn = rangeComponent.rn;
        const Re = rangeComponent.re;
        const lat = lastPoint[0];
        const lon = lastPoint[1];

        const convertedLatLng = convertToLatLng(Rn, Re, lat);

        const dLat = convertedLatLng.dLat;
        const dLon = convertedLatLng.dLon;

        const dLatInDegrees = dLat * (180 / Math.PI);
        const predictedLat = lat + dLatInDegrees;

        const dLonInDegrees = dLon * (180 / Math.PI);
        const predictedLon = lon + dLonInDegrees;

        const predictedCoordinate = [predictedLat, predictedLon];

        return predictedCoordinate;
    }

    function convertToLatLng(Rn, Re, lat_original) {
        const earthRadius = 6378137;
        const latInRadians = lat_original * (Math.PI / 180);

        const dLat = Rn / earthRadius;
        const dLon = Re / (earthRadius * Math.cos(latInRadians));

        const convertedLatLng = {
            dLat: dLat,
            dLon: dLon
        }

        return convertedLatLng;
    }

    function calculateComponent(angle, range, quadrant) {
        const R = range;
        const theta = angle * (Math.PI / 180); // Convert angle to radians
        let Rn;
        let Re;

        switch (quadrant) {
            case 1:
                Rn = R * Math.cos(theta);
                Re = R * Math.sin(theta);
                break;
            case 2:
                Rn = -R * Math.cos(theta);
                Re = R * Math.sin(theta);
                break;
            case 3:
                Rn = -R * Math.cos(theta);
                Re = -R * Math.sin(theta);
                break;
            case 4:
                Rn = R * Math.cos(theta);
                Re = -R * Math.sin(theta);
                break;
        }

        return { rn: Rn, re: Re };
    }

    function getQuadrant(yaw, range) {
        let quadrant;
        let angle;
        if (yaw >= 0 && yaw < 90) {
            quadrant = 1;
            angle = yaw;
        } else if (yaw >= 90 && yaw < 180) {
            quadrant = 2;
            angle = 180 - yaw;
        } else if (yaw >= 180 && yaw < 270) {
            quadrant = 3;
            angle = 180 - Math.abs(yaw);
        } else {
            quadrant = 4;
            angle = Math.abs(yaw);
        }

        return calculateComponent(angle, range, quadrant);
    }

    // Search functionality
    const searchQueryInput = document.getElementById("searchQueryInput");
    const searchQuerySubmit = document.getElementById("searchQuerySubmit");

    // Update drone list based on search query
    function updateDroneListBySearch(query) {
        let filteredDroneArr = simulatedDroneArr.filter(drone => {
            // Search based on Drone ID or Connection Status
            const searchTerm = query.toLowerCase();
            return (
                drone.id.toString().includes(searchTerm) ||
                drone.feedback.connectionStatus.toLowerCase().includes(searchTerm)
            );
        });

        // Clear the existing drone data container
        let droneDataContainer = document.getElementById("droneDataContainer");
        droneDataContainer.innerHTML = "";  // Clear previous content

        // Loop through filtered drones and display their data
        filteredDroneArr.forEach(function (drone) {
            const fsmStateClass = drone.feedback.fsmState === 'Executing RTSH' ? 'blink-warning' : '';
            const warningIcon = drone.feedback.fsmState === 'Executing RTSH' ? '<span class="warning-icon">&#9888;</span>' : '';

            // Generate the HTML for each accordion item
            const droneHTML = `
                <div class="accordion-item">
                    <h6 class="accordion-header" id="heading-${drone.id}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                            data-bs-target="#collapse-${drone.id}" aria-expanded="false" aria-controls="collapse-${drone.id}">
                            <img src="./assets/img/icons/svg/drone-svgrepo-com.svg" alt="Drone Icon">
                            Drone ${drone.id}
                            <span class="ms-auto text-danger fw-bold" id="drone-connect-${drone.id}">${drone.feedback.connectionStatus}</span>
                        </button>
                    </h6>
                    <div id="collapse-${drone.id}" class="accordion-collapse collapse" aria-labelledby="heading-${drone.id}">
                        <div class="accordion-body" id="drone-details-${drone.id}">
                            <!-- Drone details will be dynamically updated here -->
                        </div>
                    </div>
                </div>`;
            droneDataContainer.innerHTML += droneHTML;

            // Update the details dynamically for each drone
            const droneDetailsElement = document.getElementById(`drone-details-${drone.id}`);
            if (droneDetailsElement) {
                droneDetailsElement.innerHTML = `
                    <hr class="horizontal dark my-1">
                    <p><strong>Connection Status:</strong> ${drone.feedback.connectionStatus}</p>
                    <p><strong>Drone Timestamp:</strong> ${drone.feedback.droneTimestamp}</p>
                    <p><strong>FSM State:</strong> ${drone.feedback.fsmState}</p>
                    <p><strong>Current Altitude:</strong> ${drone.feedback.currentAltitude} m</p>
                    <p><strong>Current Position:</strong> [${drone.feedback.currentPosition.join(", ")}]</p>
                    <p><strong>Current Speed:</strong> ${drone.feedback.currentSpeed} m/s</p>
                    <p><strong>Heading:</strong> ${drone.feedback.currentHeading}°</p>
                    <p><strong>Distance to Target:</strong> ${drone.feedback.distToTarget} m</p>
                    <p><strong>Battery Voltage:</strong> ${drone.feedback.batteryVoltage} V</p>
                    <p><strong>Weather State:</strong> ${drone.feedback.weatherState}</p>
                    <p><strong>Manned Flight State:</strong> ${drone.feedback.mannedFlightState}</p>
                `;
            }
        });
    }

    // Event listener for the search input
    searchQueryInput.addEventListener("input", function () {
        const query = searchQueryInput.value.trim();
        updateDroneListBySearch(query);
    });

    // If you want to submit on pressing the search button
    searchQuerySubmit.addEventListener("click", function () {
        const query = searchQueryInput.value.trim();
        updateDroneListBySearch(query);
    });

})
