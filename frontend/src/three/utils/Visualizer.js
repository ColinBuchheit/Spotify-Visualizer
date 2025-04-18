// src/three/utils/Visualizer.js
// Main controller for the 3D audio visualizer with enhanced visualization features and in-app music browser

import * as THREE from 'three';
import { renderTrackInfo } from '../../ui/TrackInfo.js';
import { createVolumeControl } from '../../ui/VolumeControl.js';
import { refreshAccessToken } from '../../auth/handleAuth.js';
import { createMusicBrowser } from '../../ui/MusicBrowser.js';
import audioAnalyzer from '../../audio/AudioAnalyzer.js';
import { getCurrentlyPlayingTrack, getAudioAnalysis, getAudioFeatures } from '../../spotify/spotifyAPI.js';
import '../../ui/volume-control.css';
import '../../ui/music-browser.css';

// Import visualization modules
import { 
  createBarsVisualization, 
  removeBarsVisualization, 
  updateBarsVisualization,
  setupPostprocessing,
  renderWithPostprocessing,
  config as barsConfig
} from '../visualizations/BarsVisualization.js';

// Import other visualizations
import {
  createParticlesVisualization,
  removeParticlesVisualization,
  updateParticlesVisualization
} from '../visualizations/ParticlesVisualization.js';

import {
  createWaveformVisualization,
  removeWaveformVisualization,
  updateWaveformVisualization
} from '../visualizations/WaveformVisualization.js';

// Import utility functions
import { 
  showMessage, 
  showError, 
  waitForSpotifySDK,
  addVisualizationControls,
  isAuthError
} from './VisualizerUtils.js';

// Scene variables
let scene, camera, renderer;

// Visualization state
let visualizationMode = 'bars';
let bars = [];
let particles = [];
let waveform = null;

// Camera animation
let cameraTargetPosition = new THREE.Vector3(0, 0, 30);
let cameraCurrentPosition = new THREE.Vector3(0, 8, 30);

// Spotify and audio state
let player = null;
let accessTokenValue = null;
let currentTrackId = null;
let currentTrackAnalysis = null;
let currentAudioFeatures = null;
let currentTrackData = null;
let musicBrowser = null;
let spotifyDeviceId = null;

// Animation state
let animationTime = 0;
let lastBeatTime = 0;
let beatDetected = false;
let beatIntensity = 0;
let lastUpdateTime = 0;
let pulseFactor = 0;
let pulseTime = 0;
let lastPowerLevel = 0.5;
let isPaused = false;

// Current playback state
let currentPlaybackProgressMs = 0;
let lastPlaybackUpdateTime = 0;

// Audio data from analyzer
let audioData = {
  volume: 0.5,
  bass: 0.5,
  mid: 0.5, 
  treble: 0.5,
  beatDetected: false,
  beatIntensity: 0
};

/**
 * Initialize the visualizer
 * @param {string} accessToken - Spotify access token
 */
export async function initVisualizer(accessToken) {
  // Store access token for later use
  accessTokenValue = accessToken;
  
  // Show the app container to make sure it's visible
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.style.display = 'block';
  }
  
  // Setup Three.js scene
  setupThreeScene();
  
  // Initialize audio analyzer
  await audioAnalyzer.initialize();
  
  // Setup Spotify player
  const playerInitialized = await setupSpotifyPlayer(accessToken);
  
  if (!playerInitialized) {
    // If player failed to initialize, try to refresh token
    const newToken = await refreshAccessToken();
    if (newToken) {
      accessTokenValue = newToken;
      await setupSpotifyPlayer(newToken);
    } else {
      throw new Error('Failed to initialize Spotify player. Authentication may have failed.');
    }
  }
  
  // Add UI for changing visualization modes
  addVisualizationControls(changeVisualizationMode);
  
  // Add volume control
  setupVolumeControl();
  
  // Handle window resizing
  window.addEventListener('resize', onWindowResize);
  
  // Setup audio analyzer callbacks
  setupAudioAnalyzer();
  
  // Start animation loop
  animate();
  
  // Set up polling for current track
  pollCurrentTrack();
}

