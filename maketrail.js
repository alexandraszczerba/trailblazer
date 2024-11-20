import { Cesium } from 'https://cesium.com/downloads/cesiumjs/releases/1.123/Build/Cesium/Cesium.js';

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMzY5MGQwNy1kMzc1LTQwODItOTEyYS0zMzA0OWQ0OGE2NjUiLCJpZCI6MjU1NjMwLCJpYXQiOjE3MzE3MjI4MTF9.Kz18W1PwUWiwbUU72gEkqSNmGCcojyE12eDgpBM8U-8';

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    animation: false,
    timeline: false,
    fullscreenButton: false,
    baseLayerPicker: false
});

// Variables to keep track of points
let activePoints = [];
let maxPoints = 5;

// Create a handler for user interactions
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

// Info box to display coordinates and elevation
const infoBox = document.getElementById('infoBox');

handler.setInputAction(function (click) {
    if (activePoints.length >= maxPoints) {
        alert(`You have reached the maximum number of points (${maxPoints}).`);
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

                // Display the coordinates and elevation
                infoBox.innerHTML = `Point ${activePoints.length + 1}:<br>
                    Longitude: ${longitude}°<br>
                    Latitude: ${latitude}°<br>
                    Elevation: ${elevation} m`;

                // Add the point to the map
                activePoints.push(viewer.entities.add({
                    position: earthPosition,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.RED,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    },
                    label: {
                        text: `Point ${activePoints.length}`,
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
