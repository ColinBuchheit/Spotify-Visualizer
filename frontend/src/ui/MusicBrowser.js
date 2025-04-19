// src/ui/MusicBrowser.js
// Comprehensive music browser with centralized state management

import { search, getUserProfile, getRecentlyPlayed } from '../spotify/spotifyAPI.js';
import {
    playTrack,
    getDeviceId,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    addEventListener,
    removeEventListener,
    getIsPlaying
} from '../spotify/spotifyPlayer.js';
import './music-browser.css';

// Tracking event listeners
let stateChangeListener = null;
let trackChangeListener = null;
let errorListener = null;

/**
 * Create a music browser component
 * @param {string} accessToken - Spotify access token
 * @returns {object} - Music browser component with element and methods
 */
export function createMusicBrowser(accessToken) {
    // Create main container
    const container = document.createElement('div');
    container.className = 'music-browser-container';
    container.innerHTML = `
        <button class="browser-toggle">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
          </svg>
          <span>Music</span>
        </button>
        
        <div class="music-browser" style="display: none;">
          <div class="browser-header">
            <h2>Spotify Music Browser</h2>
            <button class="close-browser">×</button>
          </div>
          
          <div class="search-container">
            <input type="text" class="search-input" placeholder="Search for songs, artists, or albums...">
            <button class="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          
          <div class="tabs">
            <button class="tab-button active" data-tab="recent">Recently Played</button>
            <button class="tab-button" data-tab="search-results">Search Results</button>
            <button class="tab-button" data-tab="recommended">Recommended</button>
          </div>
          
          <div class="content-area">
            <div class="tab-content recent active">
              <div class="track-list"></div>
            </div>
            
            <div class="tab-content search-results">
              <div class="track-list"></div>
            </div>
            
            <div class="tab-content recommended">
              <div class="track-list"></div>
            </div>
          </div>
          
          <div class="now-playing">
            <div class="now-playing-info">
              <div class="now-playing-text">Not Playing</div>
            </div>
            <div class="now-playing-controls">
              <button class="control-button previous">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="19 20 9 12 19 4 19 20"></polygon>
                  <line x1="5" y1="4" x2="5" y2="20"></line>
                </svg>
              </button>
              <button class="control-button play-pause">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
              <button class="control-button next">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 4 15 12 5 20 5 4"></polygon>
                  <line x1="19" y1="4" x2="19" y2="20"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
    `;

    // Get current state
    const isPlaying = getIsPlaying();
    
    // Update play button to match current state
    updatePlayPauseButton(container, isPlaying);
    
    // Set up event listeners
    setupEventListeners(container, accessToken);
    
    // Listen for player state changes
    stateChangeListener = (data) => {
        updatePlayPauseButton(container, data.isPlaying);
        
        // Update now playing display if possible
        if (data.track) {
            updateNowPlayingDisplay(container, data.track);
        }
    };
    addEventListener('playerStateChanged', stateChangeListener);
    
    // Listen for track changes
    trackChangeListener = (data) => {
        if (data.track) {
            updateNowPlayingDisplay(container, data.track);
        }
    };
    addEventListener('trackChanged', trackChangeListener);
    
    // Listen for errors
    errorListener = (error) => {
        showError(container, error.message || 'An error occurred');
    };
    addEventListener('error', errorListener);
    
    return {
        element: container,
        playTrack: (uri) => playTrack(uri),
        toggleBrowser: () => toggleBrowser(container),
        closeBrowser: () => closeBrowser(container),
        dispose: () => {
            // Clean up event listeners
            if (stateChangeListener) removeEventListener('playerStateChanged', stateChangeListener);
            if (trackChangeListener) removeEventListener('trackChanged', trackChangeListener);
            if (errorListener) removeEventListener('error', errorListener);
        }
    };
}

/**
 * Update play/pause button based on play state
 */
function updatePlayPauseButton(container, isPlaying) {
    const playPauseButton = container.querySelector('.control-button.play-pause');
    if (playPauseButton) {
        if (isPlaying) {
            playPauseButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;
        } else {
            playPauseButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
        }
    }
}

