// maketrail.js

// Ensure CesiumJS is loaded with the correct access token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMzY5MGQwNy1kMzc1LTQwODItOTEyYS0zMzA0OWQ0OGE2NjUiLCJpZCI6MjU1NjMwLCJpYXQiOjE3MzE3MjI4MTF9.Kz18W1PwUWiwbUU72gEkqSNmGCcojyE12eDgpBM8U-8';

/**
 * Initializes the 3D Map with trail creation functionality.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 */
export function initialize3DMap(viewer) {
    // Fly to Mt. Baldy
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-117.64607, 34.0, 10500),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
            roll: 0.0
        },
        duration: 2 // Optional: Duration of the flyTo animation in seconds
    });

    // Variables to keep track of points and trail
    let points = [];
    let activePolyline = null;

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
            Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartographic])
                .then(([updatedCartographic]) => {
                    const elevation = updatedCartographic.height.toFixed(2);

                    // Update the info box with coordinates and elevation
                    infoBox.innerHTML = `Point ${points.length + 1}:<br>
                        Longitude: ${longitude}°<br>
                        Latitude: ${latitude}°<br>
                        Elevation: ${elevation} m`;

                    // Add the point to the map
                    const newPoint = viewer.entities.add({
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
                    });

                    points.push(newPoint);

                    // Update or create the polyline
                    if (activePolyline) {
                        viewer.entities.remove(activePolyline);
                    }

                    if (points.length > 1) {
                        const positions = points.map(point => point.position.getValue(Cesium.JulianDate.now()));
                        activePolyline = viewer.entities.add({
                            polyline: {
                                positions: positions,
                                width: 5,
                                material: Cesium.Color.YELLOW
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error fetching terrain data:', error);
                    alert('Unable to fetch elevation data.');
                });
        } else {
            console.warn('No valid position was picked on the map.');
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Optional: Add a reset button functionality
    const resetBtn = document.getElementById('resetTrailBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            // Remove all points
            points.forEach(point => viewer.entities.remove(point));
            points = [];

            // Remove polyline
            if (activePolyline) {
                viewer.entities.remove(activePolyline);
                activePolyline = null;
            }

            // Clear info box
            infoBox.innerHTML = 'Click on the map to add points';
        });
    }

    // Add Cesium OSM Buildings, a global 3D buildings layer
    async function initializeBuildings() {
        try {
            const buildingTileset = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(buildingTileset);
        } catch (error) {
            console.error('Error adding OSM Buildings:', error);
        }
    }

    // Call the async function to add buildings
    initializeBuildings();
}
