
// Create Sliders class
export class Sliders {
    constructor(metadata) {
        // Grab slider divs
        this.sliders = {
            y: $('#ySlider'),
            x: $('#xSlider'),
            z: $('#zSlider')
        };

        // Store metadata
        this.metadata = metadata;
        this.geneDropdown = document.getElementById('gene-select');
    }

    // Build sliders
    build(slide_id) {
        // Set slider sizes
        this.width = this.metadata.find(slide => slide.id === slide_id).dimensions.x;
        this.depth = this.metadata.find(slide => slide.id === slide_id).dimensions.z;
        this.height = this.metadata.find(slide => slide.id === slide_id).dimensions.y;
        this.sliderSizes = { y: this.height, x: this.width, z: this.depth };
        // this.isUpdating = false;   // Semaphore variable to prevent simultaneous updates

        // Generate sliders
        for (let axis in this.sliders) {
            this.sliders[axis].slider({
                range: true,
                min: 0,
                max: this.sliderSizes[axis] - 1,
                values: [0, this.sliderSizes[axis] - 1],
                step: 1
            });
        }
    }

    // Link sliders to viewer
    activate(viewers) {
        // Initialize previous slider values
        let prevSliderValues = {
            y: this.sliders.y.slider('values'),
            x: this.sliders.x.slider('values'),
            z: this.sliders.z.slider('values')
        };

        // Start an interval that updates the viewer every 50 milliseconds iff the sliders have changed
        setInterval(() => {
            let newSliderValues = {
                y: this.sliders.y.slider('values'),
                x: this.sliders.x.slider('values'),
                z: this.sliders.z.slider('values')
            };

            // Check if the values have changed
            if (JSON.stringify(newSliderValues) !== JSON.stringify(prevSliderValues)) {
                viewers.forEach(viewer => viewer.slice(newSliderValues));
                if (segViewer.container.style.display !== 'none') {
                    segViewer.slice(newSliderValues); // Update segmentation viewer if visible
                }
                prevSliderValues = newSliderValues;
            }
        }, 100);

        // Activate autoslice listener
        this.autoslice_buttons(viewers);
    }

    // Autoslice event listener
    autoslice_buttons(viewers) {
        // Grab autoslice button elements
        let autosliceButtons = {
            y: $("#button-autoslicer-y"),
            x: $("#button-autoslicer-x"),
            z: $("#button-autoslicer-z")
        };

        // Reset sliders to full range when clicked
        for (let axis in autosliceButtons) {
            autosliceButtons[axis].click(() => {
                this.sliders[axis].slider('values', [0, this.sliderSizes[axis] - 1]);
            });
        }
    }
}