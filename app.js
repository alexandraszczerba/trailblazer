export function initialize3DMap(viewer) {
    // Initialize Cesium Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    timeline: false, // Disable timeline
    animation: false // Disable animation controls
  });
  
  // Define trail information
  const trailInformation = {
    "Icehouse Canyon Trailhead": {
      difficulty: "8/10",
      distance: "8 miles",
      maxElevation: "9399 feet",
      photos: ["photo1.jpg", "photo2.jpg", "photo3.jpg"],
      notes: "Windy/Cold weather. Be cautious of ice and snow during winter."
    },
    "Baldy Bowl Trailhead": {
      difficulty: "6/10",
      distance: "7 miles",
      maxElevation: "8600 feet",
      photos: ["baldy1.jpg", "baldy2.jpg"],
      notes: "Great trail for summer hikes."
    },
    "Devil's Backbone Trailhead": {
      difficulty: "10/10",
      distance: "13.1 miles",
      maxElevation: "10200 feet",
      photos: ["backbone1.jpg", "backbone2.jpg"],
      notes: "Be super cautious when hiking. Steep drops with recent reports of casualties."
    }
  };
  
  // Define waypoints and trails
  const trailheads = [
    {
      name: "Icehouse Canyon Trailhead",
      position: Cesium.Cartesian3.fromDegrees(-117.6397, 34.2501, 1500)
    },
    {
      name: "Baldy Bowl Trailhead",
      position: Cesium.Cartesian3.fromDegrees(-117.6476, 34.2889, 3050)
    },
    {
      name: "Devil's Backbone Trailhead",
      position: Cesium.Cartesian3.fromDegrees(-117.6432, 34.2880, 3050)
    }
  ];
  
  // Add waypoints to the map
  trailheads.forEach(waypoint => {
    const entity = viewer.entities.add({
      name: waypoint.name,
      position: waypoint.position,
      point: {
        pixelSize: 10,
        color: Cesium.Color.BLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: waypoint.name,
        font: '14pt monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    });
  
    entity.description = new Cesium.CallbackProperty(() => {
      const info = trailInformation[waypoint.name];
      if (info) {
        document.getElementById("trailInfoContent").style.display = "block";
        document.getElementById("trailName").innerText = waypoint.name;
        document.getElementById("trailDetails").innerHTML = `
          <strong>Difficulty:</strong> ${info.difficulty}<br>
          <strong>Distance:</strong> ${info.distance}<br>
          <strong>Max Elevation:</strong> ${info.maxElevation}<br>
          <strong>Notes:</strong> ${info.notes}
        `;
  
        // Populate photos
        const photoContainer = document.getElementById("trailPhotos");
        photoContainer.innerHTML = "";
        info.photos.forEach(photo => {
          const img = document.createElement("img");
          img.src = photo;
          img.alt = waypoint.name;
          photoContainer.appendChild(img);
        });
      }
    });
  });
  
  // Add event listener for the toggle button
  document.getElementById("trailInfoToggle").addEventListener("click", () => {
    const trailInfoContent = document.getElementById("trailInfoContent");
    trailInfoContent.style.display = trailInfoContent.style.display === "none" ? "block" : "none";
  });
  
  // Hide dropdown when clicking elsewhere
  viewer.scene.canvas.addEventListener("click", () => {
    document.getElementById("trailInfoContent").style.display = "none";
  });
  
}
