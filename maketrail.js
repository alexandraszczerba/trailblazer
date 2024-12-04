// maketrail.js

/**
 * Initializes the 3D Map with trail creation functionality.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 */
export function initialize3DMap(viewer) {
    const Cesium = window.Cesium;

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

    /**
     * Updates the main info box with provided HTML content.
     * @param {string} message - The HTML content to display in the info box.
     */
    function updateInfoBox(message) {
        const infoBox = document.getElementById('infoBox');
        if (infoBox) {
            infoBox.innerHTML = message;
        }
    }

    // Shared arrays and variables to keep track of trail points, entities, and total distance
    const activeTrailPoints = [];
    const pointEntities = [];
    let trailPolyline = null;
    let totalDistance = 0; // In meters

    /**
     * Adds a labeled marker at the specified Cartesian3 position.
     * @param {Cesium.Cartesian3} position - The position to place the marker.
     * @param {number} index - The index number of the point.
     */
    function addMarker(position, index) {
        const entity = viewer.entities.add({
            position: position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2
            },
            label: {
                text: `Point ${index + 1}`,
                font: '14pt sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                disableDepthTestDistance: Number.POSITIVE_INFINITY // Ensure label is always visible
            }
        });
        pointEntities.push(entity);
    }

    /**
     * Initializes the trail creation functionality.
     */
    function createTrail() {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        // Handle LEFT_CLICK event to add points
        handler.setInputAction(async function (click) {
            const cartesian = viewer.scene.pickPosition(click.position);

            if (Cesium.defined(cartesian)) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const terrainProvider = viewer.scene.globe.terrainProvider;

                if (!terrainProvider.ready) {
                    updateInfoBox("<span style='color: red;'>Terrain data is not yet available.</span>");
                    return;
                }

                try {
                    // Fetch elevation data for the clicked point
                    const positions = [cartographic];
                    const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
                    const elevation = updatedPositions[0].height || 0;

                    // Add the Cartesian3 position to the active trail points
                    activeTrailPoints.push(cartesian);

                    // Add a labeled marker for the point
                    addMarker(cartesian, activeTrailPoints.length - 1);

                    // Update or create the polyline trail
                    if (activeTrailPoints.length > 1) {
                        if (trailPolyline) {
                            // Update existing polyline positions
                            trailPolyline.polyline.positions = activeTrailPoints;
                        } else {
                            // Create a new polyline
                            trailPolyline = viewer.entities.add({
                                polyline: {
                                    positions: activeTrailPoints,
                                    width: 5,
                                    material: Cesium.Color.YELLOW
                                }
                            });
                        }

                        // Calculate distance between the last two points
                        const lastIndex = activeTrailPoints.length - 1;
                        const point1 = activeTrailPoints[lastIndex - 1];
                        const point2 = activeTrailPoints[lastIndex];
                        const distance = Cesium.Cartesian3.distance(point1, point2); // Distance in meters
                        totalDistance += distance;

                        // Update the info box with elevation, distance from previous point, and total distance
                        updateInfoBox(`
                            <strong>Last Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                            <strong>Distance from Previous Point:</strong> ${distance.toFixed(2)} meters<br>
                            <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                        `);
                    } else {
                        // Only one point added, display elevation
                        updateInfoBox(`
                            <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                            <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                        `);
                    }
                } catch (error) {
                    console.error("Error fetching elevation data:", error);
                    updateInfoBox("<span style='color: red;'>Error fetching elevation data. See console for details.</span>");
                }
            } else {
                updateInfoBox("<span style='color: red;'>Point selection failed. Ensure you are clicking on terrain.</span>");
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Handle LEFT_DOUBLE_CLICK event to finalize trail creation
        handler.setInputAction(function () {
            handler.destroy();
            updateInfoBox("Trail creation finalized. You can use 'Undo' or 'Reset' buttons.");
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    /**
     * Implements Undo and Reset functionalities for trail management.
     * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
     */
    function implementUndoReset(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn) {
            console.warn("Undo or Reset button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Update polyline positions and total distance
                if (activeTrailPoints.length > 1) {
                    // Update polyline positions
                    trailPolyline.polyline.positions = activeTrailPoints;

                    // Recalculate distance between new last two points
                    const lastIndex = activeTrailPoints.length - 1;
                    const point1 = activeTrailPoints[lastIndex - 1];
                    const point2 = activeTrailPoints[lastIndex];
                    const distance = Cesium.Cartesian3.distance(point1, point2);
                    totalDistance -= distance;

                    // Update the info box
                    updateInfoBox(`
                        <strong>Last Point Removed.</strong><br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove polyline and update distance
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                    totalDistance = 0;
                    updateInfoBox(`
                        <strong>Last Point Removed.</strong><br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left, remove polyline if exists and reset distance
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                    totalDistance = 0;
                    updateInfoBox("All points removed. Trail has been cleared.");
                }
            } else {
                updateInfoBox("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', function () {
            if (activeTrailPoints.length === 0) {
                updateInfoBox("No points to reset.");
                return;
            }

            // Remove all point entities (markers and labels)
            while (pointEntities.length > 0) {
                const entity = pointEntities.pop();
                if (entity) {
                    viewer.entities.remove(entity);
                }
            }

            // Remove the polyline trail
            if (trailPolyline) {
                viewer.entities.remove(trailPolyline);
                trailPolyline = null;
            }

            // Clear all trail points and reset total distance
            activeTrailPoints.length = 0;
            totalDistance = 0;

            // Update the info box
            updateInfoBox("Trail has been reset.");
        });
    }

    /**
     * Adds Cesium OSM Buildings for enhanced visualization.
     */
    async function initializeBuildings() {
        try {
            const buildingTileset = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(buildingTileset);
        } catch (error) {
            console.error('Error adding OSM Buildings:', error);
        }
    }

    // Initialize trail creation and Undo/Reset functionalities
    createTrail();
    implementUndoReset(viewer);

    // Initialize Cesium OSM Buildings
    initializeBuildings();
}
