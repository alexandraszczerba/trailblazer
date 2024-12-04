export function initialize3DMap(viewer) {
    const Cesium = window.Cesium;

    // Retrieve location from localStorage
    const searchLocation = localStorage.getItem('searchLocation') || 'Mt. Baldy';

    // Example coordinates for predefined locations
    const locationCoordinates = {
        'Mt. Baldy': [-117.64607, 34.0, 10500],
        // Add more locations with their [longitude, latitude, height] values
    };

    const destination = locationCoordinates[searchLocation] || locationCoordinates['Mt. Baldy'];

    // Fly to the selected location
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(...destination),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-15.0),
            roll: 0.0
        },
        duration: 2
    });

    // Trail metadata
    const trailData = [
        {
            name: "Baldy Bowl Trail",
            elevation: "3050 ft",
            length: "4 miles",
            difficulty: "Hard",
            weather: "Clear, 55°F",
            path: [
                Cesium.Cartesian3.fromDegrees(-117.6476, 34.2889, 2100),
                Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 2300),
                Cesium.Cartesian3.fromDegrees(-117.6390, 34.2891, 2400),
            ],
            color: Cesium.Color.RED,
        },
        {
            name: "Devil's Backbone to Mount Baldy Summit",
            elevation: "3068 ft",
            length: "3 miles",
            difficulty: "Moderate",
            weather: "Partly Cloudy, 50°F",
            path: [
                Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 2300),
                Cesium.Cartesian3.fromDegrees(-117.6350, 34.2895, 3068),
            ],
            color: Cesium.Color.GREEN,
        },
    ];

    // Add trails to the map
    trailData.forEach((trail) => {
        const entity = viewer.entities.add({
            name: trail.name,
            polyline: {
                positions: trail.path,
                width: 5,
                material: trail.color,
                clampToGround: true,
            },
            properties: {
                elevation: trail.elevation,
                length: trail.length,
                difficulty: trail.difficulty,
                weather: trail.weather,
            },
        });
    });

    // Add click handler for displaying trail info
    viewer.selectedEntityChanged.addEventListener((entity) => {
        if (entity) {
            const trailInfoPanel = document.getElementById("trailInfoPanel");
            trailInfoPanel.style.display = "block";

            // Update trail name
            document.getElementById("trailName").innerText = entity.name;

            // Update dropdown content
            document.getElementById("trailDetails").innerHTML = `
                <li>Elevation: ${entity.properties.elevation.getValue()}</li>
                <li>Length: ${entity.properties.length.getValue()}</li>
                <li>Difficulty: ${entity.properties.difficulty.getValue()}</li>
                <li>Weather: ${entity.properties.weather.getValue()}</li>
            `;
        } else {
            document.getElementById("trailInfoPanel").style.display = "none";
        }
    });
}
