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
        duration: 2 // Duration of the flyTo animation in seconds
    });

    // Sample trail data (you can replace this with actual data)
    const trails = [
        {
            name: 'Sample Trail',
            path: Cesium.Cartesian3.fromDegreesArray([
                -117.64607, 34.0,
                -117.645, 34.005,
                -117.644, 34.010
            ]),
            color: Cesium.Color.BLUE
        }
    ];

    // Function to add trails to the map
    function addTrails(trails) {
        trails.forEach(trail => {
            viewer.entities.add({
                name: trail.name,
                polyline: {
                    positions: trail.path,
                    width: 5,
                    material: trail.color,
                    clampToGround: true
                }
            });
        });
    }

    // Function to add waypoints (if you have any)
    function addWaypoints(trailheads) {
        trailheads.forEach(trailhead => {
            viewer.entities.add({
                name: trailhead.name,
                position: Cesium.Cartesian3.fromDegrees(trailhead.longitude, trailhead.latitude),
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2
                },
                label: {
                    text: trailhead.name,
                    font: '14pt sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10)
                }
            });
        });
    }

    // Sample trailhead data (you can replace this with actual data)
    const trailheads = [
        {
            name: 'Trailhead 1',
            longitude: -117.64607,
            latitude: 34.0
        }
    ];

    // Add waypoints and trails to the map
    addWaypoints(trailheads);
    addTrails(trails);

    // Hide trail info box when canvas is clicked (assuming you have a 'trailInfoBox' element)
    viewer.scene.canvas.addEventListener('click', function () {
        const infoBox = document.getElementById('trailInfoBox');
        if (infoBox) {
            infoBox.style.display = 'none';
        }
    });

    // Event listener for 'Create Trail' button
    const createTrailBtn = document.getElementById('createTrailBtn');
    if (createTrailBtn) {
        createTrailBtn.addEventListener('click', function () {
            createTrail();
        });
    } else {
        // If no button is present, start trail creation automatically
        createTrail();
    }

    let activeTrailPoints = [];
    let activePolyline = null;
    let pointEntities = []; // To keep track of point entities for undo and reset

    // Get references to Undo and Reset buttons
    const undoBtn = document.getElementById('undoBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Function to allow users to create a custom trail
    function createTrail() {
        // If there's an existing polyline, remove it and reset points
        if (activePolyline) {
            viewer.entities.remove(activePolyline);
            activePolyline = null;
        }
        activeTrailPoints = [];
        pointEntities.forEach(entity => viewer.entities.remove(entity));
        pointEntities = [];

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction(function (click) {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (Cesium.defined(earthPosition)) {
                activeTrailPoints.push(earthPosition);

                // Add a point entity for each click
                const pointEntity = viewer.entities.add({
                    position: earthPosition,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.YELLOW,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2
                    }
                });
                pointEntities.push(pointEntity);

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
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(function () {
            handler.destroy();
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

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
                }
            });
        }

        // Reset button functionality
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
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
            });
        }
    }

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

// Initialize the 3D Map
import { initialize3DMap } from './maketrail.js';
initialize3DMap(viewer);
