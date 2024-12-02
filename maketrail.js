// maketrail.js

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
    }

    let activeTrailPoints = [];
    let activePolyline = null;

    // Function to allow users to create a custom trail
    function createTrail() {
        if (activePolyline) {
            viewer.entities.remove(activePolyline);
            activeTrailPoints = [];
        }

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

        handler.setInputAction(function (click) {
            const earthPosition = viewer.scene.pickPosition(click.position);
            if (Cesium.defined(earthPosition)) {
                activeTrailPoints.push(earthPosition);

                // Add a point for the first click
                viewer.entities.add({
                    position: earthPosition,
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.YELLOW
                    }
                });

                // Update or create the polyline
                if (activeTrailPoints.length > 1) {
                    if (activePolyline) {
                        viewer.entities.remove(activePolyline);
                    }
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
