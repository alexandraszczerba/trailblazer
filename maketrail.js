// Ensure CesiumJS is loaded
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMzY5MGQwNy1kMzc1LTQwODItOTEyYS0zMzA0OWQ0OGE2NjUiLCJpZCI6MjU1NjMwLCJpYXQiOjE3MzE3MjI4MTF9.Kz18W1PwUWiwbUU72gEkqSNmGCcojyE12eDgpBM8U-8';

// Initialize the Cesium Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    animation: false, // Disable animation controls
    timeline: false,  // Disable timeline
    fullscreenButton: false,
    baseLayerPicker: false
});

// Fly to an initial location (Mt. Baldy)
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-117.64607, 34.0, 10500),
    orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-15.0),
        roll: 0.0
    }
});

// Variables to keep track of points
let points = [];

// Info box to display coordinates and elevation
const infoBox = document.getElementById('infoBox');

// Create a handler for user interactions
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

handler.setInputAction(function (click) {
    if (points.length >= 5) {
        alert('You can only place up to 5 points.');
        return;
    }

    // Get the position where the user clicked
    const earthPosition = viewer.scene.pickPosition(click.position);
    if (Cesium.defined(earthPosition)) {
        // Get the longitude, latitude, and height
        const cartographic = Cesium.Cartographic.fromCartesian(earthPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

        // Sample terrain to get elevation
        viewer.terrainProvider.sampleTerrainMostDetailed([cartographic])
            .then(([updatedCartographic]) => {
                const elevation = updatedCartographic.height.toFixed(2);

                // Update the info box with coordinates and elevation
                infoBox.innerHTML = `Point ${points.length + 1}:<br>
                    Longitude: ${longitude}°<br>
                    Latitude: ${latitude}°<br>
                    Elevation: ${elevation} m`;

                // Add the point to the map
                points.push(viewer.entities.add({
                    position: earthPosition,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.RED,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    },
                    label: {
                        text: `Point ${points.length + 1}`,
                        font: '14pt sans-serif',
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        outlineWidth: 2,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10)
                    }
                }));
            })
            .catch(error => {
                console.error('Error fetching terrain data:', error);
                alert('Unable to fetch elevation data.');
            });
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