/**
 * Update now playing display
 */
function updateNowPlayingDisplay(container, track) {
    const nowPlayingInfo = container.querySelector('.now-playing-info');
    if (nowPlayingInfo && track) {
        nowPlayingInfo.innerHTML = `
            <img src="${track.album.images[0].url}" class="mini-cover" alt="${track.name}">
            <div class="now-playing-text">
                <div class="now-playing-title">${track.name}</div>
                <div class="now-playing-artist">${track.artists[0].name}</div>
            </div>
        `;
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners(container, accessToken) {
    const browserToggle = container.querySelector('.browser-toggle');
    const browserPanel = container.querySelector('.music-browser');
    const closeButton = container.querySelector('.close-browser');
    const searchInput = container.querySelector('.search-input');
    const searchButton = container.querySelector('.search-button');
    const tabButtons = container.querySelectorAll('.tab-button');
    
    // Playback controls
    const playPauseButton = container.querySelector('.control-button.play-pause');
    const prevButton = container.querySelector('.control-button.previous');
    const nextButton = container.querySelector('.control-button.next');
    
    // Browser toggle
    if (browserToggle) {
        browserToggle.addEventListener('click', () => toggleBrowser(container));
    }
    
    // Close button
    if (closeButton) {
        closeButton.addEventListener('click', () => closeBrowser(container));
    }
    
    // Search input and button
    if (searchInput && searchButton) {
        searchInput.addEventListener('input', handleSearchInput);
        
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') performSearch(container, accessToken);
        });
        
        searchButton.addEventListener('click', () => performSearch(container, accessToken));
    }
    
    // Tab buttons
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                switchTab(container, tabName, accessToken);
            });
        });
    }
    
    // Player controls
    if (playPauseButton) {
        playPauseButton.addEventListener('click', async () => {
            try {
                // Give visual feedback
                playPauseButton.classList.add('control-active');
                setTimeout(() => {
                    playPauseButton.classList.remove('control-active');
                }, 200);
                
                await togglePlayPause();
                // State will be updated by the state change listener
            } catch (error) {
                console.error('Error toggling playback:', error);
                showError(container, 'Playback control failed. Try again.');
            }
        });
    }
    
    if (prevButton) {
        prevButton.addEventListener('click', async () => {
            try {
                // Give visual feedback
                prevButton.classList.add('control-active');
                setTimeout(() => {
                    prevButton.classList.remove('control-active');
                }, 200);
                
                await skipToPrevious();
                // State will be updated by the state change listener
            } catch (error) {
                console.error('Error playing previous track:', error);
                showError(container, 'Could not play previous track.');
            }
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', async () => {
            try {
                // Give visual feedback
                nextButton.classList.add('control-active');
                setTimeout(() => {
                    nextButton.classList.remove('control-active');
                }, 200);
                
                await skipToNext();
                // State will be updated by the state change listener
            } catch (error) {
                console.error('Error playing next track:', error);
                showError(container, 'Could not play next track.');
            }
        });
    }
    
    // Load initial content
    loadRecentTracks(container, accessToken);
}

/**
 * Handle search input with debounce
 */
let searchTimeout = null;
function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    
    const query = e.target.value.trim();
    if (query.length < 2) return;
    
    // Debounce search as user types
    searchTimeout = setTimeout(() => {
        const container = e.target.closest('.music-browser-container');
        if (container) {
            const accessToken = localStorage.getItem('spotify_access_token');
            if (accessToken) {
                performSearch(container, accessToken);
            }
        }
    }, 500);
}

/**
 * Toggle browser visibility
 */
function toggleBrowser(container) {
    const browserPanel = container.querySelector('.music-browser');
    if (!browserPanel) return;
    
    const isVisible = browserPanel.style.display !== 'none';
    browserPanel.style.display = isVisible ? 'none' : 'block';
    
    // If we're opening the browser and no recent tracks, load them
    if (!isVisible) {
        const recentTracksList = container.querySelector('.tab-content.recent .track-list');
        if (recentTracksList && recentTracksList.children.length === 0) {
            const accessToken = localStorage.getItem('spotify_access_token');
            if (accessToken) {
                loadRecentTracks(container, accessToken);
            }
        }
    }
}

