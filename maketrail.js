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

    // Create an elevation info box
    const elevationInfoBox = document.createElement('div');
    elevationInfoBox.id = 'elevationInfoBox';
    elevationInfoBox.style.position = 'absolute';
    elevationInfoBox.style.top = '10px';
    elevationInfoBox.style.right = '10px';
    elevationInfoBox.style.background = 'rgba(255, 255, 255, 0.9)';
    elevationInfoBox.style.padding = '10px';
    elevationInfoBox.style.borderRadius = '5px';
    elevationInfoBox.style.fontSize = '14px';
    elevationInfoBox.style.display = 'none';
    document.body.appendChild(elevationInfoBox);

    // Function to update the elevation info box
    function updateElevationInfo(elevation) {
        elevationInfoBox.style.display = 'block';
        elevationInfoBox.textContent = `Elevation: ${elevation.toFixed(2)} meters`;
    }

    // Function to display an error in the elevation info box
    function displayError(message) {
        elevationInfoBox.style.display = 'block';
        elevationInfoBox.textContent = message;
    }

    // Initialize trail creation
    function createTrail() {
        const activeTrailPoints = [];
        const pointEntities = [];

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction(async function (click) {
            const cartesian = viewer.scene.pickPosition(click.position);

            if (Cesium.defined(cartesian)) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const terrainProvider = viewer.scene.globe.terrainProvider;

                if (!terrainProvider.ready) {
                    displayError("Terrain data is not yet available.");
                    return;
                }

                try {
                    // Fetch elevation data
                    const positions = [cartographic];
                    const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
                    const elevation = updatedPositions[0].height || 0;

                    // Update the elevation info box
                    updateElevationInfo(elevation);

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
                        viewer.entities.add({
                            polyline: {
                                positions: activeTrailPoints,
                                width: 5,
                                material: Cesium.Color.YELLOW
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error fetching elevation data:", error);
                    displayError("Error fetching elevation data. See console for details.");
                }
            } else {
                displayError("Point selection failed. Ensure you are clicking on terrain.");
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function () {
            handler.destroy();
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
}
