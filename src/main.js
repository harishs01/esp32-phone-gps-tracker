import "./style.css";
import "leaflet/dist/leaflet.css";

import L from "leaflet";

import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue
} from "firebase/database";


// ============================================================
// FIREBASE
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBXII8F_9gHuAtcYmevI3QO_BatqTCQk8",
  authDomain: "esp32-phone-tracker.firebaseapp.com",
  databaseURL:
    "https://esp32-phone-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esp32-phone-tracker",
  storageBucket:
    "esp32-phone-tracker.firebasestorage.app",
  messagingSenderId: "491131343040",
  appId: "1:491131343040:web:c6e3a8ce949ebf55b6dd25",
  measurementId: "G-B91TCB5CH6"
};

const firebaseApp =
  initializeApp(firebaseConfig);

const database =
  getDatabase(firebaseApp);


// ============================================================
// STATE
// ============================================================

let startLat = null;
let startLon = null;
let startAccuracy = null;

let destLat = null;
let destLon = null;
let destAccuracy = null;

let startMarker = null;
let destinationMarker = null;
let routeLine = null;

let locationWatcher = null;

let navigationRunning = false;
let emergencyStopped = false;

let obstacleCount = 0;
let rerouteCount = 0;
let nodesExplored = 0;

let routeDistance = 0;
let routeETA = 0;

let lastRouteLat = null;
let lastRouteLon = null;

let routeBusy = false;

let cameraStream = null;
let visionRunning = false;

let detectedObstacle = false;
let lastVisionReroute = 0;

let heading = 0;

let eventLog = [];


// ============================================================
// LEAFLET ICON
// ============================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({

  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"

});


// ============================================================
// HTML
// ============================================================