/**
 * Set up the Three.js scene
 */
function setupThreeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Setup camera with better positioning for the visualization
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 8, 30);
  camera.lookAt(0, 0, 0);

  // Create renderer with better settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  // Add better lighting
  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);
  
  const mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(10, 20, 20);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  scene.add(mainLight);
  
  const backLight = new THREE.DirectionalLight(0x444444, 1);
  backLight.position.set(-10, 10, -10);
  scene.add(backLight);

  // Create initial visualization
  bars = createBarsVisualization(scene);
  
  // Setup postprocessing for better visuals
  setupPostprocessing(renderer, scene, camera);
}

/**
 * Setup audio analyzer callbacks
 */
function setupAudioAnalyzer() {
  // Set up beat detection callback
  audioAnalyzer.onBeat = (beatData) => {
    // Update beat detection state
    beatDetected = true;
    beatIntensity = beatData.intensity;
    lastBeatTime = beatData.time;
    
    // Create pulse effect
    pulseTime = beatData.intensity;
  };
  
  // Set up continuous analysis callback
  audioAnalyzer.onAnalyzed = (data) => {
    // Store latest audio data
    audioData = data;
    
    // Update power level for visualizations
    lastPowerLevel = data.volume;
  };
}

/**
 * Get track audio analysis and features from Spotify API
 * @param {string} trackId - Spotify track ID
 */
async function fetchTrackAnalysis(trackId) {
  try {
    // Get audio analysis and features in parallel
    const [analysisResponse, featuresResponse] = await Promise.all([
      getAudioAnalysis(trackId, accessTokenValue),
      getAudioFeatures(trackId, accessTokenValue)
    ]);
    
    // Store analysis data
    currentTrackAnalysis = analysisResponse;
    currentAudioFeatures = featuresResponse;
    
    // Update audio analyzer with the data
    audioAnalyzer.updateTrackData(currentTrackAnalysis, currentAudioFeatures);
    
    // Update camera position based on audio features
    updateCameraForMood(currentAudioFeatures);
    
    console.log('Track analysis loaded:', trackId);
  } catch (error) {
    console.error('Error fetching track analysis:', error);
    
    // Set default values if analysis fails
    currentAudioFeatures = {
      energy: 0.5,
      tempo: 120,
      valence: 0.5,
      danceability: 0.5,
      acousticness: 0.5,
      instrumentalness: 0.5,
      liveness: 0.5,
      speechiness: 0.5
    };
    
    // Update audio analyzer with default values
    audioAnalyzer.energy = currentAudioFeatures.energy;
    audioAnalyzer.tempo = currentAudioFeatures.tempo;
    audioAnalyzer.danceability = currentAudioFeatures.danceability;
    audioAnalyzer.valence = currentAudioFeatures.valence;
  }
}

/**
 * Set up volume control UI with persistent settings
 */
function setupVolumeControl() {
  if (!player) {
    console.warn('Player not initialized, cannot set up volume control');
    return;
  }

  // Try to load saved volume from localStorage
  let initialVolume = 0.5; // Default to 50%
  try {
    const savedVolume = localStorage.getItem('spotify_visualizer_volume');
    if (savedVolume !== null) {
      initialVolume = parseFloat(savedVolume);
    }
  } catch (e) {
    console.warn('Could not load saved volume:', e);
  }

  // Set initial volume on player
  const scaledInitialVolume = Math.pow(initialVolume, 2); // Apply logarithmic curve
  player.setVolume(scaledInitialVolume).then(() => {
    console.log('Initial volume set successfully:', scaledInitialVolume);
  }).catch(err => {
    console.warn('Could not set initial volume:', err);
  });

  // Create volume control component
  const volumeControl = createVolumeControl((volume) => {
    try {
      player.setVolume(volume);
    } catch (error) {
      console.error('Error setting volume:', error);
      showError('Could not adjust volume. Please try again.');
    }
  }, initialVolume);
  
  // Add to document
  document.body.appendChild(volumeControl.element);
}

