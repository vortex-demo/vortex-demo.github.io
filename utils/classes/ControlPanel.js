// Define the updateLegend function
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

// Create ControlPanel class
export class ControlPanel {
    constructor(panel_id, metadata) {
        // Initialize panel
        this.panel = document.getElementById(panel_id);

        // Load metadata
        this.metadata = metadata;

        this.metadataInfo = document.getElementById('metadata-info');

        this.selectedGene = 'images'; // Initialize to 'images'

        this.viewers = window.viewers;

        // **Initialize slide selection dropdown**
        this.dropdown = document.getElementById('slide-select');
        this.metadata.forEach(slide => {
            let option = document.createElement('option');
            option.value = slide.id;
            option.textContent = slide.id;
            this.dropdown.appendChild(option);
        });

        // Add event listener for slide selection
        this.dropdown.addEventListener('change', () => {
            // Turn off both toggles
            document.getElementById('seg-toggle').checked = false;
            document.getElementById('domain-toggle').checked = false;

            const slideId = this.dropdown.value;
            const showSegmentation = document.getElementById('seg-toggle').checked;
            if (showSegmentation) {
                window.segViewer.load(slideId);
                window.segViewer.loadSegmentation();
                window.segViewer.resize();
                this.viewers.forEach(viewer => {
                    viewer.load(slideId).then(() => {
                        viewer.resize();
                    });
                });
            } else {
                this.selectedGene = 'images'; // Ensure "images" gene is selected
                this.viewers.forEach(viewer => {
                    viewer.selectedGene = 'images'; // Ensure "images" gene is selected in viewer
                    viewer.load(slideId).then(() => {
                        viewer.resize();
                    });
                });
            }
            sliders.build(slideId);
            this.update(slideId);
            this.updateColorbar(); // Ensure the colorbar is updated based on the initial selection
        });

        // Add gene list container
        this.geneListContainer = document.getElementById('gene-list');

        // Bind event handler
        this.onGeneSelect = this.onGeneSelect.bind(this);

        // Append the bottom logo div to the panel (move this here)
        let logo_div_bottom = document.createElement('div');
        logo_div_bottom.classList.add('div-logo-bottom');

        // Add logos to bottom (ensure you have these images)
        let logo_lab = document.createElement('img');
        logo_lab.src = 'logos/mahmoodlab.png';
        logo_lab.classList.add('logos-small');
        logo_div_bottom.appendChild(logo_lab);

        let logo_hms = document.createElement('img');
        logo_hms.src = 'logos/hms.png';
        logo_hms.classList.add('logos-small');
        logo_div_bottom.appendChild(logo_hms);

        let logo_bwh = document.createElement('img');
        logo_bwh.src = 'logos/mgb.svg';
        logo_bwh.classList.add('logos-small');
        logo_div_bottom.appendChild(logo_bwh);

        // Append the bottom logo div to the panel
        this.panel.appendChild(logo_div_bottom);

        // Initialize gene list with the first slide's available genes
        if (this.metadata.length > 0) {
            this.update(this.metadata[0].id);
        }

        // Ensure the colorbar is updated based on the initial selection
        this.updateColorbar();
    }

    update(slide_id) {
        // Get slide data
        let slide_data = this.metadata.find(slide => slide.id === slide_id);

        if (!slide_data) {
            console.error(`Slide with id ${slide_id} not found.`);
            return;
        }

        // Clear metadata-info div
        this.metadataInfo.innerHTML = '';

        // Add metadata
        Object.entries(slide_data.metadata).forEach(([key, value]) => {
            let div = document.createElement('div');
            div.classList.add('metadata-item');

            let keySpan = document.createElement('span');
            keySpan.classList.add('metadata-key');
            keySpan.textContent = key + ': ';

            let valueSpan = document.createElement('span');
            valueSpan.classList.add('metadata-value');
            valueSpan.textContent = value;

            div.appendChild(keySpan);
            div.appendChild(valueSpan);
            this.metadataInfo.appendChild(div);
        });

        // Update gene list
        this.updateGeneList(slide_data.available_genes);

        // Update legends
        if (slide_data.segmentationLegend) {
            updateLegend('segmentation-legend', slide_data.segmentationLegend);
        }
        if (slide_data.domainLegend) {
            updateLegend('domain-legend', slide_data.domainLegend);
        }
    }

