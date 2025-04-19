// src/three/utils/Visualizer.js
// Main controller for the 3D audio visualizer with enhanced visualization features and centralized state management

import * as THREE from 'three';
import { renderTrackInfo } from '../../ui/TrackInfo.js';
import { createVolumeControl } from '../../ui/VolumeControl.js';
import { createMusicBrowser } from '../../ui/MusicBrowser.js';
import audioAnalyzer from '../../audio/AudioAnalyzer.js';
import { getCurrentlyPlayingTrack, getAudioAnalysis, getAudioFeatures } from '../../spotify/spotifyAPI.js';
import { 
  initializePlayer, 
  getPlayer, 
  getIsPlaying, 
  addEventListener, 
  removeEventListener,
  setAccessToken,
  getDeviceId
} from '../../spotify/spotifyPlayer.js';
import { refreshAccessToken } from '../../auth/handleAuth.js';
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
let accessTokenValue = null;
let currentTrackId = null;
let currentTrackAnalysis = null;
let currentAudioFeatures = null;
let currentTrackData = null;
let musicBrowser = null;

// Animation state
let animationTime = 0;
let lastBeatTime = 0;
let beatDetected = false;
let beatIntensity = 0;
let lastUpdateTime = 0;
let pulseFactor = 0;
let pulseTime = 0;
let lastPowerLevel = 0.5;
let isPaused = true; // Start paused until we know player state

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

// Clean up event listeners on shutdown
let eventListeners = [];

/**
 * Initialize the visualizer
 * @param {string} accessToken - Spotify access token
 */
export async function initVisualizer(accessToken) {
  // Store access token for later use
  accessTokenValue = accessToken;
  setAccessToken(accessToken);
  
  // Show the app container to make sure it's visible
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.style.display = 'block';
  }
  
  // Setup Three.js scene
  setupThreeScene();
  
  // Initialize audio analyzer
  await audioAnalyzer.initialize();
  
  // Setup Spotify player with centralized state management
  try {
    await initializePlayer(accessToken);
    
    // Register for player events
    registerEventListeners();
    
    // Setup complete, show success message
    showMessage('Spotify visualizer ready! Loading your music...');
  } catch (error) {
    console.error('Error initializing player:', error);
    
    // Try to refresh token if this was an auth error
    if (isAuthError(error)) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        accessTokenValue = newToken;
        setAccessToken(newToken);
        await initializePlayer(newToken);
        registerEventListeners();
      } else {
        throw new Error('Authentication failed. Please reconnect your Spotify account.');
      }
    } else {
      throw error;
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
  
  // Create music browser once we have a device ID
  setTimeout(() => {
    if (getDeviceId()) {
      musicBrowser = createMusicBrowser(accessTokenValue);
    } else {
      // Retry after a delay if device ID isn't ready yet
      setTimeout(() => {
        if (getDeviceId()) {
          musicBrowser = createMusicBrowser(accessTokenValue);
        }
      }, 3000);
    }
  }, 1000);
}

/**
 * Register event listeners for player state changes
 */
function registerEventListeners() {
  // Listen for player state changes
  const stateChangeListener = (data) => {
    // Update global paused state
    isPaused = !data.isPlaying;
    audioAnalyzer.setPaused(isPaused);
    
    // Update current track info if track has changed
    if (data.track && (!currentTrackId || data.track.id !== currentTrackId)) {
      handleTrackChange(data.track);
    }
    
    // Update playback position
    if (data.position !== undefined) {
      currentPlaybackProgressMs = data.position;
      lastPlaybackUpdateTime = performance.now() / 1000;
      audioAnalyzer.updateProgress(currentPlaybackProgressMs);
    }
  };
  addEventListener('playerStateChanged', stateChangeListener);
  eventListeners.push(['playerStateChanged', stateChangeListener]);
  
  // Listen for track changes
  const trackChangeListener = (data) => {
    if (data.track && (!currentTrackId || data.track.id !== currentTrackId)) {
      handleTrackChange(data.track);
    }
  };
  addEventListener('trackChanged', trackChangeListener);
  eventListeners.push(['trackChanged', trackChangeListener]);
  
  // Listen for player ready event
  const readyListener = (data) => {
    if (data.deviceId) {
      // Once we have a device ID, initialize the music browser
      if (!musicBrowser && accessTokenValue) {
        musicBrowser = createMusicBrowser(accessTokenValue);
      }
      
      // Show welcome message
      showMessage('Spotify visualizer ready! Click the Music button to browse and play tracks.');
    }
  };
  addEventListener('ready', readyListener);
  eventListeners.push(['ready', readyListener]);
  
  // Listen for errors
  const errorListener = (error) => {
    console.error('Player error:', error);
    
    if (isAuthError(error)) {
      refreshAccessToken()
        .then(newToken => {
          if (newToken) {
            accessTokenValue = newToken;
            setAccessToken(newToken);
            // Refresh the page to reinitialize everything
            window.location.reload();
          }
        })
        .catch(err => {
          console.error('Failed to refresh token:', err);
          showError('Authentication failed. Please reconnect your Spotify account.');
        });
    } else {
      // For non-auth errors, just show a message
      showError(error.message || 'An error occurred with playback.');
    }
  };
  addEventListener('error', errorListener);
  eventListeners.push(['error', errorListener]);
}