document.querySelector("#app").innerHTML = `

<div class="navis-app">


  <!-- =====================================================
       HEADER
  ====================================================== -->

  <header class="topbar">

    <div class="brand">

      <div class="brand-symbol">
        ⦿
      </div>

      <div class="brand-text">

        <h1>NAVIS-AI</h1>

        <span>
          AUTONOMOUS NAVIGATION SYSTEM
        </span>

      </div>

    </div>


    <div class="system-info">

      <div class="system-online">
        <span class="online-light"></span>
        SYSTEM ONLINE
      </div>

      <div class="unit-id">
        UNIT NV-07
      </div>

      <div class="unit-number">
        07
      </div>

    </div>

  </header>



  <!-- =====================================================
       TITLE
  ====================================================== -->

  <section class="command-header">

    <div>

      <div class="command-label">
        COMMAND CENTER / LIVE OPERATIONS
      </div>

      <h2>
        Navigation
        <span>telemetry</span>
      </h2>

    </div>


    <div class="header-actions">

      <button
        id="demoModeBtn"
        class="demo-btn active"
      >
        ◉ DEMO MODE
        <span class="toggle">
          <i></i>
        </span>
      </button>


      <button
        id="cameraHeaderBtn"
        class="camera-connect"
      >
        ▣ CONNECT CAMERA
      </button>

    </div>

  </section>



  <!-- =====================================================
       TELEMETRY CARDS
  ====================================================== -->

  <section class="telemetry-grid">


    <div class="telemetry-card cyan">

      <div class="telemetry-label">
        PATH DISTANCE
      </div>

      <div class="telemetry-main">

        <div class="telemetry-icon">
          ◎
        </div>

        <strong id="pathDistance">
          0 m
        </strong>

      </div>

      <div
        class="telemetry-sub"
        id="nodesExplored"
      >
        0 nodes explored
      </div>

    </div>



    <div class="telemetry-card yellow">

      <div class="telemetry-label">
        OBSTACLES DETECTED
      </div>

      <div class="telemetry-main">

        <div class="telemetry-icon">
          ⛶
        </div>

        <strong id="obstacleCount">
          0
        </strong>

      </div>

      <div class="telemetry-sub">
        CV perception layer
      </div>

    </div>



    <div class="telemetry-card pink">

      <div class="telemetry-label">
        RE-ROUTES
      </div>

      <div class="telemetry-main">

        <div class="telemetry-icon">
          ↻
        </div>

        <strong id="rerouteCount">
          0
        </strong>

      </div>

      <div
        class="telemetry-sub"
        id="optimizationText"
      >
        A* optimization cycles
      </div>

    </div>



    <div class="telemetry-card green">

      <div class="telemetry-label">
        BATTERY
      </div>

      <div class="telemetry-main">

        <div class="telemetry-icon">
          ◔
        </div>

        <strong id="batteryValue">
          87%
        </strong>

      </div>

      <div
        class="telemetry-sub"
        id="batteryETA"
      >
        Est. 42 min remaining
      </div>

    </div>


  </section>



  <!-- =====================================================
       MAIN DASHBOARD
  ====================================================== -->

  <section class="dashboard-grid">


    <!-- ===================================================
         MAP
    ==================================================== -->

    <div class="map-panel">

      <div class="panel-header">

        <div>

          <div class="section-label">
            LIVE NAVIGATION MAP
          </div>

          <h3>
            Spatial map
            <span class="live-label">
              ● LIVE
            </span>
          </h3>

        </div>


        <div class="map-legend">

          <span>
            <i class="legend-path"></i>
            PATH
          </span>

          <span>
            <i class="legend-obstacle"></i>
            OBSTACLE
          </span>

          <span>
            <i class="legend-explored"></i>
            EXPLORED
          </span>

        </div>

      </div>


      <div
        id="map"
        class="main-map"
      ></div>


      <div class="map-overlay-info">

        <div class="route-status">

          <span class="pulse"></span>

          <strong id="routeStatus">
            A* READY
          </strong>

          <span id="routeSteps">
            0 steps / 0 m
          </span>

        </div>


        <div class="target-info">

          <span>
            ◉
            <b>YOU</b>
          </span>

          <span>
            ›
          </span>

          <span>
            ◉
            <b>ESP32 TARGET</b>
          </span>

        </div>

      </div>

    </div>



    <!-- ===================================================
         RIGHT PANEL
    ==================================================== -->

    <aside class="right-panel">


      <!-- VISION -->
      <div class="vision-panel">

        <div class="section-label">
          PERCEPTION LAYER
        </div>


        <div class="vision-heading">

          <h3>
            Vision feed
          </h3>

          <div
            id="visionMode"
            class="simulated"
          >
            ● SIMULATED
          </div>

        </div>


        <div class="vision-window">

          <video
            id="camera"
            autoplay
            playsinline
            muted
          ></video>


          <div
            id="visionPlaceholder"
            class="vision-placeholder"
          >

            <div class="radar">
              ⦿
            </div>

            <span>
              VISION SENSOR STANDBY
            </span>

            <small>
              Connect browser camera
            </small>

          </div>


          <div class="vision-grid"></div>


          <div
            id="visionBox1"
            class="vision-box person"
          >
            <span>
              PERSON
              <b>0.94</b>
            </span>
          </div>


          <div
            id="visionBox2"
            class="vision-box object"
          >
            <span>
              OBJECT
              <b>0.89</b>
            </span>
          </div>


          <div class="vision-crosshair">
            +
          </div>


          <div class="vision-bottom">

            <span>
              ● LIVE
              <small id="visionTime">
                00:00:00
              </small>
            </span>

            <span>
              FPS <b>30</b>
            </span>

          </div>

        </div>


        <button
          id="enableCameraBtn"
          class="camera-enable"
        >
          ▣ ENABLE BROWSER CAMERA
        </button>


        <div
          id="visionStatus"
          class="vision-status"
        >
          Camera inactive
        </div>

      </div>



      <!-- SYSTEM ACTIVITY -->
      <div class="activity-panel">

        <div class="activity-header">

          <div class="section-label">
            SYSTEM ACTIVITY
          </div>

          <span id="eventCount">
            0 EVENTS
          </span>

        </div>


        <h3>
          Event log
        </h3>


        <div
          id="eventLog"
          class="event-log"
        >

          <div class="empty-log">
            Waiting for system events...
          </div>

        </div>

      </div>



      <!-- TELEMETRY -->
      <div class="mini-panel">

        <div class="mini-row">

          <span>
            📍 START
          </span>

          <strong id="startCoords">
            WAITING
          </strong>

        </div>


        <div class="mini-row">

          <span>
            📡 TARGET
          </span>

          <strong id="targetCoords">
            WAITING
          </strong>

        </div>


        <div class="mini-row">

          <span>
            🧭 HEADING
          </span>

          <strong id="headingValue">
            N 0°
          </strong>

        </div>

      </div>


    </aside>


  </section>



  <!-- =====================================================
       BOTTOM CONTROL BAR
  ====================================================== -->

  <footer class="control-bar">


    <div class="navigation-state">

      <span
        id="stateDot"
        class="state-dot paused"
      ></span>

      <div>

        <strong id="navigationState">
          NAVIGATION PAUSED
        </strong>

        <span id="navigationMessage">
          Balanced priority · 1-cell safety zone
        </span>

      </div>

    </div>


    <div class="control-buttons">


      <button
        id="startBtn"
        class="control start"
      >
        ▶ START
      </button>


      <button
        id="addObstacleBtn"
        class="control"
      >
        □ ADD OBSTACLE
      </button>


      <button
        id="resetBtn"
        class="control"
      >
        ↻ RESET
      </button>


      <button
        id="emergencyBtn"
        class="control emergency"
      >
        ⏻ EMERGENCY STOP
      </button>


    </div>

  </footer>

</div>
`;


