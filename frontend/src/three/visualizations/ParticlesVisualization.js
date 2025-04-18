// ParticlesVisualization.js
// Handles the particles visualization type for the audio visualizer

import * as THREE from 'three';

// Configuration for particles visualization
const config = {
  count: 2000,
  radius: 20,
  size: 0.2,
  speed: 0.3 // Reduced speed factor
};

/**
 * Create particles visualization
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Array} - Array of particle systems
 */
export function createParticlesVisualization(scene) {
  const particles = [];
  
  // Create particle geometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const sizes = new Float32Array(config.count);
  
  for (let i = 0; i < config.count; i++) {
    // Random position in a sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const r = Math.random() * config.radius;
    
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    
    // Green color with variation
    colors[i * 3] = 0.2 + Math.random() * 0.1;
    colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
    colors[i * 3 + 2] = 0.2 + Math.random() * 0.1;
    
    // Random sizes
    sizes[i] = Math.random() * 2 + 0.5;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const material = new THREE.PointsMaterial({
    size: config.size,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
  particles.push(particleSystem);
  
  return particles;
}

/**
 * Remove particles visualization from scene
 * @param {Array} particles - Array of particle systems
 * @param {THREE.Scene} scene - Three.js scene
 */
export function removeParticlesVisualization(particles, scene) {
  particles.forEach(particleSystem => {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
  });
}

/**
 * Update particles visualization based on audio data
 * @param {Array} particles - Array of particle systems
 * @param {number} powerLevel - Current audio power level (0-1)
 * @param {number} pulseTime - Beat pulse effect time (0-1)
 * @param {boolean} isPaused - Whether playback is paused
 * @param {number} animationTime - Current animation time
 * @param {Object} audioFeatures - Audio features from Spotify API
 */
export function updateParticlesVisualization(particles, powerLevel, pulseTime, isPaused, animationTime, audioFeatures) {
  if (particles.length === 0) return;
  
  const particleSystem = particles[0];
  const positions = particleSystem.geometry.attributes.position.array;
  const colors = particleSystem.geometry.attributes.color.array;
  const sizes = particleSystem.geometry.attributes.size.array;
  
  // Use audio features to influence visualization
  const energy = audioFeatures ? audioFeatures.energy : 0.5;
  const valence = audioFeatures ? audioFeatures.valence : 0.5; // happiness
  
  // Beat pulse modifier - minimal when paused
  const beatPulse = isPaused ? 1 : 1 + pulseTime * 2;
  
  // Time-based animation - much slower when paused
  const time = animationTime;
  const motionSpeed = isPaused ? 0.05 : config.speed;
  
  // Calculate the base radius with pulsing
  let baseRadius;
  if (isPaused) {
    baseRadius = config.radius * 0.8; // Fixed size when paused
  } else {
    baseRadius = config.radius * (0.8 + 0.2 * powerLevel * beatPulse);
  }
  
  for (let i = 0; i < positions.length / 3; i++) {
    // Get original position (normalized direction)
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    
    // Calculate distance from center
    const distance = Math.sqrt(x * x + y * y + z * z);
    if (distance === 0) continue; // Skip particles at exact center
    
    // Normalize direction
    const nx = x / distance;
    const ny = y / distance;
    const nz = z / distance;
    
    // Create pulsating movement based on music power and beats
    let scalar = baseRadius;
    
    // Add wave patterns based on audio features - minimized when paused
    if (!isPaused) {
      const wave = Math.sin(time * motionSpeed * 2 + distance * 3) * 0.3 * energy;
      scalar += wave * baseRadius;
    }
    
    // Apply position
    positions[idx] = nx * scalar;
    positions[idx + 1] = ny * scalar;
    positions[idx + 2] = nz * scalar;
    
    // Update sizes based on beats and energy - smaller when paused
    sizes[i] = isPaused ?
      config.size * 0.7 :
      (0.5 + energy * 0.5) * (1 + pulseTime * 0.5) * config.size * (1 + Math.random() * 0.2);
    
    // Update colors based on valence (happiness level) and beats
    let hue;
    if (isPaused) {
      // More consistent coloring when paused
      hue = (valence * 0.4 + 0.3) % 1;
    } else {
      hue = (valence * 0.6 + 0.2 + Math.sin(time * 0.1 + i * 0.001) * 0.1) % 1;
    }
    
    const saturation = isPaused ? 0.6 : 0.7 + energy * 0.3;
    const lightness = isPaused ? 0.4 : 0.5 + pulseTime * 0.2;
    
    // Convert HSL to RGB
    const color = new THREE.Color();
    color.setHSL(hue, saturation, lightness);
    
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
  }
  
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.geometry.attributes.color.needsUpdate = true;
  particleSystem.geometry.attributes.size.needsUpdate = true;
  
  // Rotate the entire system - very slow when paused
  const rotationSpeed = isPaused ? 0.01 : motionSpeed;
  particleSystem.rotation.y = time * rotationSpeed;
  particleSystem.rotation.z = time * rotationSpeed * 0.5;
}

// Export configuration for other modules to access
export { config };