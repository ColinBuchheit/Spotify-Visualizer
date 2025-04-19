// PlaybackControls.js - Updated to use centralized state management

import { 
  getPlayer, 
  getIsPlaying, 
  getCurrentTrack,
  playTrack, 
  addEventListener, 
  removeEventListener,
  togglePlayPause,
  skipToNext,
  skipToPrevious,
  setVolume
} from '../spotify/spotifyPlayer.js';

// Tracking event listeners
let stateChangeListener = null;
let trackChangeListener = null;
let errorListener = null;

/**
 * Create playback controls for Spotify
 * @param {string} accessToken - Spotify access token
 * @returns {Object} - DOM element containing the controls
 */
export function createPlaybackControls(accessToken) {
    // Create container
    const container = document.createElement('div');
    container.className = 'playback-controls';
    
    // Get current player state
    const isPlaying = getIsPlaying();
    const currentTrack = getCurrentTrack();
    
    // Create Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'control-btn play-pause';
    playPauseBtn.innerHTML = isPlaying 
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
    
    // Create Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'control-btn prev';
    prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor"/></svg>`;
    
    // Create Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'control-btn next';
    nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M16 6h2v12h-2zm-8 6l8.5-6v12z" fill="currentColor"/></svg>`;
    
    // Create a track selection element
    const trackSelect = document.createElement('div');
    trackSelect.className = 'track-select';
    trackSelect.innerHTML = `
        <button class="select-track-btn">${currentTrack?.name || 'Select Track'}</button>
        <div class="track-dropdown" style="display: none;">
            <input type="text" placeholder="Search for tracks..." class="track-search">
            <div class="track-results"></div>
        </div>
    `;
    
    // Add elements to container
    container.appendChild(prevBtn);
    container.appendChild(playPauseBtn);
    container.appendChild(nextBtn);
    container.appendChild(trackSelect);
    
    // Set up event listeners
    setupEventListeners(container, playPauseBtn, prevBtn, nextBtn, trackSelect, accessToken);
    
    // Listen for player state changes
    stateChangeListener = (data) => {
        // Update play/pause button based on playing state
        if (data.isPlaying) {
            playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
        } else {
            playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
        }
    };
    addEventListener('playerStateChanged', stateChangeListener);
    
    // Listen for track changes
    trackChangeListener = (data) => {
        const selectTrackBtn = trackSelect.querySelector('.select-track-btn');
        if (selectTrackBtn && data.track) {
            selectTrackBtn.textContent = data.track.name;
        }
    };
    addEventListener('trackChanged', trackChangeListener);
    
    // Listen for errors
    errorListener = (error) => {
        if (error.type === 'playback') {
            console.error('Playback error:', error.message);
            // You could show an error message here
        }
    };
    addEventListener('error', errorListener);
    
    return {
        element: container,
        dispose: () => {
            // Clean up event listeners when component is removed
            if (stateChangeListener) removeEventListener('playerStateChanged', stateChangeListener);
            if (trackChangeListener) removeEventListener('trackChanged', trackChangeListener);
            if (errorListener) removeEventListener('error', errorListener);
        }
    };
}

/**
 * Set up event listeners for the playback controls
 */
function setupEventListeners(container, playPauseBtn, prevBtn, nextBtn, trackSelect, accessToken) {
    // Handle play/pause
    playPauseBtn.addEventListener('click', async () => {
        try {
            await togglePlayPause();
            // State update is handled by the state change listener
        } catch (error) {
            console.error('Error toggling playback:', error);
        }
    });
    
    // Handle next/previous
    nextBtn.addEventListener('click', async () => {
        try {
            await skipToNext();
            // State update is handled by the state change listener
        } catch (error) {
            console.error('Error skipping to next track:', error);
        }
    });
    
    prevBtn.addEventListener('click', async () => {
        try {
            await skipToPrevious();
            // State update is handled by the state change listener
        } catch (error) {
            console.error('Error skipping to previous track:', error);
        }
    });
    
    // Track selection functionality
    const selectTrackBtn = trackSelect.querySelector('.select-track-btn');
    const trackDropdown = trackSelect.querySelector('.track-dropdown');
    const trackSearch = trackSelect.querySelector('.track-search');
    const trackResults = trackSelect.querySelector('.track-results');
    
    selectTrackBtn.addEventListener('click', () => {
        trackDropdown.style.display = trackDropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    document.addEventListener('click', (event) => {
        if (!trackSelect.contains(event.target)) {
            trackDropdown.style.display = 'none';
        }
    });
    
    // Search functionality
    let searchTimeout = null;
    
    trackSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            trackResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchTracks(query, accessToken)
                .then(tracks => {
                    displayTrackResults(tracks, trackResults, accessToken);
                })
                .catch(error => {
                    console.error('Error searching for tracks:', error);
                    trackResults.innerHTML = '<div class="track-error">Error searching for tracks</div>';
                });
        }, 500);
    });
}

/**
 * Display track results
 */
function displayTrackResults(tracks, resultsContainer, accessToken) {
    if (!tracks || tracks.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No tracks found</div>';
        return;
    }
    
    resultsContainer.innerHTML = '';
    
    tracks.forEach(track => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-item';
        trackItem.innerHTML = `
            <img src="${track.album.images.length > 0 ? track.album.images[track.album.images.length - 1].url : ''}" alt="${track.name}">
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
            </div>
        `;
        
        trackItem.addEventListener('click', async () => {
            try {
                await playTrack(track.uri);
                // Close dropdown
                const dropdown = resultsContainer.closest('.track-dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
                
                // Update button text
                const selectBtn = resultsContainer.closest('.track-select').querySelector('.select-track-btn');
                if (selectBtn) {
                  selectBtn.textContent = track.name;
                }
            } catch (error) {
                console.error('Error playing track:', error);
            }
        });
        
        resultsContainer.appendChild(trackItem);
    });
}

/**
 * Function to search tracks
 * @param {string} query - Search query
 * @param {string} token - Spotify access token
 * @returns {Promise<Array>} - Array of track results
 */
async function searchTracks(query, token) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const data = await response.json();
        return data.tracks.items;
    } catch (error) {
        console.error('Error searching tracks:', error);
        throw error;
    }
}