/**
 * Close the browser
 */
function closeBrowser(container) {
    const browserPanel = container.querySelector('.music-browser');
    if (browserPanel) {
        browserPanel.style.display = 'none';
    }
}

/**
 * Switch to a different tab
 */
function switchTab(container, tabName, accessToken) {
    // Update active tab button
    const tabButtons = container.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
    });
    
    // Update active tab content
    const tabContents = container.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.toggle('active', content.classList.contains(tabName));
    });
    
    // Load content for the tab if needed
    if (tabName === 'recommended') {
        const recommendedList = container.querySelector('.tab-content.recommended .track-list');
        if (recommendedList && recommendedList.children.length === 0) {
            loadRecommendedTracks(container, accessToken);
        }
    }
}

/**
 * Perform search against Spotify API
 */
async function performSearch(container, accessToken) {
    const searchInput = container.querySelector('.search-input');
    const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
    
    if (!searchInput || !searchTracksList) return;
    
    const query = searchInput.value.trim();
    if (query.length < 2) return;
    
    // Show loading
    searchTracksList.innerHTML = '<div class="loading-spinner">Searching...</div>';
    
    // Switch to search results tab
    switchTab(container, 'search-results', accessToken);
    
    try {
        // Search for tracks, artists, and albums
        const results = await search(query, 'track,album,artist', accessToken, 30);
        
        // Clear loading spinner
        searchTracksList.innerHTML = '';
        
        // Display results
        displaySearchResults(container, results, accessToken);
    } catch (error) {
        console.error('Search error:', error);
        searchTracksList.innerHTML = '<div class="error-message">Error searching. Please try again.</div>';
    }
}

/**
 * Display search results
 */
function displaySearchResults(container, results, accessToken) {
    const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
    if (!searchTracksList) return;
    
    // Handle no results
    if (!results || 
        (!results.tracks?.items?.length && 
         !results.albums?.items?.length && 
         !results.artists?.items?.length)) {
        searchTracksList.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }
    
    // Clear any existing content
    searchTracksList.innerHTML = '';
    
    // Add tracks
    if (results.tracks && results.tracks.items.length) {
        const tracksSection = document.createElement('div');
        tracksSection.innerHTML = '<h3>Tracks</h3>';
        
        const trackItems = createTrackList(results.tracks.items, accessToken);
        tracksSection.appendChild(trackItems);
        searchTracksList.appendChild(tracksSection);
    }
    
    // Add albums
    if (results.albums && results.albums.items.length) {
        const albumsSection = document.createElement('div');
        albumsSection.innerHTML = '<h3>Albums</h3>';
        
        const albumsList = document.createElement('div');
        albumsList.className = 'album-grid';
        
        results.albums.items.forEach(album => {
            const albumItem = createAlbumItem(album, container, accessToken);
            albumsList.appendChild(albumItem);
        });
        
        albumsSection.appendChild(albumsList);
        searchTracksList.appendChild(albumsSection);
    }
    
    // Add artists
    if (results.artists && results.artists.items.length) {
        const artistsSection = document.createElement('div');
        artistsSection.innerHTML = '<h3>Artists</h3>';
        
        const artistsList = document.createElement('div');
        artistsList.className = 'artist-grid';
        
        results.artists.items.forEach(artist => {
            const artistItem = createArtistItem(artist, container, accessToken);
            artistsList.appendChild(artistItem);
        });
        
        artistsSection.appendChild(artistsList);
        searchTracksList.appendChild(artistsSection);
    }
}

/**
 * Create a track list element
 */
function createTrackList(tracks, accessToken) {
    const trackList = document.createElement('div');
    trackList.className = 'track-list';
    
    tracks.forEach(track => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-item';
        trackItem.innerHTML = `
            <img src="${track.album?.images[0]?.url || ''}" alt="${track.name}" class="track-image">
            <div class="track-details">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
            </div>
            <div class="track-duration">${formatDuration(track.duration_ms)}</div>
            <button class="play-track">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            </button>
        `;
        
        // Add click handler to play track
        trackItem.querySelector('.play-track').addEventListener('click', async () => {
            try {
                await playTrack(track.uri);
                // State update handled by event listeners
            } catch (error) {
                console.error('Error playing track:', error);
            }
        });
        
        trackList.appendChild(trackItem);
    });
    
    return trackList;
}