/**
 * Main animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now() / 1000; // Current time in seconds
  const deltaTime = currentTime - lastUpdateTime;
  lastUpdateTime = currentTime;
  
  // Update animation time
  animationTime += deltaTime;
  
  // Update playback progress estimate
  if (!isPaused) {
    const estimatedProgressIncrease = deltaTime * 1000; // Convert to ms
    currentPlaybackProgressMs += estimatedProgressIncrease;
    
    // Update the audio analyzer with our estimated progress
    audioAnalyzer.updateProgress(currentPlaybackProgressMs);
  }
  
  // Smoothly move camera towards target position
  cameraCurrentPosition.lerp(cameraTargetPosition, 0.02);
  camera.position.copy(cameraCurrentPosition);
  camera.lookAt(0, 0, 0);
  
  // Update the pulse effect (smooth fade out after a beat)
  if (pulseTime > 0) {
    pulseTime *= 0.95; // Fade out
  }
  
  // Use audio data from analyzer
  let powerLevel = audioData.volume;
  let bassLevel = audioData.bass;
  let midLevel = audioData.mid;
  let trebleLevel = audioData.treble;
  
  // When paused, use minimal values
  if (isPaused) {
    powerLevel = 0.1;
    bassLevel = 0.1;
    midLevel = 0.1;
    trebleLevel = 0.1;
    pulseTime = 0;
  }
  
  // Enhanced audio data for visualizations
  const enhancedAudioData = {
    volume: powerLevel,
    bass: bassLevel,
    mid: midLevel,
    treble: trebleLevel,
    beatDetected: beatDetected,
    beatIntensity: beatIntensity,
    pulseTime: pulseTime
  };

  // Update visualization based on current mode
  switch (visualizationMode) {
    case 'bars':
      updateBarsVisualization(
        bars, 
        powerLevel, 
        pulseTime, 
        isPaused, 
        animationTime, 
        {
          ...currentAudioFeatures,
          ...enhancedAudioData
        }
      );
      break;
    case 'particles':
      updateParticlesVisualization(
        particles, 
        powerLevel, 
        pulseTime, 
        isPaused, 
        animationTime, 
        {
          ...currentAudioFeatures,
          ...enhancedAudioData
        }
      );
      break;
    case 'waveform':
      updateWaveformVisualization(
        waveform, 
        powerLevel, 
        pulseTime, 
        isPaused, 
        animationTime, 
        {
          ...currentAudioFeatures,
          ...enhancedAudioData
        }
      );
      break;
  }

  // Reset beat detection for next frame
  beatDetected = false;

  // Render with postprocessing if available, otherwise use standard render
  renderWithPostprocessing(renderer, scene, camera);
}

/**
 * Poll for the current track and playback state
 */
