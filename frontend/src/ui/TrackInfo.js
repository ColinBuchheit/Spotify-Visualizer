// src/ui/TrackInfo.js
import { togglePlayPause, skipToNext, skipToPrevious } from '../spotify/spotifyPlayer.js';

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
 * Set up event listeners for playback control buttons
 */
function setupControlEvents() {
  // Play/Pause button
  const playPauseButton = document.querySelector('.control-button.play-pause');
  if (playPauseButton) {
    playPauseButton.addEventListener('click', () => {
      togglePlayback();
    });
  }
  
  // Previous track button
  const prevButton = document.querySelector('.control-button.previous');
  if (prevButton) {
    prevButton.addEventListener('click', () => {
      playPreviousTrack();
    });
  }
  
  // Next track button
  const nextButton = document.querySelector('.control-button.next');
  if (nextButton) {
    nextButton.addEventListener('click', () => {
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
    // First, update UI to be responsive
    isPlaying = !isPlaying;
    updatePlayPauseButton();
    
    // Then call the player SDK function
    const success = await togglePlayPause();
    
    // Update UI based on actual result
    isPlaying = success;
    updatePlayPauseButton();
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
      document.body.removeChild(errorDiv);
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
