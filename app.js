export function initialize3DMap(viewer) {
    // Fly to Mt. Baldy
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-117.64607, 34.0, 10500),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
        },
    });

    // Define waypoints for trailheads
    const trailheads = [
        {
            name: "Baldy Bowl Trailhead",
            position: Cesium.Cartesian3.fromDegrees(-117.6476, 34.2889, 3050),
        },
        {
            name: "Devil's Backbone Trailhead",
            position: Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 3050),
        },
        {
            name: "Manker Campground Trailhead",
            position: Cesium.Cartesian3.fromDegrees(-117.6259, 34.2663, 1900),
        },
        {
            name: "Icehouse Canyon Trailhead",
            position: Cesium.Cartesian3.fromDegrees(-117.6397, 34.2501, 1500),
        },
    ];

    // Define trails
    const trails = [
        {
            name: "Baldy Bowl Trail",
            path: [
                Cesium.Cartesian3.fromDegrees(-117.6476, 34.2889, 2100),
                Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 2300),
                Cesium.Cartesian3.fromDegrees(-117.6390, 34.2891, 2400),
            ],
            color: Cesium.Color.RED,
        },
        {
            name: "Devil's Backbone to Mount Baldy Summit",
            path: [
                Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 2300),
                Cesium.Cartesian3.fromDegrees(-117.6350, 34.2895, 3068),
            ],
            color: Cesium.Color.GREEN,
        },
    ];

    // Add waypoints to the map
    trailheads.forEach((trailhead) => {
        viewer.entities.add({
            name: trailhead.name,
            position: trailhead.position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.BLUE,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
            label: {
                text: trailhead.name,
                font: "14pt monospace",
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
            },
        });
    });

    // Add trails to the map
    trails.forEach((trail) => {
        viewer.entities.add({
            name: trail.name,
            polyline: {
                positions: trail.path,
                width: 5,
                material: trail.color,
                clampToGround: true,
            },
        });
    });
}

export function createTrail(viewer) {
    let activeTrailPoints = [];
    let activePolyline = null;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction(function (click) {
        const earthPosition = viewer.camera.pickEllipsoid(
            click.position,
            viewer.scene.globe.ellipsoid
        );

        if (Cesium.defined(earthPosition)) {
            activeTrailPoints.push(earthPosition);

            if (activePolyline) {
                viewer.entities.remove(activePolyline);
            }

            activePolyline = viewer.entities.add({
                polyline: {
                    positions: activeTrailPoints,
                    width: 5,
                    material: Cesium.Color.YELLOW,
                },
            });
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(function () {
        handler.destroy();
        console.log("Trail creation finished:", activeTrailPoints);
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}
