// WaveformVisualization.js
// Handles the waveform visualization type for the audio visualizer

import * as THREE from 'three';

// Configuration for waveform visualization
const config = {
  numPoints: 256,
  width: 40,
  color: 0x1db954
};

/**
 * Create waveform visualization
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {Object} - Waveform object with main line and shadow line
 */
export function createWaveformVisualization(scene) {
  // Create points
  const points = [];
  for (let i = 0; i < config.numPoints; i++) {
    const x = (i / (config.numPoints - 1)) * config.width - config.width / 2;
    points.push(new THREE.Vector3(x, 0, 0));
  }
  
  // Create main line
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: config.color,
    linewidth: 2
  });
  
  const waveform = new THREE.Line(geometry, material);
  scene.add(waveform);
  
  // Add a second "shadow" line for effect
  const shadowMaterial = new THREE.LineBasicMaterial({ 
    color: config.color,
    linewidth: 1,
    opacity: 0.3,
    transparent: true
  });
  
  const shadowGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const shadowLine = new THREE.Line(shadowGeometry, shadowMaterial);
  shadowLine.position.z = -0.5;
  scene.add(shadowLine);
  
  // Store shadow line in waveform's userData for reference
  waveform.userData = {
    shadowLine: shadowLine
  };
  
  return waveform;
}

/**
 * Remove waveform visualization from scene
 * @param {Object} waveform - Waveform object
 * @param {THREE.Scene} scene - Three.js scene
 */
export function removeWaveformVisualization(waveform, scene) {
  if (!waveform) return;
  
  // Remove shadow line if it exists
  if (waveform.userData && waveform.userData.shadowLine) {
    scene.remove(waveform.userData.shadowLine);
    waveform.userData.shadowLine.geometry.dispose();
    waveform.userData.shadowLine.material.dispose();
  }
  
  // Remove main waveform
  scene.remove(waveform);
  waveform.geometry.dispose();
  waveform.material.dispose();
}

/**
 * Update waveform visualization based on audio data
 * @param {Object} waveform - Waveform object
 * @param {number} powerLevel - Current audio power level (0-1)
 * @param {number} pulseTime - Beat pulse effect time (0-1)
 * @param {boolean} isPaused - Whether playback is paused
 * @param {number} animationTime - Current animation time
 * @param {Object} audioFeatures - Audio features from Spotify API
 */
export function updateWaveformVisualization(waveform, powerLevel, pulseTime, isPaused, animationTime, audioFeatures) {
  if (!waveform) return;
  
  const positions = waveform.geometry.attributes.position.array;
  const count = positions.length / 3;
  
  // Get shadow line if available
  const shadowLine = waveform.userData.shadowLine;
  let shadowPositions = null;
  if (shadowLine) {
    shadowPositions = shadowLine.geometry.attributes.position.array;
  }
  
  // Use audio features to influence visualization
  const energy = audioFeatures ? audioFeatures.energy : 0.5;
  const tempo = audioFeatures ? audioFeatures.tempo / 200 : 0.6; // Normalize tempo
  
  // Time-based animation - slower when paused
  const time = animationTime;
  const motionSpeed = isPaused ? 0.1 : 1.0;
  
  // Beat pulse modifier - minimal when paused
  const beatPulse = isPaused ? 1 : 1 + pulseTime * 2;
  
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    
    // Create wave pattern based on position, time, and audio features
    const phase = (x + config.width/2) / config.width; // 0-1 range
    
    let height;
    if (isPaused) {
      // Simple gentle wave when paused
      height = Math.sin(phase * Math.PI * 8) * 0.8;
    } else {
      // Multiple wave frequencies based on audio features
      const wave1 = Math.sin(time * tempo * motionSpeed * 2 + phase * Math.PI * 8) * 3 * energy;
      const wave2 = Math.sin(time * 0.7 * motionSpeed + phase * Math.PI * 2) * 1.5;
      const wave3 = Math.sin(time * 1.5 * motionSpeed + phase * Math.PI * 16) * energy * 1.2;
      
      // Combine waves and apply power level and beat pulse
      height = (wave1 + wave2 + wave3) * powerLevel * beatPulse;
    }
    
    // Apply height to main wave
    positions[i * 3 + 1] = height;
    
    // Apply to shadow with offset
    if (shadowPositions) {
      shadowPositions[i * 3 + 1] = height * 0.7; // Reduced height for shadow
    }
  }
  
  waveform.geometry.attributes.position.needsUpdate = true;
  
  // Update shadow line if available
  if (shadowLine) {
    shadowLine.geometry.attributes.position.needsUpdate = true;
  }
  
  // Update color based on time and energy
  let hue;
  if (isPaused) {
    // More subdued coloring when paused
    hue = 0.4; // Fixed green-blue
  } else {
    hue = (Math.sin(time * 0.1) * 0.1 + 0.4) % 1; // Keep in green-blue range
  }
  
  waveform.material.color.setHSL(hue, isPaused ? 0.6 : 0.8, isPaused ? 0.4 : 0.5 + pulseTime * 0.2);
  
  if (shadowLine) {
    shadowLine.material.color.setHSL(hue, 0.7, isPaused ? 0.2 : 0.3);
    shadowLine.material.opacity = isPaused ? 0.1 : 0.2 + pulseTime * 0.1;
  }
}

// Export configuration for other modules to access
export { config };