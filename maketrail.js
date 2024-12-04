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

    // Function to update the main info box (elevation and distance)
    function updateInfoBox(message) {
        const infoBox = document.getElementById('infoBox');
        if (infoBox) {
            infoBox.innerHTML = message;
        }
    }

    // Shared arrays to keep track of trail points and entities
    const activeTrailPoints = [];
    const pointEntities = [];
    let trailPolyline = null;

    // Initialize trail creation
    function createTrail() {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

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
                    // Fetch elevation data
                    const positions = [cartographic];
                    const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
                    const elevation = updatedPositions[0].height || 0;

                    // Add a point to the trail
                    activeTrailPoints.push(cartesian);

                    // Add a point entity
                    const pointEntity = viewer.entities.add({
                        position: cartesian,
                        point: {
                            pixelSize: 10,
                            color: Cesium.Color.YELLOW,
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 2
                        }
                    });
                    pointEntities.push(pointEntity);

                    // Update the trail polyline if there are at least two points
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

                        // Calculate distance between last two points
                        const lastIndex = activeTrailPoints.length - 1;
                        const point1 = Cesium.Cartesian3.clone(activeTrailPoints[lastIndex - 1]);
                        const point2 = Cesium.Cartesian3.clone(activeTrailPoints[lastIndex]);
                        const distance = Cesium.Cartesian3.distance(point1, point2);

                        // Update the info box with elevation and distance
                        updateInfoBox(`
                            <strong>Last Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                            <strong>Distance from Previous Point:</strong> ${distance.toFixed(2)} meters
                        `);
                    } else {
                        // Only one point added, display elevation
                        updateInfoBox(`
                            <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters
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

        // Destroy the handler on double-click to finalize trail creation
        handler.setInputAction(function () {
            handler.destroy();
            updateInfoBox("Trail creation finalized. You can use 'Undo' or 'Reset' buttons.");
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    createTrail();

    // Add Cesium OSM Buildings
    async function initializeBuildings() {
        try {
            const buildingTileset = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(buildingTileset);
        } catch (error) {
            console.error('Error adding OSM Buildings:', error);
        }
    }

    initializeBuildings();

    // Implement Undo and Reset Button Functionality
    function implementUndoReset(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', function () {
                if (activeTrailPoints.length > 0) {
                    // Remove last point
                    activeTrailPoints.pop();
                    const lastEntity = pointEntities.pop();
                    viewer.entities.remove(lastEntity);

                    // Update polyline
                    if (activeTrailPoints.length > 1) {
                        trailPolyline.polyline.positions = activeTrailPoints;
                    } else if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }

                    // Update info box
                    if (activeTrailPoints.length > 0) {
                        const lastIndex = activeTrailPoints.length - 1;
                        // For simplicity, update info box with last point elevation
                        // You can enhance this to store elevations per point
                        updateInfoBox("Last point removed.");
                    } else {
                        updateInfoBox("All points removed.");
                    }
                } else {
                    updateInfoBox("No points to undo.");
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                // Remove all points
                while (activeTrailPoints.length > 0) {
                    const lastPoint = activeTrailPoints.pop();
                    const lastEntity = pointEntities.pop();
                    viewer.entities.remove(lastEntity);
                }

                // Remove polyline
                if (trailPolyline) {
                    viewer.entities.remove(trailPolyline);
                    trailPolyline = null;
                }

                // Update info box
                updateInfoBox("Trail has been reset.");
            });
        }
    }

    implementUndoReset(viewer);
}
