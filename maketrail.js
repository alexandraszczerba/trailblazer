// maketrail.js

/**
 * Initializes the 3D Map with trail creation functionality.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 */
export function initialize3DMap(viewer) {
    const Cesium = window.Cesium;

    // Fly to initial location
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
     * Updates the overall message area within the info box.
     * @param {string} message - The message to display.
     */
    function updateOverallMessage(message) {
        const messageBox = document.getElementById('messageBox');
        if (messageBox) {
            messageBox.innerHTML = message;
        }
    }

    /**
     * Updates the segment-specific information area within the info box.
     * @param {string} message - The message to display.
     */
    function updateSegmentInfo(message) {
        const segmentInfoBox = document.getElementById('segmentInfoBox');
        if (segmentInfoBox) {
            segmentInfoBox.innerHTML = message;
        }
    }

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

    // Shared arrays and variables to keep track of trail points, entities, segments, and total distance
	const activeTrailPoints = [];
	const pointEntities = [];
	let trailPolyline = null;
	let totalDistance = 0; // In meters
	const trailSegments = []; // Array to store segment data

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
                    updateOverallMessage("<span style='color: red;'>Terrain data is not yet available.</span>");
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

                        // Store segment data
                        const elevationStart = await getElevation(point1);
                        const segment = {
                            from: `Point ${lastIndex}`,
                            to: `Point ${lastIndex + 1}`,
                            distance: distance.toFixed(2), // in meters
                            elevationStart: elevationStart,
                            elevationEnd: elevation
                        };
                        trailSegments.push(segment);

                        // Populate the dropdown menu with the new segment
                        populateSegmentDropdown();

                        // Update the overall message box with total distance
                        updateOverallMessage(`
                            <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                        `);
                    } else {
                        // Only one point added, display elevation and total distance
                        updateOverallMessage(`
                            <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                            <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                        `);
                    }
                } catch (error) {
                    console.error("Error fetching elevation data:", error);
                    updateOverallMessage("<span style='color: red;'>Error fetching elevation data. See console for details.</span>");
                }
            } else {
                updateOverallMessage("<span style='color: red;'>Point selection failed. Ensure you are clicking on terrain.</span>");
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Handle LEFT_DOUBLE_CLICK event to finalize trail creation
        handler.setInputAction(function () {
            handler.destroy();
            updateOverallMessage("Trail creation finalized. You can use 'Undo', 'Reset', or 'Publish Trail' buttons.");
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
	}

	/**
	 * Retrieves elevation for a given Cartesian3 point.
	 * @param {Cesium.Cartesian3} cartesian - The Cartesian3 position.
	 * @returns {Promise<number>} - The elevation in meters.
	 */
	async function getElevation(cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const terrainProvider = viewer.scene.globe.terrainProvider;
        const positions = [cartographic];
        const updatedPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
        return updatedPositions[0].height || 0;
	}

	/**
	 * Populates the segment dropdown menu with current trail segments.
	 */
	function populateSegmentDropdown() {
        const dropdown = document.getElementById('segmentDropdown');
        if (!dropdown) return;

        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="" disabled selected>Select a trail segment</option>';

        // Populate with current segments
        trailSegments.forEach((segment, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = `${segment.from} - ${segment.to}`;
            dropdown.appendChild(option);
        });

        // Enable dropdown if there are segments
        if (trailSegments.length > 0) {
            dropdown.disabled = false;
        } else {
            dropdown.disabled = true;
            dropdown.innerHTML = '<option value="" disabled selected>No segments available</option>';
        }

        // Remove existing event listeners to prevent multiple bindings
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Add event listener for selection
        newDropdown.addEventListener('change', function () {
            const selectedIndex = this.value;
            if (selectedIndex === "") return;

            const segment = trailSegments[selectedIndex];
            displaySegmentInfo(segment);
        });
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Populates the segment dropdown menu with current trail segments.
	 */
	function populateSegmentDropdown() {
        const dropdown = document.getElementById('segmentDropdown');
        if (!dropdown) return;

        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="" disabled selected>Select a trail segment</option>';

        // Populate with current segments
        trailSegments.forEach((segment, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = `${segment.from} - ${segment.to}`;
            dropdown.appendChild(option);
        });

        // Enable dropdown if there are segments
        if (trailSegments.length > 0) {
            dropdown.disabled = false;
        } else {
            dropdown.disabled = true;
            dropdown.innerHTML = '<option value="" disabled selected>No segments available</option>';
        }

        // Remove existing event listeners to prevent multiple bindings
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Add event listener for selection
        newDropdown.addEventListener('change', function () {
            const selectedIndex = this.value;
            if (selectedIndex === "") return;

            const segment = trailSegments[selectedIndex];
            displaySegmentInfo(segment);
        });
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Populates the segment dropdown menu with current trail segments.
	 */
	function populateSegmentDropdown() {
        const dropdown = document.getElementById('segmentDropdown');
        if (!dropdown) return;

        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="" disabled selected>Select a trail segment</option>';

        // Populate with current segments
        trailSegments.forEach((segment, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = `${segment.from} - ${segment.to}`;
            dropdown.appendChild(option);
        });

        // Enable dropdown if there are segments
        if (trailSegments.length > 0) {
            dropdown.disabled = false;
        } else {
            dropdown.disabled = true;
            dropdown.innerHTML = '<option value="" disabled selected>No segments available</option>';
        }

        // Remove existing event listeners to prevent multiple bindings
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Add event listener for selection
        newDropdown.addEventListener('change', function () {
            const selectedIndex = this.value;
            if (selectedIndex === "") return;

            const segment = trailSegments[selectedIndex];
            displaySegmentInfo(segment);
        });
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Implements Undo, Reset, and Publish functionalities for trail management.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 */
	function implementUndoResetPublish(viewer) {
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        const publishBtn = document.getElementById('publishBtn');

        // Ensure buttons exist
        if (!undoBtn || !resetBtn || !publishBtn) {
            console.warn("Undo, Reset, or Publish button not found in the DOM.");
            return;
        }

        // Undo Button Event Listener
        undoBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length > 0) {
                // Remove the last point from activeTrailPoints
                const removedPoint = activeTrailPoints.pop();

                // Remove the last point entity (marker and label)
                const lastEntity = pointEntities.pop();
                if (lastEntity) {
                    viewer.entities.remove(lastEntity);
                }

                // Remove the last segment from trailSegments
                const removedSegment = trailSegments.pop();
                if (removedSegment) {
                    // Subtract the distance of the removed segment from totalDistance
                    totalDistance -= parseFloat(removedSegment.distance);
                }

                // Update the polyline trail
                if (activeTrailPoints.length > 1) {
                    trailPolyline.polyline.positions = activeTrailPoints;
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, remove the polyline
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                } else {
                    // No points left, remove the polyline if it exists
                    if (trailPolyline) {
                        viewer.entities.remove(trailPolyline);
                        trailPolyline = null;
                    }
                }

                // Update the dropdown menu
                populateSegmentDropdown();

                // Update the overall message box
                if (trailSegments.length > 0) {
                    updateOverallMessage(`
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else if (activeTrailPoints.length === 1) {
                    // Only one point left, display its elevation and total distance
                    const elevation = await getElevation(activeTrailPoints[0]);
                    updateOverallMessage(`
                        <strong>Point Elevation:</strong> ${elevation.toFixed(2)} meters<br>
                        <strong>Total Trail Distance:</strong> ${totalDistance.toFixed(2)} meters
                    `);
                } else {
                    // No points left
                    updateOverallMessage("All points removed. Trail has been cleared.");
                }

                // Clear segment-specific info if no segment is selected
                updateSegmentInfo("");
            } else {
                updateOverallMessage("No points to undo.");
            }
        });

        // Reset Button Event Listener
        resetBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("No points to reset.");
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

            // Clear all trail points, segments, and reset total distance
            activeTrailPoints.length = 0;
            trailSegments.length = 0;
            totalDistance = 0;

            // Update the dropdown menu
            populateSegmentDropdown();

            // Update the overall message box
            updateOverallMessage("Trail has been reset.");

            // Clear segment-specific info
            updateSegmentInfo("");
        });

        // Publish Button Event Listener
        publishBtn.addEventListener('click', async function () {
            if (activeTrailPoints.length === 0) {
                updateOverallMessage("<span style='color: red;'>No trail to publish. Please create a trail first.</span>");
                return;
            }

            try {
                // Capture Screenshot
                const screenshot = await captureScreenshot(viewer);

                // Collect Trail Information
                const trailInfo = {
                    totalDistance: totalDistance.toFixed(2), // in meters
                    segments: trailSegments
                };

                // Download Screenshot
                downloadImage(screenshot, 'trail_screenshot.png');

                // Download Trail Information as JSON
                downloadJSON(trailInfo, 'trail_info.json');

                // Optional: Provide a confirmation message
                updateOverallMessage("<span style='color: green;'>Trail published successfully! Screenshot and trail information have been downloaded.</span>");
            } catch (error) {
                console.error("Error publishing trail:", error);
                updateOverallMessage("<span style='color: red;'>Error publishing trail. See console for details.</span>");
            }
        });
	}

	/**
	 * Captures a screenshot of the current Cesium view.
	 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
	 * @returns {Promise<string>} - A promise that resolves to the image data URL.
	 */
	function captureScreenshot(viewer) {
        return new Promise((resolve, reject) => {
            // Render the scene
            viewer.scene.render();

            // Allow some time for the render
            setTimeout(() => {
                try {
                    const canvas = viewer.scene.canvas;
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            }, 100); // Adjust timeout as needed
        });
	}

	/**
	 * Triggers a download of an image.
	 * @param {string} dataURL - The image data URL.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
	}

	/**
	 * Triggers a download of a JSON file.
	 * @param {Object} data - The data to be serialized into JSON.
	 * @param {string} filename - The desired filename for the download.
	 */
	function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Populates the segment dropdown menu with current trail segments.
	 */
	function populateSegmentDropdown() {
        const dropdown = document.getElementById('segmentDropdown');
        if (!dropdown) return;

        // Clear existing options except the first placeholder
        dropdown.innerHTML = '<option value="" disabled selected>Select a trail segment</option>';

        // Populate with current segments
        trailSegments.forEach((segment, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = `${segment.from} - ${segment.to}`;
            dropdown.appendChild(option);
        });

        // Enable dropdown if there are segments
        if (trailSegments.length > 0) {
            dropdown.disabled = false;
        } else {
            dropdown.disabled = true;
            dropdown.innerHTML = '<option value="" disabled selected>No segments available</option>';
        }

        // Remove existing event listeners to prevent multiple bindings
        const newDropdown = dropdown.cloneNode(true);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Add event listener for selection
        newDropdown.addEventListener('change', function () {
            const selectedIndex = this.value;
            if (selectedIndex === "") return;

            const segment = trailSegments[selectedIndex];
            displaySegmentInfo(segment);
        });
	}

	/**
	 * Displays detailed information about a selected trail segment.
	 * @param {Object} segment - The segment data.
	 */
	function displaySegmentInfo(segment) {
        const elevationGain = (segment.elevationEnd - segment.elevationStart).toFixed(2);
        const gainText = elevationGain >= 0 ? `${elevationGain} meters` : `${Math.abs(elevationGain)} meters (Loss)`;

        updateSegmentInfo(`
            <strong>Segment:</strong> ${segment.from} - ${segment.to}<br>
            <strong>Distance:</strong> ${segment.distance} meters<br>
            <strong>Elevation Start:</strong> ${segment.elevationStart.toFixed(2)} meters<br>
            <strong>Elevation End:</strong> ${segment.elevationEnd.toFixed(2)} meters<br>
            <strong>Elevation Gain:</strong> ${gainText}
        `);
	}

	/**
	 * Updates the overall message area within the info box.
	 * @param {string} message - The message to display.
	 */
	function updateOverallMessage(message) {
        const messageBox = document.getElementById('messageBox');
        if (messageBox) {
            messageBox.innerHTML = message;
        }
	}

	/**
	 * Updates the segment-specific information area within the info box.
	 * @param {string} message - The message to display.
	 */
	function updateSegmentInfo(message) {
        const segmentInfoBox = document.getElementById('segmentInfoBox');
        if (segmentInfoBox) {
            segmentInfoBox.innerHTML = message;
        }
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

	/**
	 * Initializes the segment dropdown and populates it.
	 */
	function initializeDropdown() {
        populateSegmentDropdown();
	}

	// Initialize trail creation, Undo/Reset/Publish functionalities, and dropdown
	createTrail();
	implementUndoResetPublish(viewer);
	initializeBuildings();
	initializeDropdown();
}
