// BarsVisualization.js
// Advanced Three.js audio visualization with frequency band separation and dynamic effects

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { gsap } from 'gsap';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, GodRaysEffect, SMAAEffect } from 'postprocessing';

// Configuration for visualization
const config = {
  // General settings
  numBars: 128,
  spacing: 0.7,
  maxHeight: 25,
  minHeight: 0.5,
  
  // Color settings - Spotify-inspired with modern aesthetic
  baseColor: new THREE.Color(0x1db954),  // Spotify green
  bassColor: new THREE.Color(0x1ed760),  // Lighter green for bass
  midColor: new THREE.Color(0x4059ff),   // Blue for mids
  highColor: new THREE.Color(0xb23deb),  // Purple for highs
  
  // Frequency bands for audio separation
  frequencyBands: {
    bass: { from: 0, to: 24 },        // Bass frequencies
    lowMid: { from: 24, to: 48 },     // Low-mid frequencies
    highMid: { from: 48, to: 80 },    // High-mid frequencies
    treble: { from: 80, to: 128 }     // Treble frequencies
  },
  
  // Animation settings
  animationSpeed: 1.2,
  pulseStrength: 1.5,
  
  // Visual settings
  useReflection: true,
  useGlow: true
};

// Global variables for rendering
let composer;
let instancedMesh;
let reflectionMesh;
let dummy = new THREE.Object3D();
let trackInfoText;
let frequencyText;
let analyzerValues = new Array(config.numBars).fill(0);
let lightSource;

/**
 * Set up postprocessing effects
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Camera} camera - Three.js camera
 */
export function setupPostprocessing(renderer, scene, camera) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  // Add bloom for glow effect
  const bloomEffect = new BloomEffect({
    intensity: 1.0,
    luminanceThreshold: 0.4,
    luminanceSmoothing: 0.7,
    height: 480
  });
  
  // Add anti-aliasing for smoother edges
  const smaaEffect = new SMAAEffect();
  
  // Create god rays effect from the light source if it exists
  let godRaysEffect;
  if (lightSource) {
    godRaysEffect = new GodRaysEffect(camera, lightSource, {
      resolutionScale: 0.5,
      density: 0.96,
      decay: 0.92,
      weight: 0.4,
      samples: 60
    });
  }
  
  // Combine effects
  const effectPass = new EffectPass(
    camera, 
    bloomEffect, 
    smaaEffect,
    ...(godRaysEffect ? [godRaysEffect] : [])
  );
  effectPass.renderToScreen = true;
  composer.addPass(effectPass);
  
  return composer;
}

/**
 * Create bars visualization
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Object} - Visualization components
 */
export function createBarsVisualization(scene) {
  // Create array to return with visualization elements
  const bars = [];
  
  // Create instanced mesh for all bars (more efficient than individual meshes)
  const barGeometry = new THREE.BoxGeometry(0.6, 1, 0.6);
  const barMaterial = new THREE.MeshStandardMaterial({
    color: config.baseColor,
    emissive: config.baseColor.clone().multiplyScalar(0.3),
    metalness: 0.8,
    roughness: 0.2,
  });
  
  // Create bars using instanced mesh for better performance
  instancedMesh = new THREE.InstancedMesh(barGeometry, barMaterial, config.numBars);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.position.y = 0;
  
  // Set up initial bar positions
  for (let i = 0; i < config.numBars; i++) {
    const x = (i - config.numBars / 2) * config.spacing;
    dummy.position.set(x, config.minHeight / 2, 0);
    dummy.scale.set(1, config.minHeight, 1);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
    
    // Store bar index for compatibility with existing code
    bars[i] = { index: i };
  }
  scene.add(instancedMesh);
  
  // Create reflective floor
  if (config.useReflection) {
    const floorGeometry = new THREE.PlaneGeometry(120, 120);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.3,
      opacity: 0.6,
      transparent: true,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    scene.add(floor);
    bars.floor = floor;
    
    // Create reflection of bars
    reflectionMesh = instancedMesh.clone();
    reflectionMesh.scale.y = -0.4; // Scaled down reflection
    reflectionMesh.position.y = -1;
    scene.add(reflectionMesh);
    bars.reflection = reflectionMesh;
  }
  
  // Add central light source for god rays
  const sphereGeometry = new THREE.SphereGeometry(3, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6
  });
  lightSource = new THREE.Mesh(sphereGeometry, sphereMaterial);
  lightSource.position.set(0, 15, -20);
  scene.add(lightSource);
  bars.lightSource = lightSource;
  
  // Add frequency band text
  trackInfoText = new Text();
  trackInfoText.text = 'Visualizing Audio';
  trackInfoText.fontSize = 2;
  trackInfoText.color = 0xffffff;
  trackInfoText.position.set(0, 10, 0);
  trackInfoText.anchorX = 'center';
  trackInfoText.anchorY = 'middle';
  trackInfoText.sync();
  scene.add(trackInfoText);
  bars.trackInfoText = trackInfoText;
  
  // Add frequency band indicators
  frequencyText = new Text();
  frequencyText.text = 'BASS                MID                TREBLE';
  frequencyText.fontSize = 1.2;
  frequencyText.color = 0x999999;
  frequencyText.position.set(0, -3, 5);
  frequencyText.anchorX = 'center';
  frequencyText.anchorY = 'middle';
  frequencyText.sync();
  scene.add(frequencyText);
  bars.frequencyText = frequencyText;
  
  // Store references to meshes
  bars.instancedMesh = instancedMesh;
  
  return bars;
}

