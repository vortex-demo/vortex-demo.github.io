import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { calculateWindow, calculateOffset, createOutline } from '../utils.js';


// Create Viewer class
export class Viewer {
    constructor(container_id, metadata, root_dir) {
        // Store metadata
        this.metadata = metadata;
        this.root_dir = root_dir;
        this.mode = 'heatmap';

        // Initialize container
        this.container = document.getElementById(container_id);

        // Initialize camera
        this.camera = new THREE.PerspectiveCamera(75, this.container.offsetWidth / this.container.offsetHeight, 0.1, 1000);
        this.camera.position.y = 3;
        this.camera.position.z = 2;

        // Initialize scene
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        this.renderer.setClearColor(0x000000, 1);
        this.container.appendChild(this.renderer.domElement);

        // Initialize controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.enableZoom = true;
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = -1.0;  // set rotation speed to -2.0 degrees per second

        // --- Slice performance: shared loader + LRU texture cache ---
        // Slicing re-textures the 6 cube faces. Fetching/decoding a PNG per face on every slider
        // tick was the bottleneck, so we (a) reuse one loader, (b) cache decoded textures (LRU, so
        // revisited slices are instant and don't re-upload to the GPU), and (c) only re-fetch faces
        // whose slice index actually changed -- the rest just get re-cropped.
        this._loader = new THREE.TextureLoader();
        this._texCache = new Map();            // url -> THREE.Texture, insertion-ordered for LRU
        this._texCacheMax = 240;               // cap resident textures to bound GPU memory
        this._faceUrl = [null, null, null, null, null, null];  // current image url per material face
        this._sliceGen = 0;                    // guards against stale async loads during fast drags

        // Bind the animate and resize methods to this
        this.animate = this.animate.bind(this);
        this.resize = this.resize.bind(this);

        // Adjust camera on window resize
        window.addEventListener('resize', this.resize, false);

        // Get loading overlay
        this.loading_overlay = document.getElementById('div-loading-overlay');

        // Flag to prevent recursive updates
        this.isSyncing = false;
    }

    // Load tissue
    async load(slide_id, slider_values = null) {
        // Display loading overlay
        this.loading_overlay.style.display = "flex";

        // Store slide id
        this.slide_id = slide_id;

        // Clear scene
        this.scene.clear();

        // Restore camera position
        this.camera.position.y = 3;
        this.camera.position.z = 2;
        this.controls.reset();

        // OTLS volumes are thin slabs; open them at an oblique angle (not straight-down) with a
        // modest zoom, so the landing view shows the 3D block rather than a flat top-face crop.
        if (this.metadata.find(slide => slide.id === slide_id).metadata['Imaging Modality'] === "Open-top light-sheet microscopy (OTLS)") {
            this.camera.position.set(2.6, 1.9, 2.6);
            this.controls.target.set(0, 0, 0);
            this.camera.zoom = 1.3;
            this.camera.updateProjectionMatrix();
            this.controls.update();
        }

        // Compute max dimension for normalization
        this.width = this.metadata.find(slide => slide.id === slide_id).dimensions.x;
        this.depth = this.metadata.find(slide => slide.id === slide_id).dimensions.z;
        this.height = this.metadata.find(slide => slide.id === slide_id).dimensions.y;
        this.scale_factor = Math.max(this.width, this.depth, this.height) / 3;

        // Generate tissue outline
        this.outline_geometry = createOutline(this.width / this.scale_factor, this.height / this.scale_factor, this.depth / this.scale_factor);
        this.outline_material = new THREE.LineBasicMaterial({ color: 0xffffff });
        this.outline = new THREE.LineSegments(this.outline_geometry, this.outline_material);
        this.scene.add(this.outline);

        // Generate dummy tissue block
        let texture = new THREE.Texture();
        let tissue_block_materials = Array(6).fill().map(() => new THREE.MeshBasicMaterial({ map: texture }));
        let block_geometry = new THREE.BoxGeometry(this.width / this.scale_factor, this.height / this.scale_factor, this.depth / this.scale_factor);
        this.tissue_block = new THREE.Mesh(block_geometry, tissue_block_materials);

        // The block's materials were just recreated with a blank placeholder texture, so forget
        // which image each face is showing -- otherwise slice()'s "unchanged face" fast path could
        // keep the blank placeholder (e.g. on a same-slice reload when toggling Spatial Domain).
        this._faceUrl = [null, null, null, null, null, null];
        this.scene.add(this.tissue_block);

        // Ensure selectedGene is set
        if (!this.selectedGene) {
            this.selectedGene = 'images';
        }

        // Initialize textures
        const initialSliderValues = slider_values || {
            x: [0, this.width - 1],
            y: [0, this.height - 1],
            z: [0, this.depth - 1]
        };
        await this.slice(initialSliderValues);

        // Hide loading overlay
        this.loading_overlay.style.display = "none";

        // Ensure the colorbar is displayed
        let colorbar = document.getElementById('div-colorbar');
        colorbar.style.display = 'flex';
    }

