// src/three/utils/VisualizerUtils.js
// Utility functions for the audio visualizer with improved authentication handling

import { createErrorOverlay as createErrorUI, showMessage as showMessageUI, showReauthPrompt } from '../../ui/ErrorOverlay.js';
import { refreshAccessToken, redirectToLogin, clearTokens } from '../../auth/handleAuth.js';

/**
 * Detect beats in the audio based on Spotify analysis data
 * @param {number} time - Current animation time
 * @param {Array} beats - Beats data from Spotify analysis
 * @param {number} lastBeatTime - Time of last detected beat
 * @param {number} currentTempo - Current track tempo (BPM)
 * @param {number} energy - Track energy value (0-1)
 * @param {boolean} isPaused - Whether playback is paused
 * @returns {Object} - Beat detection results
 */
export function detectBeats(time, beats, lastBeatTime, currentTempo, energy, isPaused) {
    // Default result
    const result = {
      beatDetected: false,
      beatIntensity: 0,
      lastBeatTime: lastBeatTime
    };
    
    // If paused, don't detect beats
    if (isPaused) {
      return result;
    }
    
    // Use actual beat data from Spotify analysis if available
    if (beats && beats.length > 0) {
      // Convert seconds to milliseconds for comparison
      const currentTimeMs = time * 1000;
      
      // Look for beats within a small window of the current time
      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        // Convert beat time to milliseconds and add offset
        const beatStart = beat.start * 1000;
        const beatDuration = beat.duration * 1000;
        
        if (Math.abs(currentTimeMs - beatStart) < 100) { // 100ms window
          // Beat detected!
          const confidence = beat.confidence || 0.5;
          
          // Only count as beat if confidence is high enough
          if (confidence > 0.5) {
            result.beatDetected = true;
            result.beatIntensity = confidence;
            result.lastBeatTime = time;
            return result;
          }
        }
      }
    }
    
    // If we don't have beats data or no beat was found, use a timer based on tempo
    const tempoInterval = 60 / currentTempo; // Beat interval in seconds
    
    if (time - lastBeatTime > tempoInterval && energy > 0.3) {
      result.lastBeatTime = time;
      result.beatDetected = true;
      result.beatIntensity = energy;
      return result;
    }
    
    // Reset beat detection
    if (time - lastBeatTime > 0.1) {
      result.beatDetected = false;
    }
    
    return result;
  }
  
  /**
   * Get current music power level based on audio analysis
   * @param {number} time - Current animation time
   * @param {Array} segments - Segments data from Spotify analysis
   * @param {number} lastPowerLevel - Previous power level
   * @param {number} energy - Track energy value (0-1)
   * @param {boolean} isPaused - Whether playback is paused
   * @returns {number} - Current power level (0-1)
   */
  export function getCurrentMusicPower(time, segments, lastPowerLevel, energy, isPaused) {
    // If paused, return a very low power level
    if (isPaused) {
      return 0.1; // Just enough to see something, but minimal movement
    }
    
    // Use audio analysis segments to get loudness data
    if (segments && segments.length > 0) {
      // Find current segment
      const segmentTimeMs = time * 1000;
      let foundSegment = null;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentStart = segment.start * 1000;
        const segmentEnd = segmentStart + (segment.duration * 1000);
        
        if (segmentTimeMs >= segmentStart && segmentTimeMs < segmentEnd) {
          foundSegment = segment;
          break;
        }
      }
      
      if (foundSegment) {
        // Loudness is in negative dB, so convert to 0-1 range
        // Typical range is -60 (quiet) to 0 (loud)
        const loudness = foundSegment.loudness_max || foundSegment.loudness_start || -20;
        const normalizedLoudness = Math.min(1, Math.max(0, (loudness + 60) / 60));
        
        // Smooth the loudness changes
        return lastPowerLevel * 0.7 + normalizedLoudness * 0.3;
      }
    }
    
    // Fallback: use energy value with pulsing effect
    if (isPaused) {
      return 0.1; // Minimal movement when paused
    }
    
    const pulsing = Math.sin(time * 4) * 0.2 + 0.8;
    return energy * pulsing;
  }
  
/**
 * Create error overlay - for backward compatibility
 * @returns {Object} - Error overlay object with show/hide methods
 */
export function createErrorOverlay() {
  return createErrorUI();
}
  
/**
 * Wait for Spotify SDK to load
 * @returns {Promise} - Resolves when SDK is ready
 */