/**
 * Remove bars visualization from scene
 * @param {Object} bars - Visualization components
 * @param {THREE.Scene} scene - Three.js scene
 */
export function removeBarsVisualization(bars, scene) {
  if (!bars) return;
  
  // Remove instanced mesh
  if (bars.instancedMesh) {
    scene.remove(bars.instancedMesh);
    bars.instancedMesh.geometry.dispose();
    bars.instancedMesh.material.dispose();
    instancedMesh = null;
  }
  
  // Remove reflection
  if (bars.reflection) {
    scene.remove(bars.reflection);
    bars.reflection.geometry.dispose();
    bars.reflection.material.dispose();
    reflectionMesh = null;
  }
  
  // Remove floor
  if (bars.floor) {
    scene.remove(bars.floor);
    bars.floor.geometry.dispose();
    bars.floor.material.dispose();
  }
  
  // Remove light source
  if (bars.lightSource) {
    scene.remove(bars.lightSource);
    bars.lightSource.geometry.dispose();
    bars.lightSource.material.dispose();
    lightSource = null;
  }
  
  // Remove text elements
  if (bars.trackInfoText) {
    scene.remove(bars.trackInfoText);
    bars.trackInfoText.dispose();
  }
  
  if (bars.frequencyText) {
    scene.remove(bars.frequencyText);
    bars.frequencyText.dispose();
  }
}

/**
 * Simulate frequency data for different audio bands
 * @param {number} powerLevel - Overall power level (0-1)
 * @param {Object} audioFeatures - Audio features from Spotify API
 * @param {number} time - Current animation time
 * @param {boolean} isPaused - Whether playback is paused
 * @returns {Array} - Array of frequency values
 */