function pollCurrentTrack() {
  const pollInterval = 1000; // 1 second for more accurate playback position
  
  setInterval(async () => {
    if (!accessTokenValue || !player) return;
    
    try {
      // Get playback state directly from the player
      const state = await player.getCurrentState();
      
      if (state) {
        // Update pause state
        const wasPlaying = !isPaused;
        isPaused = state.paused;
        
        // Update paused state in audio analyzer
        audioAnalyzer.setPaused(isPaused);
        
        // Update current playback position
        currentPlaybackProgressMs = state.position;
        lastPlaybackUpdateTime = performance.now() / 1000;
        
        // Update audio analyzer with current progress
        audioAnalyzer.updateProgress(currentPlaybackProgressMs);
        
        // Update current track data from the player
        if (state.track_window && state.track_window.current_track) {
          const track = state.track_window.current_track;
          
          // If track changed, update info
          if (track.id !== currentTrackId) {
            currentTrackId = track.id;
            
            // Format track data to match the expected structure
            const trackData = {
              item: {
                name: track.name,
                artists: track.artists,
                album: track.album,
                id: track.id
              },
              is_playing: !isPaused
            };
            
            currentTrackData = trackData;
            renderTrackInfo(trackData);
            
            // Reset playback progress
            currentPlaybackProgressMs = state.position;
            lastPlaybackUpdateTime = performance.now() / 1000;
            
            // Fetch track analysis data
            await fetchTrackAnalysis(track.id);
            
            // Show track change message
            showMessage(`Now playing: ${track.name} by ${track.artists[0].name}`);
          }
        }
      } else {
        // No track playing - set to paused
        isPaused = true;
        audioAnalyzer.setPaused(true);
      }
    } catch (error) {
      console.error('Error polling current track:', error);
      
      // If this is an auth error, try to refresh the token
      if (isAuthError(error)) {
        console.log('Authentication error in polling, attempting to refresh token');
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Update the stored token value
          accessTokenValue = newToken;
        }
      }
    }
  }, pollInterval);
}

/**
 * Update camera position based on track mood
 * @param {Object} features - Audio features
 */
function updateCameraForMood(features) {
  if (!features) return;
  
  // Calculate target camera position based on audio features
  const energy = features.energy || 0.5;
  const valence = features.valence || 0.5;
  
  // Higher energy = closer to the visualization
  const zDistance = 40 - (energy * 20);
  
  // Valence (happiness) affects height - happier songs = higher view
  const height = 5 + (valence * 10);
  
  // Set new camera target position
  cameraTargetPosition.set(0, height, zDistance);
}

/**
 * Change the visualization mode
 * @param {string} mode - Visualization mode
 */
function changeVisualizationMode(mode) {
  visualizationMode = mode;
  
  // Clear existing visualizations
  clearVisualizations();
  
  // Create selected visualization
  switch (mode) {
    case 'bars':
      bars = createBarsVisualization(scene);
      break;
    case 'particles':
      particles = createParticlesVisualization(scene);
      break;
    case 'waveform':
      waveform = createWaveformVisualization(scene);
      break;
  }
}

/**
 * Clear all visualizations from the scene
 */
function clearVisualizations() {
  removeBarsVisualization(bars, scene);
  removeParticlesVisualization(particles, scene);
  removeWaveformVisualization(waveform, scene);
  
  bars = [];
  particles = [];
  waveform = null;
}

/**
 * Handle window resize events
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update composer size for postprocessing
  if (typeof setupPostprocessing === 'function') {
    setupPostprocessing(renderer, scene, camera);
  }
}

/**
 * Initialize music browser for direct track selection
 * @param {string} deviceId - The Spotify player device ID
 */
function initializeMusicBrowser(deviceId) {
  if (!player || !accessTokenValue) {
    console.warn('Cannot initialize music browser: player or token not available');
    return null;
  }
  
  try {
    // Create music browser component and pass the device ID
    const browser = createMusicBrowser(player, accessTokenValue, deviceId);
    
    // Add to the DOM
    document.body.appendChild(browser.element);
    
    // Show a welcome message
    showMessage('Tip: Click the Music button in the top right to browse and play tracks', 7000);
    
    return browser;
  } catch (error) {
    console.error('Error initializing music browser:', error);
    return null;
  }
}

/**
 * Set up the Spotify Web Playback SDK
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object|null>} - Spotify player object or null if failed
 */