    // Add this method
    loadGene(geneName, slider_values = null) {
        // Display loading overlay
        this.loading_overlay.style.display = "flex";

        // Store selected gene
        this.selectedGene = geneName;

        // Reload the tissue with the new gene
        // Get current slider values
        let current_slider_values = slider_values || {
            y: sliders.sliders.y.slider('values'),
            x: sliders.sliders.x.slider('values'),
            z: sliders.sliders.z.slider('values')
        };
        this.slice(current_slider_values).then(() => {
            // Hide loading overlay
            this.loading_overlay.style.display = "none";
        });
    }

    // Load segmentation (similar to loadGene but points to 'segmentation')
    loadSegmentation(slider_values = null) {
        // Reuse existing load function
        this.selectedGene = 'segmentation';
        let currentValues = slider_values || {
            y: sliders.sliders.y.slider('values'),
            x: sliders.sliders.x.slider('values'),
            z: sliders.sliders.z.slider('values')
        };
        console.log(`Loading segmentation data from: ${this.root_dir}${this.slide_id}/segmentation`);
        this.slice(currentValues).then(() => {
            this.loading_overlay.style.display = "none";
        });
    }

    // Add this method
    loadSpatialDomain(slider_values = null) {
        this.selectedGene = 'spatial_domains';
        let currentValues = slider_values || {
            y: sliders.sliders.y.slider('values'),
            x: sliders.sliders.x.slider('values'),
            z: sliders.sliders.z.slider('values')
        };
        console.log(`Loading spatial domain data from: ${this.root_dir}${this.slide_id}/spatial_domains`);
        this.slice(currentValues).then(() => {
            this.loading_overlay.style.display = "none";
        });
    }

    // Fetch a texture, using the LRU cache when possible (marks it most-recently-used).
    _getTexture(url) {
        const cached = this._texCache.get(url);
        if (cached) {
            this._texCache.delete(url);
            this._texCache.set(url, cached);   // move to most-recently-used
            return Promise.resolve(cached);
        }
        return new Promise((resolve, reject) => {
            this._loader.load(url, tex => {
                this._texCache.set(url, tex);
                // Evict least-recently-used textures beyond the cap and free their GPU memory,
                // but never dispose one that is currently shown on a face.
                while (this._texCache.size > this._texCacheMax) {
                    const oldestKey = this._texCache.keys().next().value;
                    const oldTex = this._texCache.get(oldestKey);
                    this._texCache.delete(oldestKey);
                    if (oldTex && !this._faceUrl.includes(oldestKey)) oldTex.dispose();
                }
                resolve(tex);
            }, undefined, reject);
        });
    }