export function waitForSpotifySDK() {
  return new Promise((resolve, reject) => {
    // Set timeout for SDK loading
    const timeout = setTimeout(() => {
      reject(new Error('Spotify SDK loading timed out after 10 seconds'));
    }, 10000);
    
    // If SDK is already loaded, resolve immediately
    if (window.Spotify) {
      clearTimeout(timeout);
      resolve();
      return;
    }
    
    // Otherwise, setup callback for when SDK loads
    window.spotifySDKCallback = () => {
      clearTimeout(timeout);
      resolve();
    };
    
    // Also use the Spotify callback mechanism
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timeout);
      if (window.spotifySDKCallback) {
        window.spotifySDKCallback();
      }
      resolve();
    };
  });
}

/**
 * Check if an error is an authentication error
 * @param {Error} error - Error object
 * @returns {boolean} - True if this is an auth error
 */
export function isAuthError(error) {
  if (!error) return false;
  
  // Check response status
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    return true;
  }
  
  // Check error message
  const errorMessage = error.message || '';
  return errorMessage.includes('authentication') || 
         errorMessage.includes('token') ||
         errorMessage.includes('authorization') ||
         errorMessage.includes('auth') ||
         errorMessage.includes('expired') ||
         errorMessage.includes('permissions');
}

/**
 * Handle authentication error with appropriate actions
 * @param {Error} error - Error object
 * @returns {Promise<boolean>} - Whether the error was handled
 */
export async function handleAuthError(error) {
  if (!isAuthError(error)) {
    return false;
  }
  
  console.log('Handling authentication error:', error.message || error);
  
  // Try to refresh the token first
  try {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      console.log('Token refreshed successfully');
      return true;
    }
  } catch (refreshError) {
    console.error('Error refreshing token:', refreshError);
  }
  
  // If refresh fails, show re-auth prompt
  showAuthError('Authentication error. Please re-authenticate with Spotify.');
  return true;
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
export function showError(message) {
  const errorOverlay = document.getElementById('error-overlay') || createErrorOverlay();
  
  // Check if this is an authentication error
  if (message.includes('Authentication failed') || 
      message.includes('access token') ||
      message.includes('token expired') ||
      message.includes('authorization') ||
      message.includes('403') ||
      message.includes('permissions')) {
    // Show re-authentication prompt for auth errors
    showAuthError(message);
    return;
  }
  
  // For non-auth errors, use the standard error display
  errorOverlay.show(message);
}

/**
 * Show authentication error with re-auth prompt
 * @param {string} message - Error message
 */
export function showAuthError(message) {
  const overlay = showReauthPrompt();
  
  // Add event listener to re-auth button if not already added
  const reAuthButton = document.getElementById('reauth-button');
  if (reAuthButton && !reAuthButton.hasEventListener) {
    reAuthButton.addEventListener('click', () => {
      // Clear tokens and redirect to login
      clearTokens();
      redirectToLogin();
    });
    reAuthButton.hasEventListener = true;
  }
  
  // Add event listener to cancel button if not already added
  const cancelButton = document.getElementById('reauth-cancel');
  if (cancelButton && !cancelButton.hasEventListener) {
    cancelButton.addEventListener('click', () => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    cancelButton.hasEventListener = true;
  }
}

/**
 * Show message notification 
 * @param {string} message - Message to display
 * @param {number} timeout - Optional timeout in ms
 */
export function showMessage(message, timeout = 5000) {
  showMessageUI(message, timeout);
}

/**
 * Add visualization controls to the UI
 * @param {Function} onModeChange - Callback when mode changes
 */
export function addVisualizationControls(onModeChange) {
  // Remove existing controls if present
  const existingControls = document.getElementById('visualization-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create new controls
  const controls = document.createElement('div');
  controls.id = 'visualization-controls';
  controls.innerHTML = `
    <div class="viz-buttons">
      <button class="viz-button active" data-mode="bars">Bars</button>
      <button class="viz-button" data-mode="particles">Particles</button>
      <button class="viz-button" data-mode="waveform">Waveform</button>
    </div>
  `;
  
  document.body.appendChild(controls);
  
  // Add event listeners
  document.querySelectorAll('.viz-button').forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.viz-button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      
      // Change visualization mode
      if (onModeChange) {
        onModeChange(button.dataset.mode);
      }
    });
  });
  
  return controls;
}