async function setupSpotifyPlayer(accessToken) {
  try {
    await waitForSpotifySDK();
    
    player = new Spotify.Player({
      name: 'Spotify 3D Visualizer',
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });
  
    // Error handling
    player.addListener('initialization_error', ({ message }) => {
      console.error('Failed to initialize player:', message);
      if (!message.includes('robustness') && !message.includes('404')) {
        showError('Failed to initialize Spotify player. Please try again.');
      }
    });
    
    player.addListener('authentication_error', ({ message }) => {
      console.error('Failed to authenticate:', message);
      showError('Authentication failed. Please reconnect your Spotify account.');
    });
    
    player.addListener('account_error', ({ message }) => {
      console.error('Account error:', message);
      showError('Spotify Premium is required for this visualizer.');
    });
    
    player.addListener('playback_error', ({ message }) => {
      console.error('Playback error:', message);
      // Don't show error if it seems to be a common Spotify API error
      if (!message.includes('404') && !message.includes('403')) {
        showError('Playback error. Please try again or check your connection.');
      }
    });
  
    // Playback status listeners
    player.addListener('ready', async ({ device_id }) => {
      console.log('Player ready with device ID', device_id);
      
      // Store device ID both locally and globally
      spotifyDeviceId = device_id;
      window.spotifyDeviceId = device_id;
      
      // Initialize the music browser with the device ID
      musicBrowser = initializeMusicBrowser(device_id);
      
      // Show welcome message
      showMessage('Spotify visualizer ready! Click the Music button to browse and play tracks.');
    });
  
    // Track change listener
    player.addListener('player_state_changed', async (state) => {
      if (!state) {
        // No state means no active player - set to paused
        isPaused = true;
        audioAnalyzer.setPaused(true);
        return;
      }
      
      // Update pause state
      isPaused = state.paused;
      audioAnalyzer.setPaused(isPaused);
      
      // If no track window or current track, something's wrong
      if (!state.track_window || !state.track_window.current_track) {
        return;
      }
      
      const track = state.track_window.current_track;
      
      // If track changed, update UI
      if (!currentTrackId || track.id !== currentTrackId) {
        currentTrackId = track.id;
        
        // Create track data in the format expected by renderTrackInfo
        const trackData = {
          item: {
            name: track.name,
            artists: [{ name: track.artists[0].name }],
            album: {
              name: track.album.name,
              images: [{ url: track.album.images[0].url }]
            },
            id: track.id
          },
          is_playing: !isPaused
        };
        
        // Store current track data
        currentTrackData = trackData;
        
        renderTrackInfo(trackData);
        
        // Reset playback progress
        currentPlaybackProgressMs = state.position;
        lastPlaybackUpdateTime = performance.now() / 1000;
        
        // Fetch track analysis data
        await fetchTrackAnalysis(track.id);
        
        // Show track change message
        showMessage(`Now playing: ${track.name} by ${track.artists[0].name}`);
      }
      
      // Update current progress
      currentPlaybackProgressMs = state.position;
      
      // If we have a device ID in the state, update it
      if (state.device_id && state.device_id !== spotifyDeviceId) {
        spotifyDeviceId = state.device_id;
        window.spotifyDeviceId = state.device_id;
        
        // Update the music browser if it exists
        if (musicBrowser && typeof musicBrowser.updateDeviceId === 'function') {
          musicBrowser.updateDeviceId(state.device_id);
        }
      }
    });

    // Connect player and handle connection issues
    const connected = await player.connect().catch(error => {
      console.error('Player connection error:', error);
      showError('Failed to connect to Spotify. Please try again.');
      return false;
    });
    
    if (!connected) {
      console.error('Player failed to connect');
      return null;
    }

    return player;
  } catch (error) {
    console.error('Error setting up Spotify player:', error);
    
    // Check if this is an authentication error
    if (error.message && (
      error.message.includes('authentication') || 
      error.message.includes('token') || 
      error.message.includes('Authorization')
    )) {
      // Try to refresh the token
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry with new token
        return setupSpotifyPlayer(newToken);
      } else {
        showError('Authentication failed. Please reconnect your Spotify account.');
      }
    } else {
      showError('Failed to initialize Spotify player. Please try again.');
    }
    
    return null;
  }
}