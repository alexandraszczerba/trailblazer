<script type="module">
    // Access the Cesium object from the global window object
    const Cesium = window.Cesium;

    // Set your Cesium Ion access token
    Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_ACCESS_TOKEN';

    // Initialize the Cesium Viewer with terrain provider
    const viewer = new Cesium.Viewer('cesiumContainer', {
        animation: false, // Disable animation controls
        timeline: false,  // Disable timeline
        fullscreenButton: false,
        baseLayerPicker: false,
        terrainProvider: Cesium.createWorldTerrain(), // Add terrain provider
        imageryProvider: Cesium.createWorldImagery()  // Add imagery provider (optional)
    });

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-117.64607, 34.0, 10500),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
            roll: 0.0
        }
    });

    let activeTrailPoints = [];
    let activePolyline = null;
    let pointEntities = []; // To keep track of point entities for undo and reset
    let handler = null;

    const infoBox = document.getElementById('infoBox');
    const undoBtn = document.getElementById('undoBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Start trail creation
    createTrail();

    function createTrail() {
        if (handler) {
            handler.destroy();
        }

        clearTrail();

        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction((click) => {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (Cesium.defined(earthPosition)) {
                // Convert to Cartographic to get longitude, latitude, and height
                const cartographicPosition = Cesium.Cartographic.fromCartesian(earthPosition);

                // Sample the terrain to get accurate elevation
                Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartographicPosition])
                    .then((updatedPositions) => {
                        const updatedCartographic = updatedPositions[0];
                        const longitude = Cesium.Math.toDegrees(updatedCartographic.longitude);
                        const latitude = Cesium.Math.toDegrees(updatedCartographic.latitude);
                        const elevation = updatedCartographic.height;

                        // Update the position with accurate height
                        const accuratePosition = Cesium.Cartesian3.fromRadians(
                            updatedCartographic.longitude,
                            updatedCartographic.latitude,
                            elevation
                        );

                        activeTrailPoints.push(accuratePosition);

                        // Add a point entity
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
                        let geodesicDistance = 0;
                        if (activeTrailPoints.length > 1) {
                            const previousPoint = activeTrailPoints[activeTrailPoints.length - 2];
                            distanceFromLastPoint = Cesium.Cartesian3.distance(previousPoint, accuratePosition);

                            // Calculate geodesic distance
                            const geodesic = new Cesium.EllipsoidGeodesic(
                                Cesium.Cartographic.fromCartesian(previousPoint),
                                Cesium.Cartographic.fromCartesian(accuratePosition)
                            );
                            geodesicDistance = geodesic.surfaceDistance;
                        }

                        // Update the info box
                        infoBox.innerHTML = `
                            <strong>Point ${activeTrailPoints.length}:</strong><br>
                            Longitude: ${longitude.toFixed(6)}°<br>
                            Latitude: ${latitude.toFixed(6)}°<br>
                            Elevation: ${elevation.toFixed(2)} m<br>
                            ${
                                activeTrailPoints.length > 1
                                    ? `Straight-line Distance from last point: ${distanceFromLastPoint.toFixed(2)} m<br>
                                       Geodesic Distance from last point: ${geodesicDistance.toFixed(2)} m`
                                    : ''
                            }
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
                    .catch((error) => {
                        console.error('Error sampling terrain:', error);
                    });
            } else {
                infoBox.innerHTML = 'No valid position selected.';
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(() => {
            if (handler) {
                handler.destroy();
                handler = null;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // Function to clear the current trail
    function clearTrail() {
        // Remove all point entities
        pointEntities.forEach((entity) => {
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

        // Reset the info box
        infoBox.innerHTML = 'Click on the map to add points';
    }

    // Undo button functionality
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
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
    } else {
        console.error('Undo button not found');
    }

    // Reset button functionality
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearTrail();

            if (handler) {
                handler.destroy();
                handler = null;
            }

            // Restart trail creation
            createTrail();
        });
    } else {
        console.error('Reset button not found');
    }
</script>
