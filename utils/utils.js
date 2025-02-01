import * as THREE from 'three';

// Utility functions for calculating window and offset
export const calculateWindow = (face, bounds_normalized) => {
    const faceConfigs = {
        'bottom': { horizontal: ['right', 'left'], vertical: ['back', 'front'] },
        'top': { horizontal: ['right', 'left'], vertical: ['front', 'back'] },
        'left': { horizontal: ['front', 'back'], vertical: ['bottom', 'top'] },
        'right': { horizontal: ['back', 'front'], vertical: ['bottom', 'top'] },
        'front': { horizontal: ['right', 'left'], vertical: ['bottom', 'top'] },
        'back': { horizontal: ['left', 'right'], vertical: ['bottom', 'top'] }
    };

    const { horizontal, vertical } = faceConfigs[face];
    return { 
        window_horizontal: bounds_normalized[horizontal[0]] - bounds_normalized[horizontal[1]], 
        window_vertical: bounds_normalized[vertical[0]] - bounds_normalized[vertical[1]] 
    };
};

export const calculateOffset = (face, bounds_normalized) => {
    const faceConfigs = {
        'bottom': { horizontal: 'left', vertical: 'back' },
        'top': { horizontal: 'left', vertical: 'front' },
        'left': { horizontal: 'back', vertical: 'bottom' },
        'right': { horizontal: 'front', vertical: 'bottom' },
        'front': { horizontal: 'left', vertical: 'bottom' },
        'back': { horizontal: 'right', vertical: 'bottom' }
    };

    const { horizontal, vertical } = faceConfigs[face];
    return { 
        offset_horizontal: bounds_normalized[horizontal], 
        offset_vertical: 1 - bounds_normalized[vertical] 
    };
};

// Function to create the tissue outline
export function createOutline(width, height, depth) {
    let vertices = [
        -width / 2, -height / 2, -depth / 2, // 0
        width / 2, -height / 2, -depth / 2, // 1
        width / 2, height / 2, -depth / 2, // 2
        -width / 2, height / 2, -depth / 2, // 3
        -width / 2, -height / 2, depth / 2, // 4
        width / 2, -height / 2, depth / 2, // 5
        width / 2, height / 2, depth / 2, // 6
        -width / 2, height / 2, depth / 2, // 7
    ];

    let indices = [
        0, 1, 1, 2, 2, 3, 3, 0, // front face
        4, 5, 5, 6, 6, 7, 7, 4, // back face
        0, 4, 1, 5, 2, 6, 3, 7  // edges
    ];

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);

    return geometry;
}