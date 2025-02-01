import { Viewer } from './utils/classes/Viewer.js';
import { Sliders } from './utils/classes/Sliders.js';
import { ControlPanel } from './utils/classes/ControlPanel.js';

const DATA_DIR = 'https://storage.googleapis.com/vortex-3dst-demo-data/data/sliced/'; // Define data directory path

let METADATA = await fetch(`metadata_hi_res.json`).then(response => response.json());

// Initialize viewer
let viewer = new Viewer('div-viewer-top', METADATA, DATA_DIR);
window.viewer = viewer; // Make viewer accessible globally
window.viewers = [viewer]; // For access in ControlPanel

// Create second viewer for segmentation, initially hidden
let segViewer = new Viewer('div-viewer-seg', METADATA, DATA_DIR);
segViewer.container.style.display = "none"; // keep hidden
window.segViewer = segViewer;
window.viewers.push(segViewer);

// Sync camera in both directions
viewer.sync_camera(segViewer);
segViewer.sync_camera(viewer);

// Initialize sliders
let sliders = new Sliders(METADATA);
window.sliders = sliders; // Make sliders accessible globally

// Initialize control panel
let controller = new ControlPanel('metadata-panel', METADATA);

// Load data
controller.update(controller.dropdown.value);
viewer.load(controller.dropdown.value);

// Link control buttons with viewer
viewer.reset_buttons();
viewer.autorotate_button();

// Animate viewer
viewer.animate();

// Animate segmentation viewer
segViewer.animate();

// Activate control panel
controller.control([viewer], sliders);

// Link sliders to viewer
sliders.activate([viewer]);

async function checkFolders(slideId) {
    const segPath = `${DATA_DIR}${slideId}/segmentation`;
    const domainPath = `${DATA_DIR}${slideId}/spatial_domains`;

    const segToggle = document.getElementById('seg-toggle');
    const domainToggle = document.getElementById('domain-toggle');

    // Check segmentation folder
    try {
        const resSeg = await fetch(segPath, { method: 'HEAD' });
        segToggle.parentElement.style.display = resSeg.ok ? 'inline-block' : 'none';
        if (!resSeg.ok) {
            segToggle.checked = false;
            toggleSegmentation(false, slideId);
        }
    } catch {
        segToggle.checked = false;
        segToggle.parentElement.style.display = 'none';
        toggleSegmentation(false, slideId);
    }

    // Check domain folder
    try {
        const resDom = await fetch(domainPath, { method: 'HEAD' });
        domainToggle.parentElement.style.display = resDom.ok ? 'inline-block' : 'none';
        if (!resDom.ok) {
            domainToggle.checked = false;
            toggleSpatialDomain(false, slideId);
        }
    } catch {
        domainToggle.checked = false;
        domainToggle.parentElement.style.display = 'none';
        toggleSpatialDomain(false, slideId);
    }
}

function updateLegend(legendId, legendData) {
    const legendContainer = document.getElementById(legendId);
    legendContainer.innerHTML = ''; // Clear existing legend items

    for (const [label, color] of Object.entries(legendData)) {
        const legendItem = document.createElement('div');
        legendItem.classList.add('legend-item');

        const legendColor = document.createElement('span');
        legendColor.classList.add('legend-color');
        legendColor.style.backgroundColor = color;

        const legendLabel = document.createElement('span');
        legendLabel.textContent = label;

        legendItem.appendChild(legendColor);
        legendItem.appendChild(legendLabel);
        legendContainer.appendChild(legendItem);
    }
}

function toggleSegmentation(show, slideId) {
    const topDiv = document.getElementById('div-viewer-top');
    const legend = document.getElementById('segmentation-legend');
    const segTitleElement = document.getElementById('segmentation-title');
    const currentSliderValues = {
        y: sliders.sliders.y.slider('values'),
        x: sliders.sliders.x.slider('values'),
        z: sliders.sliders.z.slider('values')
    };

    if (show) {
        // Force domain toggle off
        document.getElementById('domain-toggle').checked = false;
        toggleSpatialDomain(false, slideId);

        topDiv.style.width = '50vw';
        segViewer.container.style.display = 'block';
        legend.style.display = 'flex'; // Show the legend
        segTitleElement.style.display = 'block'; // Show segmentation title
        console.log(`Loading segmentation for slide ID: ${slideId}`);
        segViewer.load(slideId, currentSliderValues);
        segViewer.loadSegmentation(currentSliderValues);
        segViewer.resize(); // Ensure the segmentation viewer initializes properly

        // Update segmentation legend
        const slideMetadata = METADATA.find(slide => slide.id === slideId);
        if (slideMetadata && slideMetadata.segmentationLegend) {
            updateLegend('segmentation-legend', slideMetadata.segmentationLegend);
        }
    } else {
        topDiv.style.width = '100vw';
        segViewer.container.style.display = 'none';
        legend.style.display = 'none'; // Hide the legend
        segTitleElement.style.display = 'none'; // Hide segmentation title
    }
    controller.updateTitle();
    viewer.load(slideId, currentSliderValues).then(() => {
        viewer.resize(); // Ensure the left viewer resizes correctly
    });
}

function toggleSpatialDomain(show, slideId) {
    const topDiv = document.getElementById('div-viewer-top');
    const domainLegend = document.getElementById('domain-legend');
    const domainTitleElement = document.getElementById('domain-title');
    const currentSliderValues = {
        y: sliders.sliders.y.slider('values'),
        x: sliders.sliders.x.slider('values'),
        z: sliders.sliders.z.slider('values')
    };

    if (show) {
        // Turn off segmentation
        document.getElementById('seg-toggle').checked = false;
        toggleSegmentation(false, slideId);

        topDiv.style.width = '50vw';
        segViewer.container.style.display = 'block';
        domainLegend.style.display = 'flex';
        domainTitleElement.style.display = 'block';
        segViewer.load(slideId, currentSliderValues);
        segViewer.loadSpatialDomain(currentSliderValues);
        segViewer.resize();

        // Update domain legend
        const slideMetadata = METADATA.find(slide => slide.id === slideId);
        if (slideMetadata && slideMetadata.domainLegend) {
            updateLegend('domain-legend', slideMetadata.domainLegend);
        }
    } else {
        topDiv.style.width = '100vw';
        segViewer.container.style.display = 'none';
        domainLegend.style.display = 'none';
        domainTitleElement.style.display = 'none';
    }
    controller.updateTitle();
    viewer.load(slideId, currentSliderValues).then(() => {
        viewer.resize();
    });
}

// Listen for checkbox
document.getElementById('seg-toggle').addEventListener('change', (e) => {
    const slideId = controller.dropdown.value; // Get the current slide ID
    toggleSegmentation(e.target.checked, slideId);
});

document.getElementById('domain-toggle').addEventListener('change', (e) => {
    const slideId = controller.dropdown.value;
    toggleSpatialDomain(e.target.checked, slideId);
});

controller.dropdown.addEventListener('change', async () => {
    const slideId = controller.dropdown.value;
    await checkFolders(slideId);
    // Hide second viewer and legends
    toggleSegmentation(false, slideId);
    toggleSpatialDomain(false, slideId);
    // ...existing code...
});