    updateGeneList(genes) {
        // Clear the gene list container
        this.geneListContainer.innerHTML = '';

        // Create 'Image Only' option
        let imageOnlyOption = this.createGeneItem({
            name: 'Image Only',
            description: '',
            statistics: null
        });

        // Add 'selected' class to 'Image Only' option when the app first loads
        imageOnlyOption.classList.add('selected');
        this.geneListContainer.appendChild(imageOnlyOption);

        // Create gene items
        genes.forEach(gene => {
            let geneItem = this.createGeneItem(gene);
            this.geneListContainer.appendChild(geneItem);
        });

        // Ensure the colorbar is updated based on the initial selection
        this.updateColorbar();
    }

    createGeneItem(gene) {
        // Create the main container div for the gene item
        let geneDiv = document.createElement('div');
        geneDiv.classList.add('gene-item'); // Add a class for styling and selection
        geneDiv.dataset.geneName = gene.name; // Set data attribute for easy access

        // Create a span to display the gene's name
        let geneNameSpan = document.createElement('span');
        geneNameSpan.classList.add('gene-name'); // Optional: for styling
        geneNameSpan.textContent = gene.name;

        // Append the gene name to the geneDiv
        geneDiv.appendChild(geneNameSpan);

        // Gene description (only if available)
        if (gene.description) {
            let geneDescription = document.createElement('p');
            geneDescription.classList.add('gene-description'); // Optional: for styling
            geneDescription.textContent = gene.description;
            geneDiv.appendChild(geneDescription);
        }

        // Gene statistics (only if available)
        if (gene.statistics) {
            let statsList = document.createElement('ul');
            statsList.classList.add('gene-statistics'); // Optional: for styling
            for (let stat in gene.statistics) {
                let statItem = document.createElement('li');
                statItem.textContent = `${stat}: ${gene.statistics[stat]}`;
                statsList.appendChild(statItem);
            }
            geneDiv.appendChild(statsList);
        }

        // Add event listener for selection
        geneDiv.addEventListener('click', this.onGeneSelect);

        return geneDiv;
    }

    onGeneSelect(event) {
        // Remove 'selected' class from all gene items
        document.querySelectorAll('.gene-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add 'selected' class to clicked item
        event.currentTarget.classList.add('selected');

        // Get selected gene name from data attribute
        let selectedGene = event.currentTarget.dataset.geneName;

        // Update the selectedGene property
        this.selectedGene = selectedGene;

        // Update the main viewer with the selected gene
        this.viewers.forEach(viewer => {
            if (viewer !== window.segViewer) {
                viewer.loadGene(selectedGene);
            }
        });

        // Show or hide the colorbar based on the selected gene
        this.updateColorbar();

        // Update the title above the volume
        this.updateTitle();
    }

    updateTitle() {
        const geneTitleElement = document.getElementById('gene-title');
        const segTitleElement = document.getElementById('segmentation-title');

        if (document.getElementById('seg-toggle').checked) {
            segTitleElement.style.display = 'block';
        } else {
            segTitleElement.style.display = 'none';
        }

        if (this.selectedGene === 'images' || this.selectedGene === 'Image Only') {
            geneTitleElement.style.display = 'none';
        } else {
            geneTitleElement.textContent = `Gene Expression: ${this.selectedGene}`;
            geneTitleElement.style.display = 'block';
        }
    }

    updateColorbar() {
        // Show or hide the colorbar based on the selected gene
        let colorbar = document.getElementById('colorbar-container');
        let colorbarHeader = document.getElementById('colorbar-header');
        let hideColorbarGenes = ['Image Only', 'images']; // Genes that should hide the colorbar
        let shouldHide = hideColorbarGenes.includes(this.selectedGene);

        if (shouldHide) {
            colorbar.style.display = 'none';
            colorbarHeader.style.display = 'none';
        } else {
            colorbar.style.display = 'flex';
            colorbarHeader.style.display = 'block';
        }
    }

    // Activate controller
    control(viewers, sliders) {
        // Build sliders with initial sample
        sliders.build(this.dropdown.value);

        // The slide selection change event is already handled in the constructor
    }
}