/**
 * Create an album item element
 */
function createAlbumItem(album, container, accessToken) {
    const albumItem = document.createElement('div');
    albumItem.className = 'album-item';
    albumItem.innerHTML = `
        <img src="${album.images[0]?.url || ''}" alt="${album.name}" class="album-image">
        <div class="album-details">
            <div class="album-name">${album.name}</div>
            <div class="album-artist">${album.artists.map(a => a.name).join(', ')}</div>
        </div>
    `;
    
    // Add click handler to load album tracks
    albumItem.addEventListener('click', () => {
        loadAlbumTracks(container, album.id, accessToken);
    });
    
    return albumItem;
}

/**
 * Create an artist item element
 */
function createArtistItem(artist, container, accessToken) {
    const artistItem = document.createElement('div');
    artistItem.className = 'artist-item';
    artistItem.innerHTML = `
        <img src="${artist.images[0]?.url || ''}" alt="${artist.name}" class="artist-image">
        <div class="artist-name">${artist.name}</div>
    `;
    
    // Add click handler to load artist tracks
    artistItem.addEventListener('click', () => {
        loadArtistTopTracks(container, artist.id, accessToken);
    });
    
    return artistItem;
}

/**
 * Load and display recently played tracks
 */
async function loadRecentTracks(container, accessToken) {
    const recentTracksList = container.querySelector('.tab-content.recent .track-list');
    if (!recentTracksList) return;
    
    try {
        // Show loading spinner
        recentTracksList.innerHTML = '<div class="loading-spinner">Loading...</div>';
        
        const recentTracks = await getRecentlyPlayed(accessToken, 20);
        
        if (!recentTracks || !recentTracks.items || recentTracks.items.length === 0) {
            recentTracksList.innerHTML = '<div class="no-results">No recently played tracks</div>';
            return;
        }
        
        // Extract unique tracks (remove duplicates)
        const uniqueTracks = [];
        const trackIds = new Set();
        
        recentTracks.items.forEach(item => {
            if (!trackIds.has(item.track.id)) {
                trackIds.add(item.track.id);
                uniqueTracks.push(item.track);
            }
        });
        
        // Clear loading spinner
        recentTracksList.innerHTML = '';
        
        // Create and append track list
        const trackListElement = createTrackList(uniqueTracks, accessToken);
        recentTracksList.appendChild(trackListElement);
    } catch (error) {
        console.error('Error loading recent tracks:', error);
        recentTracksList.innerHTML = '<div class="error-message">Could not load recent tracks</div>';
    }
}

/**
 * Load and display album tracks
 */