// ============================================================
// ELEMENTS
// ============================================================

const $ = (id) =>
  document.getElementById(id);

const locationBtn =
  $("startBtn");

const addObstacleBtn =
  $("addObstacleBtn");

const resetBtn =
  $("resetBtn");

const emergencyBtn =
  $("emergencyBtn");

const cameraBtn =
  $("enableCameraBtn");

const cameraHeaderBtn =
  $("cameraHeaderBtn");

const routeStatus =
  $("routeStatus");

const navigationState =
  $("navigationState");

const navigationMessage =
  $("navigationMessage");

const stateDot =
  $("stateDot");


// ============================================================
// MAP
// ============================================================

const map =
  L.map("map", {
    zoomControl: true
  }).setView(
    [13.0827, 80.2707],
    13
  );


L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,

    attribution:
      "&copy; OpenStreetMap contributors"
  }
).addTo(map);


// ============================================================
// EVENT LOG
// ============================================================

function addEvent(
  message,
  type = "system"
) {

  const now =
    new Date();

  const time =
    now.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    );


  eventLog.unshift({
    message,
    time,
    type
  });


  if (
    eventLog.length > 6
  ) {

    eventLog =
      eventLog.slice(
        0,
        6
      );

  }


  renderEvents();

}


function renderEvents() {

  $("eventCount").textContent =
    `${eventLog.length} EVENTS`;


  if (
    eventLog.length === 0
  ) {

    $("eventLog").innerHTML = `
      <div class="empty-log">
        Waiting for system events...
      </div>
    `;

    return;

  }


  $("eventLog").innerHTML =
    eventLog
      .map(
        (event) => `

        <div class="event">

          <div class="event-icon">
            ◉
          </div>

          <div class="event-content">

            <strong>
              ${event.message}
            </strong>

            <span>
              ${event.time}
            </span>

          </div>

        </div>
      `
      )
      .join("");

}


// ============================================================
// INITIAL EVENTS
// ============================================================

addEvent(
  "NAVIS-AI core online — route ready"
);

addEvent(
  "A* pathfinding engine initialized"
);


// ============================================================
// GPS DISTANCE
// ============================================================

function distanceBetween(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R =
    6371000;

  const dLat =
    (lat2 - lat1) *
    Math.PI /
    180;

  const dLon =
    (lon2 - lon1) *
    Math.PI /
    180;


  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +

    Math.cos(
      lat1 *
      Math.PI /
      180
    ) *

    Math.cos(
      lat2 *
      Math.PI /
      180
    ) *

    Math.sin(
      dLon / 2
    ) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );


  return R * c;

}


// ============================================================
// UPDATE START MARKER
// ============================================================

function updateStartMarker() {

  if (
    startLat === null
  ) {

    return;

  }


  if (
    startMarker
  ) {

    startMarker.setLatLng([
      startLat,
      startLon
    ]);

  }

  else {

    startMarker =
      L.marker([
        startLat,
        startLon
      ])
        .addTo(map)
        .bindPopup(
          "<b>YOU ARE HERE</b>"
        );

  }


  $("startCoords").textContent =
    `${startLat.toFixed(5)}, ${startLon.toFixed(5)}`;

}


// ============================================================
// UPDATE DESTINATION
// ============================================================

function updateDestinationMarker() {

  if (
    destLat === null
  ) {

    return;

  }


  if (
    destinationMarker
  ) {

    destinationMarker.setLatLng([
      destLat,
      destLon
    ]);

  }

  else {

    destinationMarker =
      L.marker([
        destLat,
        destLon
      ])
        .addTo(map)
        .bindPopup(
          "<b>ESP32 TARGET</b>"
        );

  }


  $("targetCoords").textContent =
    `${destLat.toFixed(5)}, ${destLon.toFixed(5)}`;

}


// ============================================================
// LIVE LAPTOP GPS
// ============================================================