function simulateFrequencyData(powerLevel, audioFeatures, time, isPaused) {
  // Get audio features or use defaults
  const energy = audioFeatures?.energy || 0.5;
  const danceability = audioFeatures?.danceability || 0.5;
  const valence = audioFeatures?.valence || 0.5;
  const instrumentalness = audioFeatures?.instrumentalness || 0.5;
  
  // Create frequency distribution
  const frequencies = new Array(config.numBars).fill(0);
  
  if (isPaused) {
    // When paused, show a gentle wave pattern
    for (let i = 0; i < config.numBars; i++) {
      frequencies[i] = 0.1 + 0.05 * Math.sin(i / 10 + time * 0.5);
    }
    return frequencies;
  }
  
  // Bass frequencies - stronger peaks, slower rhythm
  for (let i = config.frequencyBands.bass.from; i < config.frequencyBands.bass.to; i++) {
    // Create bass-like pattern - slow thumps
    const bassIntensity = 0.6 + 0.4 * energy;
    frequencies[i] = bassIntensity * (
      0.5 + 0.5 * Math.pow(Math.sin(time * (0.8 + danceability * 0.4) + i * 0.1), 2)
    );
    
    // Add some randomness for realism
    frequencies[i] += 0.1 * Math.random() * energy;
  }
  
  // Low-mid frequencies - steady rhythm elements
  for (let i = config.frequencyBands.lowMid.from; i < config.frequencyBands.lowMid.to; i++) {
    // Create mid-like pattern - more varied
    frequencies[i] = 0.4 * (
      0.3 + 0.7 * Math.pow(Math.sin(time * 1.5 + i * 0.2), 2)
    );
    
    // Add dance beat patterns for danceable tracks
    if (danceability > 0.6) {
      frequencies[i] += 0.3 * Math.pow(Math.sin(time * 3.2 + i * 0.1), 4) * danceability;
    }
  }
  
  // High-mid frequencies - melodic elements
  for (let i = config.frequencyBands.highMid.from; i < config.frequencyBands.highMid.to; i++) {
    // Melodic patterns - influenced by valence (happiness)
    const factor = valence > 0.5 ? 2.0 : 1.2;
    frequencies[i] = 0.3 * (
      0.2 + 0.8 * Math.pow(Math.sin(time * factor + i * 0.3), 2)
    );
    
    // More variation in high-mids for instrumental tracks
    if (instrumentalness > 0.5) {
      frequencies[i] += 0.25 * Math.pow(Math.sin(time * 4.5 + i * 0.4), 4) * instrumentalness;
    }
  }
  
  // Treble frequencies - highest, fastest changing
  for (let i = config.frequencyBands.treble.from; i < config.numBars; i++) {
    // High frequency content - influenced by energy
    frequencies[i] = 0.2 * (
      0.1 + 0.9 * Math.pow(Math.sin(time * 5.0 + i * 0.5), 2)
    ) * (0.5 + 0.5 * energy);
    
    // Add some randomness for hi-hats and cymbals
    frequencies[i] += 0.15 * Math.random() * energy;
  }
  
  // Apply smoothing with previous values for more natural transitions
  for (let i = 0; i < config.numBars; i++) {
    // Apply overall power level
    frequencies[i] *= powerLevel;
    
    // Smooth transitions
    analyzerValues[i] = analyzerValues[i] * 0.7 + frequencies[i] * 0.3;
  }
  
  return analyzerValues;
}

/**
 * Update bars visualization based on audio data
 * @param {Object} bars - Visualization components
 * @param {number} powerLevel - Current audio power level (0-1)
 * @param {number} pulseTime - Beat pulse effect time (0-1)
 * @param {boolean} isPaused - Whether playback is paused
 * @param {number} animationTime - Current animation time
 * @param {Object} audioFeatures - Audio features from Spotify API
 */
