// src/spotify/spotifyPlayer.js
// Centralized Spotify Player management with event system

import { handleAuthError, refreshAccessToken } from '../auth/handleAuth.js';
import { showMessage, waitForSpotifySDK } from '../three/utils/VisualizerUtils.js';

// Player state
let spotifyPlayer = null;
let deviceId = null;
let accessToken = null;
let isReady = false;
let isPlaying = false;
let currentTrack = null;
let currentPlaybackPosition = 0;

// Event system
const eventListeners = {
  playerStateChanged: [],
  trackChanged: [],
  ready: [],
  error: []
};

/**
 * Initialize the Spotify Web Playback SDK player
 * @param {string} token - Spotify access token
 * @returns {Promise<Object>} - Returns player instance on success
 */
export async function initializePlayer(token) {
  if (!token) {
    throw new Error('Access token is required to initialize player');
  }
  
  // Store token
  accessToken = token;
  
  try {
    // Wait for SDK to load
    await waitForSpotifySDK();
    
    // Create player instance
    spotifyPlayer = new Spotify.Player({
      name: 'Spotify 3D Visualizer',
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });
    
    // Set up event listeners
    setupPlayerEvents();
    
    // Connect player
    const connected = await spotifyPlayer.connect();
    
    if (!connected) {
      throw new Error('Failed to connect to Spotify player');
    }
    
    console.log('Player initialized and connected');
    return spotifyPlayer;
  } catch (error) {
    console.error('Error initializing Spotify player:', error);
    triggerEvent('error', { type: 'initialization', message: error.message || 'Failed to initialize player' });
    throw error;
  }
}

/**
 * Set up player event listeners
 */
function setupPlayerEvents() {
  if (!spotifyPlayer) return;
  
  // Error handling
  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Failed to initialize player:', message);
    triggerEvent('error', { type: 'initialization', message });
  });
  
  spotifyPlayer.addListener('authentication_error', ({ message }) => {
    console.error('Failed to authenticate:', message);
    triggerEvent('error', { type: 'authentication', message });
    
    // Try to refresh token
    refreshAccessToken()
      .then(newToken => {
        if (newToken) {
          accessToken = newToken;
          // Reconnect player
          spotifyPlayer.connect();
        }
      })
      .catch(err => {
        console.error('Token refresh failed:', err);
      });
  });
  
  spotifyPlayer.addListener('account_error', ({ message }) => {
    console.error('Account error:', message);
    triggerEvent('error', { type: 'account', message });
  });
  
  spotifyPlayer.addListener('playback_error', ({ message }) => {
    console.error('Playback error:', message);
    triggerEvent('error', { type: 'playback', message });
  });
  
  // Ready event
  spotifyPlayer.addListener('ready', ({ device_id }) => {
    console.log('Player ready with device ID', device_id);
    isReady = true;
    deviceId = device_id;
    
    // Trigger ready event
    triggerEvent('ready', { deviceId: device_id });
  });
  
  // Player state changed
  spotifyPlayer.addListener('player_state_changed', state => {
    if (!state) {
      isPlaying = false;
      triggerEvent('playerStateChanged', { isPlaying, position: 0 });
      return;
    }
    
    // Update playing state
    isPlaying = !state.paused;
    
    // Update playback position
    currentPlaybackPosition = state.position;
    
    // Check for track change
    if (state.track_window && state.track_window.current_track) {
      const track = state.track_window.current_track;
      
      // If track changed, update and trigger event
      if (!currentTrack || currentTrack.id !== track.id) {
        currentTrack = track;
        triggerEvent('trackChanged', { track });
      }
    }
    
    // Trigger state change event
    triggerEvent('playerStateChanged', { 
      isPlaying, 
      position: state.position,
      track: currentTrack
    });
  });
}

/**
 * Get the Spotify player instance
 * @returns {Object|null} - Player instance or null if not initialized
 */
export function getPlayer() {
  return spotifyPlayer;
}

/**
 * Get the current device ID
 * @returns {string|null} - Device ID or null if not ready
 */
export function getDeviceId() {
  return deviceId;
}

/**
 * Check if player is ready
 * @returns {boolean} - True if player is ready
 */
export function isPlayerReady() {
  return isReady;
}

/**
 * Get current playing state
 * @returns {boolean} - True if currently playing
 */
export function getIsPlaying() {
  return isPlaying;
}

/**
 * Get current track
 * @returns {Object|null} - Current track data or null
 */
export function getCurrentTrack() {
  return currentTrack;
}

/**
 * Get current playback position
 * @returns {number} - Current position in milliseconds
 */
export function getPlaybackPosition() {
  return currentPlaybackPosition;
}

/**
 * Set the access token (for refreshes)
 * @param {string} token - New access token
 */
export function setAccessToken(token) {
  accessToken = token;
}