async function loadAlbumTracks(container, albumId, accessToken) {
    const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
    if (!searchTracksList) return;
    
    try {
        // Show loading
        searchTracksList.innerHTML = '<div class="loading-spinner">Loading album tracks...</div>';
        
        // Get album tracks from API
        const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load album tracks');
        }
        
        const data = await response.json();
        
        // Get full track details for each track
        const trackIds = data.items.map(track => track.id).join(',');
        const tracksResponse = await fetch(`https://api.spotify.com/v1/tracks?ids=${trackIds}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!tracksResponse.ok) {
            throw new Error('Failed to load track details');
        }
        
        const tracksData = await tracksResponse.json();
        
        // Clear loading spinner
        searchTracksList.innerHTML = '';
        
        // Display tracks
        searchTracksList.innerHTML = `<h3>Album Tracks</h3>`;
        const trackList = createTrackList(tracksData.tracks, accessToken);
        searchTracksList.appendChild(trackList);
    } catch (error) {
        console.error('Error loading album tracks:', error);
        searchTracksList.innerHTML = '<div class="error-message">Error loading album tracks</div>';
    }
}

/**
 * Load and display artist's top tracks
 */
async function loadArtistTopTracks(container, artistId, accessToken) {
    const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
    if (!searchTracksList) return;
    
    try {
        // Show loading
        searchTracksList.innerHTML = '<div class="loading-spinner">Loading artist tracks...</div>';
        
        // Get market from user profile
        let market = 'US'; // Default
        try {
            const userProfile = await getUserProfile(accessToken);
            if (userProfile && userProfile.country) {
                market = userProfile.country;
            }
        } catch (e) {
            console.warn('Could not get user country, using default', e);
        }
        
        // Get artist's top tracks
        const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load artist tracks');
        }
        
        const data = await response.json();
        
        // Clear loading spinner
        searchTracksList.innerHTML = '';
        
        // Display tracks
        searchTracksList.innerHTML = `<h3>Top Tracks</h3>`;
        const trackList = createTrackList(data.tracks, accessToken);
        searchTracksList.appendChild(trackList);
        
        // Also load related artists
        loadRelatedArtists(container, artistId, accessToken);
    } catch (error) {
        console.error('Error loading artist tracks:', error);
        searchTracksList.innerHTML = '<div class="error-message">Error loading artist tracks</div>';
    }
}

/**
 * Load and display related artists
 */
async function loadRelatedArtists(container, artistId, accessToken) {
    const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
    if (!searchTracksList) return;
    
    try {
        const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load related artists');
        }
        
        const data = await response.json();
        
        if (data.artists && data.artists.length > 0) {
            const relatedSection = document.createElement('div');
            relatedSection.innerHTML = '<h3>Related Artists</h3>';
            
            const artistsGrid = document.createElement('div');
            artistsGrid.className = 'artist-grid';
            
            data.artists.slice(0, 6).forEach(artist => {
                const artistItem = createArtistItem(artist, container, accessToken);
                artistsGrid.appendChild(artistItem);
            });
            
            relatedSection.appendChild(artistsGrid);
            searchTracksList.appendChild(relatedSection);
        }
    } catch (error) {
        console.error('Error loading related artists:', error);
        // Don't show an error message since this is supplementary content
    }
}

/**
 * Load recommended tracks based on recent plays
 */
async function loadRecommendedTracks(container, accessToken) {
    const recommendedTracksList = container.querySelector('.tab-content.recommended .track-list');
    if (!recommendedTracksList) return;
    
    try {
        // Show loading spinner
        recommendedTracksList.innerHTML = '<div class="loading-spinner">Loading recommendations...</div>';
        
        // First get recent tracks to use as seeds
        const recentTracks = await getRecentlyPlayed(accessToken, 5);
        
        if (!recentTracks || !recentTracks.items || recentTracks.items.length === 0) {
            recommendedTracksList.innerHTML = '<div class="no-results">No track history to generate recommendations</div>';
            return;
        }
        
        // Extract track IDs for recommendations
        const seedTracks = recentTracks.items
            .slice(0, 3)
            .map(item => item.track.id)
            .join(',');
        
        // Get recommendations based on recent tracks
        const response = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}&limit=20`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load recommendations');
        }
        
        const data = await response.json();
        
        // Clear loading spinner
        recommendedTracksList.innerHTML = '';
        
        // Create and append track list
        const trackList = createTrackList(data.tracks, accessToken);
        recommendedTracksList.appendChild(trackList);
    } catch (error) {
        console.error('Error loading recommendations:', error);
        recommendedTracksList.innerHTML = '<div class="error-message">Error loading recommendations</div>';
    }
}

/**
 * Show error message
 */
function showError(container, message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'browser-error-notification';
    errorEl.textContent = message;
    
    container.appendChild(errorEl);
    
    // Remove after a delay
    setTimeout(() => {
        errorEl.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        errorEl.classList.remove('show');
        setTimeout(() => {
            if (container.contains(errorEl)) {
                container.removeChild(errorEl);
            }
        }, 300);
    }, 5000);
}

/**
 * Format milliseconds to MM:SS
 */
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export { 
    createMusicBrowser, 
    toggleBrowser, 
    closeBrowser,
    updatePlayPauseButton
};