locationBtn.addEventListener(
  "click",
  () => {

    if (
      !navigator.geolocation
    ) {

      addEvent(
        "Browser GPS unavailable",
        "error"
      );

      return;

    }


    if (
      locationWatcher !== null
    ) {

      navigator.geolocation.clearWatch(
        locationWatcher
      );

      locationWatcher =
        null;


      locationBtn.textContent =
        "▶ START";


      $("startStatus").textContent =
        "GPS stopped";

      return;

    }


    navigationMessage.textContent =
      "Acquiring high accuracy GPS position";


    locationWatcher =
      navigator.geolocation.watchPosition(

        async (position) => {

          startLat =
            position.coords.latitude;

          startLon =
            position.coords.longitude;

          startAccuracy =
            position.coords.accuracy;


          updateStartMarker();


          $("pathDistance").textContent =
            routeDistance > 1000
              ? `${(
                  routeDistance /
                  1000
                ).toFixed(2)} km`
              : `${Math.round(
                  routeDistance
                )} m`;


          if (
            lastRouteLat === null
          ) {

            lastRouteLat =
              startLat;

            lastRouteLon =
              startLon;


            map.setView(
              [
                startLat,
                startLon
              ],
              16
            );


            addEvent(
              "Live GPS lock acquired"
            );


            if (
              destLat !== null
            ) {

              await calculateRoute(
                false
              );

            }

            return;

          }


          const moved =
            distanceBetween(
              lastRouteLat,
              lastRouteLon,
              startLat,
              startLon
            );


          /*
            Re-route every 25m.
          */

          if (
            moved >= 25 &&
            destLat !== null &&
            navigationRunning &&
            !emergencyStopped
          ) {

            lastRouteLat =
              startLat;

            lastRouteLon =
              startLon;


            await calculateRoute(
              true
            );

          }


          $("mapStatus") &&
            (
              $("mapStatus").textContent =
                "● LIVE GPS"
            );

        },

        (error) => {

          console.error(
            error
          );


          let msg =
            "GPS error";


          if (
            error.code === 1
          ) {

            msg =
              "Location permission denied";

          }

          else if (
            error.code === 2
          ) {

            msg =
              "Location unavailable";

          }

          else if (
            error.code === 3
          ) {

            msg =
              "GPS timeout";

          }


          addEvent(
            msg,
            "error"
          );

          navigationMessage.textContent =
            msg;

        },

        {
          enableHighAccuracy:
            true,

          timeout:
            15000,

          maximumAge:
            1000

        }
      );


    locationBtn.textContent =
      "⏸ PAUSE GPS";


    addEvent(
      "Laptop live-position tracking enabled"
    );

  }
);


// ============================================================
// FIREBASE ESP32
// ============================================================

const locationRef =
  ref(
    database,
    "location"
  );


onValue(
  locationRef,

  (snapshot) => {

    const data =
      snapshot.val();


    if (
      !data
    ) {

      return;

    }


    const lat =
      Number(
        data.latitude
      );

    const lon =
      Number(
        data.longitude
      );


    const accuracy =
      Number(
        data.accuracy || 0
      );


    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {

      return;

    }


    const changed =
      destLat !== lat ||
      destLon !== lon;


    destLat =
      lat;

    destLon =
      lon;

    destAccuracy =
      accuracy;


    updateDestinationMarker();


    if (
      changed
    ) {

      addEvent(
        "ESP32 target position updated"
      );

    }


    /*
      Automatically calculate route
      if navigation is active.
    */

    if (
      navigationRunning &&
      startLat !== null
    ) {

      calculateRoute(
        true
      );

    }

  },

  (error) => {

    console.error(
      error
    );


    addEvent(
      "Firebase connection error",
      "error"
    );

  }
);


// ============================================================
// ROUTING
// ============================================================

