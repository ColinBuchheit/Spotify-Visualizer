// src/ui/TrackInfo.js
// Fixed version with properly working playback controls

import { togglePlayPause, skipToNext, skipToPrevious, getPlayer } from '../spotify/spotifyPlayer.js';

let lastTrackId = null;
let isPlaying = true;
let accessToken = null;

/**
 * Render track information and playback controls
 * @param {Object} trackData - Track data from Spotify API
 */
export function renderTrackInfo(trackData) {
  // Store access token if not already stored
  if (!accessToken) {
    accessToken = localStorage.getItem('spotify_access_token');
  }

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
  
  // Update play state if available
  if (trackData.is_playing !== undefined) {
    isPlaying = trackData.is_playing;
  }
  
  // Update last track ID
  lastTrackId = trackId;
  
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
  
  // Add event listeners for controls
  setupControlEvents();
  
  // Animate entrance
  setTimeout(() => {
    container.style.opacity = 1;
    container.style.transform = 'translateY(0)';
  }, 10);
}

/**
 * Check if the Spotify player is ready
 * @returns {boolean} - Player readiness state
 */
function isPlayerReady() {
  const player = getPlayer();
  return player !== null;
}

/**
 * Set up event listeners for playback control buttons
 */
function setupControlEvents() {
  // Play/Pause button
  const playPauseButton = document.querySelector('.control-button.play-pause');
  if (playPauseButton) {
    // Make sure we remove any existing event listeners first by cloning the button
    const newPlayPauseButton = playPauseButton.cloneNode(true);
    playPauseButton.parentNode.replaceChild(newPlayPauseButton, playPauseButton);
    
    newPlayPauseButton.addEventListener('click', () => {
      console.log('Play/pause button clicked');
      togglePlayback();
    });
  }
  
  // Previous track button
  const prevButton = document.querySelector('.control-button.previous');
  if (prevButton) {
    // Make sure we remove any existing event listeners first by cloning the button
    const newPrevButton = prevButton.cloneNode(true);
    prevButton.parentNode.replaceChild(newPrevButton, prevButton);
    
    newPrevButton.addEventListener('click', () => {
      console.log('Previous button clicked');
      playPreviousTrack();
    });
  }
  
  // Next track button
  const nextButton = document.querySelector('.control-button.next');
  if (nextButton) {
    // Make sure we remove any existing event listeners first by cloning the button
    const newNextButton = nextButton.cloneNode(true);
    nextButton.parentNode.replaceChild(newNextButton, nextButton);
    
    newNextButton.addEventListener('click', () => {
      console.log('Next button clicked');
      playNextTrack();
    });
  }
}

/**
 * Update the play/pause button UI based on playback state
 */
function updatePlayPauseButton() {
  const button = document.querySelector('.control-button.play-pause');
  if (button) {
    button.innerHTML = isPlaying ? getPauseIcon() : getPlayIcon();
    button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }
}

/**
 * Toggle playback (play/pause)
 */
async function togglePlayback() {
  try {
    console.log('Toggle playback called, current state:', isPlaying ? 'playing' : 'paused');
    
    // First, check if player is ready
    if (!isPlayerReady()) {
      console.warn('Player not ready yet, showing error message');
      showPlaybackError('Playback controls not ready yet. Please wait a moment and try again.');
      return;
    }
    
    // Give visual feedback for clicks
    const button = document.querySelector('.control-button.play-pause');
    if (button) {
      button.classList.add('control-active');
      setTimeout(() => {
        button.classList.remove('control-active');
      }, 200);
    }
    
    // First, update UI to be responsive
    isPlaying = !isPlaying;
    updatePlayPauseButton();
    
    // Then call the player SDK function 
    await togglePlayPause();
  } catch (error) {
    console.error('Error toggling playback:', error);
    // Revert UI if there was an error
    isPlaying = !isPlaying;
    updatePlayPauseButton();
    showPlaybackError('Could not control playback. Try again or refresh the page.');
  }
}

/**
 * Play next track
 */
async function playNextTrack() {
  try {
    console.log('Next track called');
    
    // First, check if player is ready
    if (!isPlayerReady()) {
      console.warn('Player not ready yet, showing error message');
      showPlaybackError('Playback controls not ready yet. Please wait a moment and try again.');
      return;
    }
    
    // Give visual feedback for clicks
    const button = document.querySelector('.control-button.next');
    if (button) {
      button.classList.add('control-active');
      setTimeout(() => {
        button.classList.remove('control-active');
      }, 200);
    }
    
    // Call the player SDK function
    await skipToNext();
    
    // Assume we're playing after skipping
    isPlaying = true;
    updatePlayPauseButton();
  } catch (error) {
    console.error('Error playing next track:', error);
    showPlaybackError('Could not play next track. Try again or refresh the page.');
  }
}

/**
 * Play previous track
 */
async function playPreviousTrack() {
  try {
    console.log('Previous track called');
    
    // First, check if player is ready
    if (!isPlayerReady()) {
      console.warn('Player not ready yet, showing error message');
      showPlaybackError('Playback controls not ready yet. Please wait a moment and try again.');
      return;
    }
    
    // Give visual feedback for clicks
    const button = document.querySelector('.control-button.previous');
    if (button) {
      button.classList.add('control-active');
      setTimeout(() => {
        button.classList.remove('control-active');
      }, 200);
    }
    
    // Call the player SDK function
    await skipToPrevious();
    
    // Assume we're playing after going to previous
    isPlaying = true;
    updatePlayPauseButton();
  } catch (error) {
    console.error('Error playing previous track:', error);
    showPlaybackError('Could not play previous track. Try again or refresh the page.');
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