/**
 * Handle track change event
 * @param {Object} track - New track data
 */
async function handleTrackChange(track) {
  // Update current track ID
  currentTrackId = track.id;
  
  // Format track data to match the expected structure for renderTrackInfo
  const trackData = {
    item: {
      name: track.name,
      artists: track.artists,
      album: track.album,
      id: track.id
    },
    is_playing: !isPaused
  };
  
  // Update current track data
  currentTrackData = trackData;
  
  // Update track info display
  renderTrackInfo(trackData);
  
  // Reset playback progress
  currentPlaybackProgressMs = 0;
  lastPlaybackUpdateTime = performance.now() / 1000;
  
  // Fetch track analysis data
  await fetchTrackAnalysis(track.id);
  
  // Show track change message
  showMessage(`Now playing: ${track.name} by ${track.artists[0].name}`);
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

  // Create volume control component
  const volumeControl = createVolumeControl(async (volume) => {
    try {
      // Use the centralized function from spotifyPlayer.js to set volume
      const player = getPlayer();
      if (player) {
        // Log the volume change attempt for debugging
        console.log(`Setting volume to ${volume}`);
        
        // Set volume on the player directly
        await player.setVolume(volume);
        
        // Save volume to localStorage for persistence
        localStorage.setItem('spotify_visualizer_volume', volume.toString());
        
        // Show a brief message to confirm volume change
        showMessage(`Volume: ${Math.round(volume * 100)}%`, 1000);
      } else {
        console.warn('Player not available for volume change');
        showError('Could not adjust volume. Player not ready.');
      }
    } catch (error) {
      console.error('Error setting volume:', error);
      showError('Could not adjust volume. Please try again.');
    }
  }, initialVolume);
  
  // Add to document
  document.body.appendChild(volumeControl.element);
  
  // Set initial volume on player when it becomes ready
  addEventListener('ready', async (data) => {
    try {
      const player = getPlayer();
      if (player) {
        await player.setVolume(initialVolume);
        console.log(`Initial volume set to ${initialVolume}`);
      }
    } catch (error) {
      console.error('Error setting initial volume:', error);
    }
  });
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
 * (Backup to the event-based state management)
 */
function pollCurrentTrack() {
  const pollInterval = 5000; // 5 seconds - longer interval since we use events now
  
  const intervalId = setInterval(async () => {
    if (!accessTokenValue) return;
    
    try {
      // Get current player from centralized state
      const player = getPlayer();
      
      // If no player is available, skip this poll
      if (!player) return;
      
      // Get playback state directly from the player
      const state = await player.getCurrentState();
      
      // If we have a state, update our tracking
      if (state) {
        // Update pause state
        isPaused = state.paused;
        audioAnalyzer.setPaused(isPaused);
        
        // Update current playback position
        currentPlaybackProgressMs = state.position;
        lastPlaybackUpdateTime = performance.now() / 1000;
        
        // Update audio analyzer with current progress
        audioAnalyzer.updateProgress(currentPlaybackProgressMs);
        
        // Update current track data from the player
        if (state.track_window && state.track_window.current_track && 
            state.track_window.current_track.id !== currentTrackId) {
          // Handle track change
          handleTrackChange(state.track_window.current_track);
        }
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
          setAccessToken(newToken);
        }
      }
    }
  }, pollInterval);
  
  // Store interval ID for cleanup
  window.visualizerPollInterval = intervalId;
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
 * Clean up resources when shutting down
 */
export function cleanup() {
  // Remove interval
  if (window.visualizerPollInterval) {
    clearInterval(window.visualizerPollInterval);
  }
  
  // Remove event listeners
  eventListeners.forEach(([event, listener]) => {
    removeEventListener(event, listener);
  });
  
  // Clean up music browser if it exists
  if (musicBrowser && typeof musicBrowser.dispose === 'function') {
    musicBrowser.dispose();
  }
  
  // Clean up THREE.js resources
  if (renderer) {
    renderer.dispose();
  }
  
  // Remove window resize listener
  window.removeEventListener('resize', onWindowResize);
}