async function calculateRoute(
  rerouting = false
) {

  if (
    routeBusy
  ) {

    return;

  }


  if (
    startLat === null ||
    startLon === null
  ) {

    addEvent(
      "Start GPS position required",
      "error"
    );

    return;

  }


  if (
    destLat === null ||
    destLon === null
  ) {

    addEvent(
      "ESP32 target not available",
      "error"
    );

    return;

  }


  routeBusy =
    true;


  routeStatus.textContent =
    rerouting
      ? "A* RE-ROUTING..."
      : "CALCULATING PATH";


  navigationMessage.textContent =
    rerouting
      ? "Dynamic obstacle / position update detected"
      : "Computing optimal road path";


  try {

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${startLon},${startLat};` +
      `${destLon},${destLat}` +
      `?overview=full&geometries=geojson&alternatives=true`;


    const response =
      await fetch(
        url
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Routing service error"
      );

    }


    const data =
      await response.json();


    if (
      data.code !== "Ok" ||
      !data.routes?.length
    ) {

      throw new Error(
        "No route found"
      );

    }


    /*
      Select shortest route.
    */

    let best =
      data.routes[0];


    for (
      const candidate of data.routes
    ) {

      if (
        candidate.distance <
        best.distance
      ) {

        best =
          candidate;

      }

    }


    routeDistance =
      best.distance;

    routeETA =
      Math.round(
        best.duration / 60
      );


    nodesExplored =
      best.geometry
        .coordinates
        .length;


    /*
      Draw route.
    */

    const coords =
      best.geometry
        .coordinates
        .map(
          (point) => [
            point[1],
            point[0]
          ]
        );


    if (
      routeLine
    ) {

      map.removeLayer(
        routeLine
      );

    }


    routeLine =
      L.polyline(
        coords,
        {
          weight: 6,
          opacity: 0.95,
          lineCap:
            "round",
          lineJoin:
            "round"
        }
      ).addTo(map);


    /*
      Don't zoom out every time GPS
      updates. Only fit initially or
      when rerouting.
    */

    if (
      !rerouting ||
      routeDistance > 0
    ) {

      map.fitBounds(
        routeLine.getBounds(),
        {
          padding: [
            70,
            70
          ]
        }
      );

    }


    updateTelemetry();


    if (
      rerouting
    ) {

      rerouteCount++;

      $("rerouteCount").textContent =
        rerouteCount;


      addEvent(
        "A* calculated new safe route"
      );

    }

    else {

      addEvent(
        "A* calculated optimal path to target"
      );

    }


    routeStatus.textContent =
      "A* OPTIMIZED PATH";


    navigationMessage.textContent =
      `${nodesExplored} road nodes analyzed · dynamic routing ready`;

  }

  catch (error) {

    console.error(
      error
    );


    routeStatus.textContent =
      "ROUTE ERROR";


    navigationMessage.textContent =
      "Unable to calculate road path";


    addEvent(
      "Route calculation failed",
      "error"
    );

  }


  routeBusy =
    false;

}


// ============================================================
// TELEMETRY
// ============================================================

function updateTelemetry() {

  $("pathDistance").textContent =
    routeDistance >= 1000
      ? `${(
          routeDistance /
          1000
        ).toFixed(2)} km`
      : `${Math.round(
          routeDistance
        )} m`;


  $("nodesExplored").textContent =
    `${nodesExplored} nodes explored`;


  $("routeSteps").textContent =
    `${nodesExplored} nodes / ${
      routeDistance >= 1000
        ? (
            routeDistance /
            1000
          ).toFixed(2) +
          " km"
        : Math.round(
            routeDistance
          ) +
          " m"
    }`;


  $("optimizationText").textContent =
    `${rerouteCount} A* optimization cycles`;

}


// ============================================================
// START NAVIGATION
// ============================================================

$("startBtn").addEventListener(
  "click",
  async () => {

    if (
      emergencyStopped
    ) {

      addEvent(
        "Reset system before restarting",
        "error"
      );

      return;

    }


    if (
      startLat === null
    ) {

      addEvent(
        "Acquire laptop GPS first",
        "error"
      );

      /*
        Trigger GPS button.
      */

      locationBtn.click();

      return;

    }


    if (
      destLat === null
    ) {

      addEvent(
        "Waiting for ESP32 destination",
        "error"
      );

      return;

    }


    navigationRunning =
      true;


    stateDot.className =
      "state-dot running";


    navigationState.textContent =
      "NAVIGATION ACTIVE";


    navigationMessage.textContent =
      "A* path active · live position tracking";


    $("startBtn").textContent =
      "⏸ PAUSE";


    addEvent(
      "Navigation started — route active"
    );


    await calculateRoute(
      false
    );

  }
);


// ============================================================
// PAUSE / RESUME
// ============================================================

$("startBtn").addEventListener(
  "dblclick",
  () => {

    navigationRunning =
      false;


    stateDot.className =
      "state-dot paused";


    navigationState.textContent =
      "NAVIGATION PAUSED";


    navigationMessage.textContent =
      "Awaiting navigation resume";

  }
);


// ============================================================
// A* OBSTACLE NAVIGATION
// ============================================================

let obstacleMarkers = [];
let astarLine = null;
let originalRouteLine = null;

const GRID_SIZE = 35;
const OBSTACLE_RADIUS_METERS = 70;


// ------------------------------------------------------------
// GPS DISTANCE
// ------------------------------------------------------------

function geoDistance(a, b) {

  return distanceBetween(
    a.lat,
    a.lon,
    b.lat,
    b.lon
  );

}


// ------------------------------------------------------------
// CREATE GRID
// ------------------------------------------------------------

function createNavigationGrid() {

  if (
    startLat === null ||
    destLat === null
  ) {
    return null;
  }


  const minLat =
    Math.min(
      startLat,
      destLat
    );

  const maxLat =
    Math.max(
      startLat,
      destLat
    );

  const minLon =
    Math.min(
      startLon,
      destLon
    );

  const maxLon =
    Math.max(
      startLon,
      destLon
    );


  /*
    Add safety margin around route.
  */

  const latMargin =
    Math.max(
      (maxLat - minLat) * 0.25,
      0.002
    );

  const lonMargin =
    Math.max(
      (maxLon - minLon) * 0.25,
      0.002
    );


  const gridMinLat =
    minLat - latMargin;

  const gridMaxLat =
    maxLat + latMargin;

  const gridMinLon =
    minLon - lonMargin;

  const gridMaxLon =
    maxLon + lonMargin;


  const grid = [];


  for (
    let r = 0;
    r < GRID_SIZE;
    r++
  ) {

    grid[r] = [];

    for (
      let c = 0;
      c < GRID_SIZE;
      c++
    ) {

      const lat =
        gridMinLat +
        (
          r /
          (GRID_SIZE - 1)
        ) *
        (
          gridMaxLat -
          gridMinLat
        );


      const lon =
        gridMinLon +
        (
          c /
          (GRID_SIZE - 1)
        ) *
        (
          gridMaxLon -
          gridMinLon
        );


      grid[r][c] = {
        row: r,
        col: c,
        lat,
        lon,
        blocked: false
      };

    }

  }


  return grid;

}


// ------------------------------------------------------------
// FIND NEAREST GRID CELL
// ------------------------------------------------------------

function nearestGridCell(
  grid,
  lat,
  lon
) {

  let best =
    null;

  let bestDistance =
    Infinity;


  for (
    const row of grid
  ) {

    for (
      const cell of row
    ) {

      const d =
        distanceBetween(
          lat,
          lon,
          cell.lat,
          cell.lon
        );


      if (
        d < bestDistance
      ) {

        bestDistance =
          d;

        best =
          cell;

      }

    }

  }


  return best;

}


// ------------------------------------------------------------
// MARK OBSTACLES
// ------------------------------------------------------------

function applyObstaclesToGrid(
  grid
) {

  for (
    const row of grid
  ) {

    for (
      const cell of row
    ) {

      for (
        const obstacle of obstacleMarkers
      ) {

        const obstacleLat =
          obstacle.getLatLng().lat;

        const obstacleLon =
          obstacle.getLatLng().lng;


        const d =
          distanceBetween(
            cell.lat,
            cell.lon,
            obstacleLat,
            obstacleLon
          );


        if (
          d <=
          OBSTACLE_RADIUS_METERS
        ) {

          cell.blocked =
            true;

        }

      }

    }

  }

}


// ------------------------------------------------------------
// A* HEURISTIC
// ------------------------------------------------------------

function heuristic(
  a,
  b
) {

  return Math.sqrt(
    Math.pow(
      a.row - b.row,
      2
    ) +
    Math.pow(
      a.col - b.col,
      2
    )
  );

}


// ------------------------------------------------------------
// A* SEARCH
// ------------------------------------------------------------

function runAStar(
  grid,
  start,
  goal
) {

  const openSet = [];

  const cameFrom =
    new Map();

  const gScore =
    new Map();

  const fScore =
    new Map();


  const key = (
    cell
  ) =>
    `${cell.row},${cell.col}`;


  gScore.set(
    key(start),
    0
  );


  fScore.set(
    key(start),
    heuristic(
      start,
      goal
    )
  );


  openSet.push({
    cell: start,
    score:
      fScore.get(
        key(start)
      )
  });


  const directions = [

    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],

    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]

  ];


  let explored = 0;


  while (
    openSet.length > 0
  ) {

    openSet.sort(
      (
        a,
        b
      ) =>
        a.score -
        b.score
    );


    const current =
      openSet.shift().cell;


    explored++;


    if (
      current === goal ||
      (
        current.row ===
        goal.row &&
        current.col ===
        goal.col
      )
    ) {

      const path = [];

      let currentKey =
        key(current);


      path.unshift(
        current
      );


      while (
        cameFrom.has(
          currentKey
        )
      ) {

        const previous =
          cameFrom.get(
            currentKey
          );


        path.unshift(
          previous
        );


        currentKey =
          key(previous);

      }


      return {
        path,
        explored
      };

    }


    for (
      const direction of directions
    ) {

      const nr =
        current.row +
        direction[0];

      const nc =
        current.col +
        direction[1];


      if (
        nr < 0 ||
        nr >= GRID_SIZE ||
        nc < 0 ||
        nc >= GRID_SIZE
      ) {

        continue;

      }


      const neighbor =
        grid[nr][nc];


      if (
        neighbor.blocked
      ) {

        continue;

      }


      const moveCost =
        (
          direction[0] !== 0 &&
          direction[1] !== 0
        )
          ? 1.414
          : 1;


      const tentative =
        (
          gScore.get(
            key(current)
          ) ?? Infinity
        ) +
        moveCost;


      const neighborKey =
        key(neighbor);


      if (
        tentative <
        (
          gScore.get(
            neighborKey
          ) ?? Infinity
        )
      ) {

        cameFrom.set(
          neighborKey,
          current
        );


        gScore.set(
          neighborKey,
          tentative
        );


        const score =
          tentative +
          heuristic(
            neighbor,
            goal
          );


        fScore.set(
          neighborKey,
          score
        );


        openSet.push({
          cell:
            neighbor,

          score
        });

      }

    }

  }


  return {
    path: [],
    explored
  };

}


// ------------------------------------------------------------
// RUN A* REROUTING
// ------------------------------------------------------------

function calculateAStarRoute() {

  if (
    startLat === null ||
    destLat === null
  ) {

    addEvent(
      "Start and destination required",
      "error"
    );

    return;

  }


  const grid =
    createNavigationGrid();


  if (!grid) {

    return;

  }


  applyObstaclesToGrid(
    grid
  );


  const start =
    nearestGridCell(
      grid,
      startLat,
      startLon
    );


  const goal =
    nearestGridCell(
      grid,
      destLat,
      destLon
    );


  /*
    Make sure START and TARGET
    aren't blocked.
  */

  start.blocked =
    false;

  goal.blocked =
    false;


  const result =
    runAStar(
      grid,
      start,
      goal
    );


  nodesExplored =
    result.explored;


  $("nodesExplored").textContent =
    `${nodesExplored} nodes explored`;


  if (
    result.path.length === 0
  ) {

    routeStatus.textContent =
      "NO SAFE PATH";


    navigationMessage.textContent =
      "A* could not find a path around obstacles";


    addEvent(
      "A* failed — destination unreachable",
      "error"
    );


    return;

  }


  /*
    Convert A* cells into Leaflet coordinates.
  */

  const coordinates =
    result.path.map(
      cell => [
        cell.lat,
        cell.lon
      ]
    );


  /*
    Remove previous A* route.
  */

  if (
    astarLine
  ) {

    map.removeLayer(
      astarLine
    );

  }


  /*
    Draw new A* route.
  */

  astarLine =
    L.polyline(
      coordinates,
      {
        color:
          "#ff3f8b",

        weight:
          6,

        opacity:
          0.95,

        lineCap:
          "round",

        lineJoin:
          "round"
      }
    ).addTo(map);


  /*
    Calculate new route distance.
  */

  let totalDistance =
    0;


  for (
    let i = 1;
    i < coordinates.length;
    i++
  ) {

    totalDistance +=
      distanceBetween(
        {
          lat:
            coordinates[i - 1][0],

          lon:
            coordinates[i - 1][1]
        },

        {
          lat:
            coordinates[i][0],

          lon:
            coordinates[i][1]
        }
      );

  }


  routeDistance =
    totalDistance;


  $("pathDistance").textContent =
    totalDistance >= 1000
      ? `${(
          totalDistance /
          1000
        ).toFixed(2)} km`
      : `${Math.round(
          totalDistance
        )} m`;


  $("routeSteps").textContent =
    `${result.path.length} steps / ${
      Math.round(
        totalDistance
      )
    } m`;


  $("rerouteCount").textContent =
    rerouteCount;


  routeStatus.textContent =
    "A* OPTIMIZED PATH";


  navigationMessage.textContent =
    `Obstacle avoided · ${result.explored} nodes explored`;


  addEvent(
    `A* found alternate safe path — ${result.explored} nodes explored`
  );

}


// ============================================================
// ADD OBSTACLE ON CURRENT ROUTE
// ============================================================

addObstacleBtn.addEventListener(
  "click",
  () => {

    if (
      !startLat ||
      !destLat
    ) {

      addEvent(
        "Start navigation before adding obstacle",
        "error"
      );

      return;

    }


    /*
      If original OSRM route exists,
      choose a point around the middle.
    */

    let obstacleLat;
    let obstacleLon;


    if (
      routeLine
    ) {

      const route =
        routeLine.getLatLngs();


      /*
        Pick a point in the middle
        of current route.
      */

      const index =
        Math.floor(
          route.length / 2
        );


      const point =
        route[index];


      obstacleLat =
        point.lat;

      obstacleLon =
        point.lng;

    }

    else {

      /*
        Fallback: midpoint.
      */

      obstacleLat =
        (
          startLat +
          destLat
        ) / 2;

      obstacleLon =
        (
          startLon +
          destLon
        ) / 2;

    }


    /*
      Create visible obstacle.
    */

    const obstacle =
      L.circle(
        [
          obstacleLat,
          obstacleLon
        ],
        {
          radius:
            OBSTACLE_RADIUS_METERS,

          color:
            "#ff3f79",

          fillColor:
            "#ff3f79",

          fillOpacity:
            0.22,

          weight:
            2
        }
      )
        .addTo(map)
        .bindPopup(
          "<b>🚧 BLOCKED AREA</b><br>A* obstacle"
        );


    obstacleMarkers.push(
      obstacle
    );


    obstacleCount++;


    $("obstacleCount").textContent =
      obstacleCount;


    addEvent(
      `Obstacle ${obstacleCount} added to current path`
    );


    /*
      Hide original route visually.
    */

    if (
      routeLine
    ) {

      routeLine.setStyle({
        opacity:
          0.20,

        dashArray:
          "8 10"
      });

    }


    /*
      Increase reroute counter.
    */

    rerouteCount++;


    /*
      Run REAL A*.
    */

    calculateAStarRoute();

  }
);


// ============================================================
// EMERGENCY STOP
// ============================================================

emergencyBtn.addEventListener(
  "click",
  () => {

    emergencyStopped =
      true;

    navigationRunning =
      false;


    stateDot.className =
      "state-dot emergency";


    navigationState.textContent =
      "EMERGENCY STOP";


    navigationMessage.textContent =
      "All autonomous navigation halted";


    routeStatus.textContent =
      "NAVIGATION HALTED";


    addEvent(
      "EMERGENCY STOP ACTIVATED",
      "error"
    );

  }
);


// ============================================================
// CAMERA
// ============================================================

async function startCamera() {

  if (
    cameraStream
  ) {

    stopCamera();

    return;

  }


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    addEvent(
      "Browser camera API unavailable",
      "error"
    );

    return;

  }


  try {

    cameraStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video: {
            facingMode:
              "environment"
          },

          audio: false
        }
      );


    $("camera").srcObject =
      cameraStream;


    $("camera").style.display =
      "block";


    $("visionPlaceholder").style.display =
      "none";


    cameraBtn.textContent =
      "⛔ STOP CAMERA";


    cameraHeaderBtn.textContent =
      "⛔ CAMERA ACTIVE";


    $("visionMode").textContent =
      "● LIVE CAMERA";


    $("visionMode").className =
      "live-camera";


    $("visionStatus").textContent =
      "🟢 Vision feed active";


    $("visionStatus").className =
      "vision-status";


    visionRunning =
      true;


    addEvent(
      "Browser camera connected"
    );


    runVision();

  }

  catch (error) {

    console.error(
      error
    );


    addEvent(
      "Camera permission denied",
      "error"
    );

  }

}


function stopCamera() {

  visionRunning =
    false;


  if (
    cameraStream
  ) {

    cameraStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

  }


  cameraStream =
    null;


  $("camera").srcObject =
    null;


  $("camera").style.display =
    "none";


  $("visionPlaceholder").style.display =
    "flex";


  cameraBtn.textContent =
    "▣ ENABLE BROWSER CAMERA";


  cameraHeaderBtn.textContent =
    "▣ CONNECT CAMERA";


  $("visionMode").textContent =
    "● SIMULATED";


  $("visionMode").className =
    "simulated";


  $("visionStatus").textContent =
    "Camera inactive";

}


cameraBtn.addEventListener(
  "click",
  startCamera
);


cameraHeaderBtn.addEventListener(
  "click",
  startCamera
);


// ============================================================
// SIMPLE VISION PROTOTYPE
// ============================================================

function runVision() {

  if (
    !visionRunning ||
    !cameraStream
  ) {

    return;

  }


  /*
    This version only provides a browser
    vision trigger.

    Real object recognition should later
    use OpenCV.js / YOLO.
  */


  $("visionTime").textContent =
    new Date().toLocaleTimeString();


  /*
    Simulated perception pulse.

    Every ~8 seconds randomly trigger
    a low-frequency obstacle event.
  */

  if (
    Math.random() < 0.002
  ) {

    obstacleCount++;

    $("obstacleCount").textContent =
      obstacleCount;


    $("visionStatus").textContent =
      "⚠️ OBJECT DETECTED";


    addEvent(
      "Vision system detected dynamic object"
    );


    const now =
      Date.now();


    if (
      now -
      lastVisionReroute >
      10000
    ) {

      lastVisionReroute =
        now;


      if (
        navigationRunning
      ) {

        calculateRoute(
          true
        );

      }

    }

  }


  requestAnimationFrame(
    runVision
  );

}


// ============================================================
// DEMO MODE
// ============================================================

$("demoModeBtn").addEventListener(
  "click",
  () => {

    const btn =
      $("demoModeBtn");


    btn.classList.toggle(
      "active"
    );


    const enabled =
      btn.classList.contains(
        "active"
      );


    addEvent(
      enabled
        ? "Demo simulation mode enabled"
        : "Demo simulation mode disabled"
    );

  }
);


// ============================================================
// HEADING
// ============================================================

function updateHeading(
  degrees
) {

  heading =
    degrees;


  let direction =
    "N";


  if (
    degrees >= 45 &&
    degrees < 135
  ) {

    direction =
      "E";

  }

  else if (
    degrees >= 135 &&
    degrees < 225
  ) {

    direction =
      "S";

  }

  else if (
    degrees >= 225 &&
    degrees < 315
  ) {

    direction =
      "W";

  }


  $("headingValue").textContent =
    `${direction} ${Math.round(
      degrees
    )}°`;

}


updateHeading(
  0
);


// ============================================================
// INITIAL UI
// ============================================================

updateTelemetry();

renderEvents();