export function updateBarsVisualization(bars, powerLevel, pulseTime, isPaused, animationTime, audioFeatures) {
  if (!bars || !bars.instancedMesh) return;
  
  // Get audio features
  const energy = audioFeatures?.energy || 0.5;
  const danceability = audioFeatures?.danceability || 0.5;
  const valence = audioFeatures?.valence || 0.5;
  
  // Simulate frequency data based on audio features
  const frequencies = simulateFrequencyData(powerLevel, audioFeatures, animationTime, isPaused);
  
  // Update instanced mesh based on frequency data
  for (let i = 0; i < config.numBars; i++) {
    // Calculate height based on frequency value
    const height = config.minHeight + frequencies[i] * config.maxHeight;
    
    // Position based on bar index
    const x = (i - config.numBars / 2) * config.spacing;
    
    // Assign different colors based on frequency band
    let color;
    if (i < config.frequencyBands.bass.to) {
      // Bass frequencies - green to teal
      color = config.bassColor.clone();
    } else if (i < config.frequencyBands.lowMid.to) {
      // Low-mid frequencies - teal to blue
      color = config.midColor.clone();
    } else if (i < config.frequencyBands.highMid.to) {
      // High-mid frequencies - blue to purple
      color = config.midColor.clone().lerp(config.highColor, (i - config.frequencyBands.lowMid.to) / 
        (config.frequencyBands.highMid.to - config.frequencyBands.lowMid.to));
    } else {
      // Treble frequencies - purple
      color = config.highColor.clone();
    }
    
    // Add color variation based on height
    const heightFactor = (height - config.minHeight) / config.maxHeight;
    const intensity = isPaused ? 0.3 : 0.5 + heightFactor * 0.5;
    
    // Set color for this instance
    bars.instancedMesh.setColorAt(i, color.multiplyScalar(intensity));
    
    // Create matrix for this bar
    dummy.position.set(x, height / 2, 0);
    dummy.scale.set(1, height, 1);
    
    // Add some dynamic movement and rotation
    if (!isPaused && danceability > 0.5) {
      // Subtle drift based on frequency band
      const drift = Math.sin(animationTime * (1 + i * 0.01) + i * 0.2) * 0.1 * danceability;
      dummy.position.x += drift;
      
      // Subtle rotation
      dummy.rotation.y = Math.sin(animationTime * 0.8 + i * 0.1) * 0.2 * danceability;
    } else {
      dummy.rotation.y = 0;
    }
    
    // Update matrix
    dummy.updateMatrix();
    bars.instancedMesh.setMatrixAt(i, dummy.matrix);
  }
  
  // Update instance matrix and colors
  bars.instancedMesh.instanceMatrix.needsUpdate = true;
  if (bars.instancedMesh.instanceColor) bars.instancedMesh.instanceColor.needsUpdate = true;
  
  // Update reflection if it exists
  if (bars.reflection) {
    // Copy matrices from original mesh to reflection
    for (let i = 0; i < config.numBars; i++) {
      bars.instancedMesh.getMatrixAt(i, dummy.matrix);
      
      // Extract position and scale
      dummy.position.setFromMatrixPosition(dummy.matrix);
      const scale = new THREE.Vector3();
      scale.setFromMatrixScale(dummy.matrix);
      
      // Mirror position and update matrix
      dummy.position.y = -dummy.position.y;
      dummy.scale.copy(scale);
      dummy.scale.y *= 0.3; // Shorter reflection
      dummy.updateMatrix();
      
      bars.reflection.setMatrixAt(i, dummy.matrix);
    }
    bars.reflection.instanceMatrix.needsUpdate = true;
    
    // Update reflection opacity based on energy
    bars.reflection.material.opacity = isPaused ? 0.2 : 0.3 + 0.3 * energy;
  }
  
  // Update floor reflectivity based on energy
  if (bars.floor) {
    bars.floor.material.metalness = isPaused ? 0.7 : 0.7 + 0.3 * pulseTime;
    bars.floor.material.opacity = isPaused ? 0.4 : 0.4 + 0.2 * pulseTime;
  }
  
  // Update light source pulsing with the beat
  if (bars.lightSource) {
    const pulseScale = isPaused ? 1 : 1 + pulseTime * 0.4;
    bars.lightSource.scale.set(pulseScale, pulseScale, pulseScale);
    
    // Change color based on valence (happiness)
    const lightHue = valence > 0.5 ? 0.3 : 0.6; // Green for happy, blue for sad
    const lightColor = new THREE.Color().setHSL(lightHue, 0.8, 0.5 + pulseTime * 0.3);
    bars.lightSource.material.color.copy(lightColor);
    
    // Update opacity
    bars.lightSource.material.opacity = isPaused ? 0.2 : 0.3 + 0.3 * pulseTime;
  }
  
  // Update track info text
  if (bars.trackInfoText) {
    if (isPaused) {
      bars.trackInfoText.text = 'Paused';
    } else {
      const energyText = energy > 0.7 ? 'High Energy' : energy > 0.4 ? 'Medium Energy' : 'Low Energy';
      const valenceText = valence > 0.7 ? 'Positive' : valence > 0.4 ? 'Neutral' : 'Melancholic';
      bars.trackInfoText.text = `${energyText} | ${valenceText}`;
    }
    
    // Pulse text with beat
    const textScale = isPaused ? 1 : 1 + pulseTime * 0.1;
    gsap.to(bars.trackInfoText.scale, { 
      x: textScale, 
      y: textScale, 
      z: textScale, 
      duration: 0.1,
      ease: "power2.out" 
    });
    
    // Update text color based on dominant colors
    const textHue = valence > 0.5 ? 0.3 : 0.6;
    const textColor = new THREE.Color().setHSL(textHue, 0.9, 0.7);
    bars.trackInfoText.color = textColor.getHex();
    
    // Sync text changes
    bars.trackInfoText.sync();
  }
}

/**
 * Render the scene with postprocessing effects
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Camera} camera - Three.js camera
 */
export function renderWithPostprocessing(renderer, scene, camera) {
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

// Export configuration and main functions
export { config };