/**
 * Toggle play/pause
 * @returns {Promise<void>}
 */
export async function togglePlayPause() {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  try {
    if (isPlaying) {
      await spotifyPlayer.pause();
    } else {
      await spotifyPlayer.resume();
    }
    
    // State will be updated via player_state_changed event
    return true;
  } catch (error) {
    console.error('Error toggling playback:', error);
    triggerEvent('error', { type: 'playback', message: 'Failed to toggle playback' });
    throw error;
  }
}

/**
 * Skip to next track
 * @returns {Promise<void>}
 */
export async function skipToNext() {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  try {
    await spotifyPlayer.nextTrack();
    // State will be updated via player_state_changed event
    return true;
  } catch (error) {
    console.error('Error skipping to next track:', error);
    triggerEvent('error', { type: 'playback', message: 'Failed to skip to next track' });
    throw error;
  }
}

/**
 * Skip to previous track
 * @returns {Promise<void>}
 */
export async function skipToPrevious() {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  try {
    await spotifyPlayer.previousTrack();
    // State will be updated via player_state_changed event
    return true;
  } catch (error) {
    console.error('Error skipping to previous track:', error);
    triggerEvent('error', { type: 'playback', message: 'Failed to skip to previous track' });
    throw error;
  }
}

/**
 * Set volume (0-1)
 * @param {number} volume - Volume level (0-1)
 * @returns {Promise<void>}
 */
export async function setVolume(volume) {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  if (volume < 0 || volume > 1) {
    throw new Error('Volume must be between 0 and 1');
  }
  
  try {
    await spotifyPlayer.setVolume(volume);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('spotify_visualizer_volume', volume.toString());
    } catch (e) {
      console.warn('Could not save volume to localStorage:', e);
    }
    
    return true;
  } catch (error) {
    console.error('Error setting volume:', error);
    triggerEvent('error', { type: 'playback', message: 'Failed to set volume' });
    throw error;
  }
}

/**
 * Play a specific track
 * @param {string} uri - Spotify URI for the track
 * @returns {Promise<void>}
 */
export async function playTrack(uri) {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  if (!deviceId) {
    throw new Error('Device ID not available');
  }
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        uris: [uri]
      })
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No active device found. Make sure the player is ready.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Token may have expired.');
      } else {
        throw new Error(`Failed to play track: ${response.status}`);
      }
    }
    
    // State will be updated via player_state_changed event
    return true;
  } catch (error) {
    console.error('Error playing track:', error);
    
    // If it's an auth error, try to refresh token
    if (error.message?.includes('Authentication') || error.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          accessToken = newToken;
          // Retry playing track with new token
          return playTrack(uri);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }
    
    triggerEvent('error', { type: 'playback', message: 'Failed to play track' });
    throw error;
  }
}

/**
 * Play tracks from an album
 * @param {string} albumUri - Spotify URI for the album
 * @returns {Promise<void>}
 */
export async function playAlbum(albumUri) {
  if (!spotifyPlayer) {
    throw new Error('Player not initialized');
  }
  
  if (!deviceId) {
    throw new Error('Device ID not available');
  }
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        context_uri: albumUri
      })
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No active device found. Make sure the player is ready.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Token may have expired.');
      } else {
        throw new Error(`Failed to play album: ${response.status}`);
      }
    }
    
    // State will be updated via player_state_changed event
    return true;
  } catch (error) {
    console.error('Error playing album:', error);
    triggerEvent('error', { type: 'playback', message: 'Failed to play album' });
    throw error;
  }
}

/**
 * Add event listener
 * @param {string} event - Event type
 * @param {Function} callback - Callback function
 */
export function addEventListener(event, callback) {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  
  eventListeners[event].push(callback);
}

/**
 * Remove event listener
 * @param {string} event - Event type
 * @param {Function} callback - Callback function to remove
 */
export function removeEventListener(event, callback) {
  if (!eventListeners[event]) return;
  
  const index = eventListeners[event].indexOf(callback);
  if (index !== -1) {
    eventListeners[event].splice(index, 1);
  }
}

/**
 * Trigger an event
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function triggerEvent(event, data) {
  if (!eventListeners[event]) return;
  
  for (const callback of eventListeners[event]) {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in ${event} event listener:`, error);
    }
  }
}

/**
 * Clean up player resources
 */
export function cleanupPlayer() {
  if (spotifyPlayer) {
    // Disconnect player
    spotifyPlayer.disconnect();
    
    // Remove all event listeners
    Object.keys(eventListeners).forEach(event => {
      eventListeners[event] = [];
    });
    
    // Reset state
    spotifyPlayer = null;
    deviceId = null;
    isReady = false;
    isPlaying = false;
    currentTrack = null;
    currentPlaybackPosition = 0;
  }
}