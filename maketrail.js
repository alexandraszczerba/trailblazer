// maketrail.js

/**
 * Initializes the 3D Map with trail creation functionality.
 */
(function () {
    // Set your Cesium Ion access token
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMzY5MGQwNy1kMzc1LTQwODItOTEyYS0zMzA0OWQ0OGE2NjUiLCJpZCI6MjU1NjMwLCJpYXQiOjE3MzE3MjI4MTF9.Kz18W1PwUWiwbUU72gEkqSNmGCcojyE12eDgpBM8U-8';

    // Initialize the Cesium Viewer
    const viewer = new Cesium.Viewer('cesiumContainer', {
        animation: false,
        timeline: false,
        fullscreenButton: false,
        baseLayerPicker: false,
        terrainProvider: Cesium.createWorldTerrain(),
    });

    // Fly to Mt. Baldy
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-117.64607, 34.0, 10500),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
            roll: 0.0
        },
        duration: 2
    });

    let activeTrailPoints = [];
    let activePolyline = null;
    let pointEntities = [];
    let handler = null;

    // Get references to the buttons
    const undoBtn = document.getElementById('undoBtn');
    const resetBtn = document.getElementById('resetBtn');
    const infoBox = document.getElementById('infoBox');

    // Start trail creation
    createTrail();

    // Function to allow users to create a custom trail
    function createTrail() {
        if (handler) {
            handler.destroy();
        }

        clearTrail();

        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction(function (click) {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (Cesium.defined(earthPosition)) {
                // Sample terrain to get the most accurate height
                const cartographicPosition = Cesium.Cartographic.fromCartesian(earthPosition);
                Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartographicPosition])
                    .then(function (updatedPositions) {
                        const updatedCartographic = updatedPositions[0];
                        const longitude = Cesium.Math.toDegrees(updatedCartographic.longitude);
                        const latitude = Cesium.Math.toDegrees(updatedCartographic.latitude);
                        const elevation = updatedCartographic.height;

                        // Update the position with the accurate height
                        const accuratePosition = Cesium.Cartesian3.fromRadians(
                            updatedCartographic.longitude,
                            updatedCartographic.latitude,
                            elevation
                        );

                        activeTrailPoints.push(accuratePosition);

                        // Add a point entity for each click
                        const pointEntity = viewer.entities.add({
                            position: accuratePosition,
                            point: {
                                pixelSize: 10,
                                color: Cesium.Color.YELLOW,
                                outlineColor: Cesium.Color.BLACK,
                                outlineWidth: 2
                            },
                            label: {
                                text: `Elevation: ${elevation.toFixed(2)} m`,
                                font: '14pt sans-serif',
                                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                outlineWidth: 2,
                                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                                pixelOffset: new Cesium.Cartesian2(0, -15),
                                disableDepthTestDistance: Number.POSITIVE_INFINITY
                            }
                        });
                        pointEntities.push(pointEntity);

                        // Calculate distance from the last point
                        let distanceFromLastPoint = 0;
                        if (activeTrailPoints.length > 1) {
                            const previousPoint = activeTrailPoints[activeTrailPoints.length - 2];
                            distanceFromLastPoint = Cesium.Cartesian3.distance(previousPoint, accuratePosition);
                        }

                        // Update the info box
                        infoBox.innerHTML = `
                            <strong>Point ${activeTrailPoints.length}:</strong><br>
                            Longitude: ${longitude.toFixed(6)}°<br>
                            Latitude: ${latitude.toFixed(6)}°<br>
                            Elevation: ${elevation.toFixed(2)} m<br>
                            ${activeTrailPoints.length > 1 ? `Distance from last point: ${distanceFromLastPoint.toFixed(2)} m` : ''}
                        `;

                        // Update or create the polyline
                        if (activePolyline) {
                            viewer.entities.remove(activePolyline);
                        }
                        if (activeTrailPoints.length > 1) {
                            activePolyline = viewer.entities.add({
                                polyline: {
                                    positions: activeTrailPoints,
                                    width: 5,
                                    material: Cesium.Color.YELLOW
                                }
                            });
                        }
                    })
                    .catch(function (error) {
                        console.error('Error sampling terrain:', error);
                    });
            } else {
                console.warn('No valid position selected.');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function () {
            if (handler) {
                handler.destroy();
                handler = null;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // Function to clear the current trail
    function clearTrail() {
        // Remove all point entities
        pointEntities.forEach(function (entity) {
            viewer.entities.remove(entity);
        });
        pointEntities = [];

        // Clear the trail points array
        activeTrailPoints = [];

        // Remove the polyline
        if (activePolyline) {
            viewer.entities.remove(activePolyline);
            activePolyline = null;
        }

        // Clear the info box
        infoBox.innerHTML = 'Click on the map to add points';
    }

    // Undo button functionality
    if (undoBtn) {
        undoBtn.addEventListener('click', function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point entity
                const lastPointEntity = pointEntities.pop();
                viewer.entities.remove(lastPointEntity);

                // Remove the last point from the trail points array
                activeTrailPoints.pop();

                // Update the polyline
                if (activePolyline) {
                    viewer.entities.remove(activePolyline);
                    activePolyline = null;
                }
                if (activeTrailPoints.length > 1) {
                    activePolyline = viewer.entities.add({
                        polyline: {
                            positions: activeTrailPoints,
                            width: 5,
                            material: Cesium.Color.YELLOW
                        }
                    });
                }

                // Update the info box
                if (activeTrailPoints.length > 0) {
                    const lastPoint = activeTrailPoints[activeTrailPoints.length - 1];
                    const cartographic = Cesium.Cartographic.fromCartesian(lastPoint);
                    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                    const elevation = cartographic.height;

                    infoBox.innerHTML = `
                        <strong>Point ${activeTrailPoints.length}:</strong><br>
                        Longitude: ${longitude.toFixed(6)}°<br>
                        Latitude: ${latitude.toFixed(6)}°<br>
                        Elevation: ${elevation.toFixed(2)} m
                    `;
                } else {
                    infoBox.innerHTML = 'Click on the map to add points';
                }
            }
        });
    }

    // Reset button functionality
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            clearTrail();

            if (handler) {
                handler.destroy();
                handler = null;
            }
        });
    }
})();
