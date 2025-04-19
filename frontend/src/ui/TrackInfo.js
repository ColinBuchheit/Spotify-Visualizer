// src/ui/TrackInfo.js
// Track information display component using centralized state management

import { 
  togglePlayPause, 
  skipToNext, 
  skipToPrevious, 
  getIsPlaying,
  getCurrentTrack,
  addEventListener,
  removeEventListener
} from '../spotify/spotifyPlayer.js';

// Tracking event listeners
let stateChangeListener = null;
let trackChangeListener = null;
let errorListener = null;

/**
 * Render track information and playback controls
 * @param {Object} trackData - Track data from Spotify API
 */
export function renderTrackInfo(trackData) {
  // Remove existing track info if present
  const existingInfo = document.getElementById('track-info');
  if (existingInfo) {
    existingInfo.remove();
  }

  // Extract track information
  const name = trackData.item?.name || 'Unknown Track';
  const artist = trackData.item?.artists?.[0]?.name || 'Unknown Artist';
  const album = trackData.item?.album?.name || 'Unknown Album';
  const albumImage = trackData.item?.album?.images?.[0]?.url || '';
  const trackId = trackData.item?.id || '';
  
  // Get playing state
  const isPlaying = trackData.is_playing !== undefined ? 
    trackData.is_playing : getIsPlaying();
  
  // Create the container
  const container = document.createElement('div');
  container.id = 'track-info';

  // Create HTML content
  container.innerHTML = `
    <div class="track-container">
      <img src="${albumImage}" alt="Album Cover for ${name}">
      <div class="text">
        <div class="title">${name}</div>
        <div class="artist">${artist}</div>
        <div class="album">${album}</div>
      </div>
    </div>
    <div class="playback-controls">
      <button class="control-button previous" aria-label="Previous Track">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="19 20 9 12 19 4 19 20"></polygon>
          <line x1="5" y1="4" x2="5" y2="20"></line>
        </svg>
      </button>
      <button class="control-button play-pause" aria-label="${isPlaying ? 'Pause' : 'Play'}">
        ${isPlaying ? getPauseIcon() : getPlayIcon()}
      </button>
      <button class="control-button next" aria-label="Next Track">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="4" x2="19" y2="20"></line>
        </svg>
      </button>
    </div>
  `;
  
  // Add to the DOM
  document.body.appendChild(container);
  
  // Setup event listeners
  setupControlEvents(container);
  
  // Setup player state listeners
  setupPlayerStateListeners(container);
  
  // Animate entrance
  setTimeout(() => {
    container.style.opacity = 1;
    container.style.transform = 'translateY(0)';
  }, 10);
}

/**
 * Set up event listeners for playback control buttons
 */
function setupControlEvents(container) {
  // Play/Pause button
  const playPauseButton = container.querySelector('.control-button.play-pause');
  if (playPauseButton) {
    playPauseButton.addEventListener('click', async () => {
      console.log('Play/pause button clicked');
      
      // Visual feedback
      playPauseButton.classList.add('control-active');
      setTimeout(() => {
        playPauseButton.classList.remove('control-active');
      }, 200);
      
      try {
        await togglePlayPause();
        // State will be updated via event listener
      } catch (error) {
        console.error('Error toggling playback:', error);
        showPlaybackError('Could not control playback. Try again.');
      }
    });
  }
  
  // Previous track button
  const prevButton = container.querySelector('.control-button.previous');
  if (prevButton) {
    prevButton.addEventListener('click', async () => {
      console.log('Previous button clicked');
      
      // Visual feedback
      prevButton.classList.add('control-active');
      setTimeout(() => {
        prevButton.classList.remove('control-active');
      }, 200);
      
      try {
        await skipToPrevious();
        // State will be updated via event listener
      } catch (error) {
        console.error('Error playing previous track:', error);
        showPlaybackError('Could not play previous track. Try again.');
      }
    });
  }
  
  // Next track button
  const nextButton = container.querySelector('.control-button.next');
  if (nextButton) {
    nextButton.addEventListener('click', async () => {
      console.log('Next button clicked');
      
      // Visual feedback
      nextButton.classList.add('control-active');
      setTimeout(() => {
        nextButton.classList.remove('control-active');
      }, 200);
      
      try {
        await skipToNext();
        // State will be updated via event listener
      } catch (error) {
        console.error('Error playing next track:', error);
        showPlaybackError('Could not play next track. Try again.');
      }
    });
  }
}

/**
 * Set up listeners for player state changes
 */
function setupPlayerStateListeners(container) {
  // Clean up any existing listeners
  if (stateChangeListener) {
    removeEventListener('playerStateChanged', stateChangeListener);
  }
  
  if (trackChangeListener) {
    removeEventListener('trackChanged', trackChangeListener);
  }
  
  if (errorListener) {
    removeEventListener('error', errorListener);
  }
  
  // Listen for player state changes (play/pause)
  stateChangeListener = (data) => {
    updatePlayPauseButton(container, data.isPlaying);
  };
  addEventListener('playerStateChanged', stateChangeListener);
  
  // Listen for track changes
  trackChangeListener = (data) => {
    if (data.track) {
      // If this container is still in the DOM, update the track info
      if (document.body.contains(container)) {
        // Format track data to match the expected structure
        const trackData = {
          item: {
            name: data.track.name,
            artists: data.track.artists,
            album: data.track.album,
            id: data.track.id
          },
          is_playing: getIsPlaying()
        };
        
        // Create a new track info display
        renderTrackInfo(trackData);
      }
    }
  };
  addEventListener('trackChanged', trackChangeListener);
  
  // Listen for errors
  errorListener = (error) => {
    if (error.type === 'playback') {
      showPlaybackError(error.message || 'Playback error occurred');
    }
  };
  addEventListener('error', errorListener);
}

/**
 * Update the play/pause button UI based on playback state
 */
function updatePlayPauseButton(container, isPlaying) {
  const button = container.querySelector('.control-button.play-pause');
  if (button) {
    button.innerHTML = isPlaying ? getPauseIcon() : getPlayIcon();
    button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showPlaybackError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'message-notification';
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  // Show message
  setTimeout(() => {
    errorDiv.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    errorDiv.classList.remove('show');
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 300);
  }, 5000);
}

/**
 * Get play icon SVG
 * @returns {string} - SVG HTML for play icon
 */
function getPlayIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  `;
}

/**
 * Get pause icon SVG
 * @returns {string} - SVG HTML for pause icon
 */
function getPauseIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
  `;
}

/**
 * Clean up event listeners
 */
export function cleanupTrackInfo() {
  if (stateChangeListener) {
    removeEventListener('playerStateChanged', stateChangeListener);
    stateChangeListener = null;
  }
  
  if (trackChangeListener) {
    removeEventListener('trackChanged', trackChangeListener);
    trackChangeListener = null;
  }
  
  if (errorListener) {
    removeEventListener('error', errorListener);
    errorListener = null;
  }
}