    // Update tissue block
    slice = async (slider_values) => {
        let geneFolder = (this.selectedGene === 'Image Only') ? 'images' : this.selectedGene;
        let path_to_data = `${this.root_dir}${this.slide_id}/${geneFolder}`;

        this.bounds = {
            left: slider_values.x[0],
            right: slider_values.x[1],
            front: slider_values.z[1],
            back: slider_values.z[0],
            top: slider_values.y[0],
            bottom: slider_values.y[1]
        };

        this.bounds_normalized = {
            left: this.bounds.left / this.width,
            right: this.bounds.right / this.width,
            front: this.bounds.front / this.depth,
            back: this.bounds.back / this.depth,
            top: this.bounds.top / this.height,
            bottom: this.bounds.bottom / this.height
        };

        const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
        const axis = ['x', 'x', 'y', 'y', 'z', 'z'];
        const gen = ++this._sliceGen;   // this call's generation; ignore its loads if superseded

        const applyCrop = (tex, face) => {
            const { window_horizontal, window_vertical } = calculateWindow(face, this.bounds_normalized);
            const { offset_horizontal, offset_vertical } = calculateOffset(face, this.bounds_normalized);
            tex.repeat.set(window_horizontal, window_vertical);
            tex.offset.set(offset_horizontal, offset_vertical);
            tex.needsUpdate = true;
        };

        // For each face: if its image is unchanged, only re-crop (no fetch/decode); otherwise fetch
        // (instant on a cache hit) and apply.
        let promises = faces.map((face, i) => {
            const url = `${path_to_data}/${axis[i]}/${this.bounds[face]}.png`;
            const mat = this.tissue_block.material[i];

            if (this._faceUrl[i] === url && mat.map) {
                applyCrop(mat.map, face);
                return Promise.resolve();
            }
            return this._getTexture(url).then(tex => {
                if (gen !== this._sliceGen) return;   // a newer slice() has superseded this load
                applyCrop(tex, face);
                mat.map = tex;
                mat.needsUpdate = true;
                this._faceUrl[i] = url;
            }).catch(err => console.error(`Failed to load image: ${url}`, err));
        });

        // Wait for all textures to load
        try {
            await Promise.all(promises);
        } catch (err) {
            console.error('An error occurred while loading textures:', err);
        }

        // Update dimensions
        let width_new = this.bounds.right - this.bounds.left;
        let height_new = this.bounds.bottom - this.bounds.top;
        let depth_new = this.bounds.front - this.bounds.back;
        this.tissue_block.geometry.dispose();
        this.tissue_block.geometry = new THREE.BoxGeometry(width_new / this.scale_factor, height_new / this.scale_factor, depth_new / this.scale_factor);

        // Update this.tissue_block position
        this.tissue_block.position.x = ((this.bounds.left + this.bounds.right - this.width) / 2) / (this.scale_factor);
        this.tissue_block.position.z = ((this.bounds.front + this.bounds.back - this.depth) / 2) / (this.scale_factor);
        this.tissue_block.position.y = ((this.height - this.bounds.top - this.bounds.bottom) / 2) / (this.scale_factor);
    }

    // Sync camera controls from another viewer
    sync_camera(viewer) {
        // Listen to changes on viewer.controls, apply to this
        if (!viewer || !viewer.controls || !this.controls) return;
        viewer.controls.addEventListener('change', () => {
            if (this.isSyncing) return;
            this.isSyncing = true;
            this.camera.position.copy(viewer.camera.position);
            this.camera.quaternion.copy(viewer.camera.quaternion);
            // Also sync the orbit target: panning translates both the camera and the target, so
            // without this the pan is lost when the other viewer re-derives its camera from its
            // (stale) target. Sync zoom too so scroll/zoom stays matched.
            this.controls.target.copy(viewer.controls.target);
            this.camera.zoom = viewer.camera.zoom;
            this.camera.updateProjectionMatrix();
            this.controls.update();
            this.isSyncing = false;
        });
    }

    // Start animation loop
    animate() {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // Resize viewer
    resize() {
        this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
    }

    // Reset buttons
    reset_buttons() {
        // Grab axis button elements
        let cameraButtons = {
            y: $("#button-camera-y"),
            x: $("#button-camera-x"),
            z: $("#button-camera-z")
        };

        // Event listeners for axis buttons
        for (let axis in cameraButtons) {
            cameraButtons[axis].click(() => {
                if (axis === 'y') {
                    // Look along -Y direction for top-down view
                    this.camera.position.set(0, 3, 0);
                    this.camera.lookAt(0, 0, 0);
                } else if (axis === 'x') {
                    // Look along +X direction
                    this.camera.position.set(3, 0, 0);
                    this.camera.lookAt(0, 0, 0);
                } else if (axis === 'z') {
                    // Look along +Z direction
                    this.camera.position.set(0, 0, 3);
                }

                // Focus camera on center
                this.camera.lookAt(0, 0, 0);

                // Reset the controls target to ensure camera pans back to the origin
                this.controls.target.set(0, 0, 0);
            });
        }
    }

    // Autorotate button
    autorotate_button() {
        // Grab autorotate button element
        let autorotate_button = document.getElementById('button-autorotate')
        autorotate_button.addEventListener('click', () => {
            if (autorotate_button.classList.contains('active')) {
                this.controls.autoRotate = false;
            } else {
                this.controls.autoRotate = true;
            }
            autorotate_button.classList.toggle('active');
        });
    }
}