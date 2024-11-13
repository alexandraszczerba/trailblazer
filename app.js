// Initialize the map and set its view to a chosen geographical point and zoom level
var map = L.map('map').setView([34.1065, -117.8253], 12); // Example coordinates (latitude, longitude)

// Add a base map layer (OpenStreetMap tiles)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Example custom marker styling (optional)
var customIcon = L.divIcon({
    className: 'custom-marker-icon',
    iconSize: [20, 30] // Adjust size as necessary
});

// Add a marker at the center with custom style
L.marker([34.1065, -117.8253], { icon: customIcon }).addTo(map)
    .bindPopup('Custom Marker at Initial Point').openPopup();

// Handle map click event to add new markers
map.on('click', function(event) {
    var lat = event.latlng.lat;
    var lng = event.latlng.lng;

    // Add a marker at the clicked location
    L.marker([lat, lng], { icon: customIcon }).addTo(map)
        .bindPopup('New Trail Point<br>Latitude: ' + lat + '<br>Longitude: ' + lng).openPopup();
});
