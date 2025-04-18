// src/ui/MusicBrowser.js
// Comprehensive music browser for direct track selection and playback in the web app

import { search, getUserProfile, getRecentlyPlayed } from '../spotify/spotifyAPI.js';
import './music-browser.css';

/**
 * Create a music browser component
 * @param {object} player - Spotify Web Player instance
 * @param {string} accessToken - Spotify access token
 * @param {string} initialDeviceId - Initial Spotify device ID
 * @returns {object} - Music browser component with element and methods
 */
export function createMusicBrowser(player, accessToken, initialDeviceId) {
  // Store the device ID
  let currentDeviceId = initialDeviceId;
  
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
          <div class="loading-spinner">Loading...</div>
          <div class="track-list"></div>
        </div>
        
        <div class="tab-content search-results">
          <div class="track-list"></div>
        </div>
        
        <div class="tab-content recommended">
          <div class="loading-spinner">Loading recommendations...</div>
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
  
  // DOM elements
  const browserToggle = container.querySelector('.browser-toggle');
  const browserPanel = container.querySelector('.music-browser');
  const closeButton = container.querySelector('.close-browser');
  const searchInput = container.querySelector('.search-input');
  const searchButton = container.querySelector('.search-button');
  const tabButtons = container.querySelectorAll('.tab-button');
  const tabContents = container.querySelectorAll('.tab-content');
  
  // Playback controls
  const playPauseButton = container.querySelector('.control-button.play-pause');
  const prevButton = container.querySelector('.control-button.previous');
  const nextButton = container.querySelector('.control-button.next');
  const nowPlayingInfo = container.querySelector('.now-playing-info');
  
  // Track lists
  const recentTracksList = container.querySelector('.tab-content.recent .track-list');
  const searchTracksList = container.querySelector('.tab-content.search-results .track-list');
  const recommendedTracksList = container.querySelector('.tab-content.recommended .track-list');
  
  // State variables
  let isPlaying = false;
  let currentTrack = null;
  let searchTimeout = null;
  
  // Event listeners
  browserToggle.addEventListener('click', toggleBrowser);
  closeButton.addEventListener('click', closeBrowser);
  
  // Search functionality
  searchInput.addEventListener('input', handleSearchInput);
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') performSearch();
  });
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Player controls
  playPauseButton.addEventListener('click', togglePlayback);
  prevButton.addEventListener('click', playPrevious);
  nextButton.addEventListener('click', playNext);
  
  // Initialize by loading recent tracks
  loadRecentTracks();
  
  // Set up player state listener
  if (player) {
    player.addListener('player_state_changed', updatePlayerState);
  }
  
  /**
   * Toggle browser visibility
   */
  function toggleBrowser() {
    const isVisible = browserPanel.style.display !== 'none';
    browserPanel.style.display = isVisible ? 'none' : 'block';
    
    // If we're opening the browser and no recent tracks, load them
    if (!isVisible && recentTracksList.children.length === 0) {
      loadRecentTracks();
    }
  }
  
  /**
   * Close the browser
   */
  function closeBrowser() {
    browserPanel.style.display = 'none';
  }
  
  /**
   * Handle search input with debounce
   */
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    
    const query = searchInput.value.trim();
    if (query.length < 2) return;
    
    searchTimeout = setTimeout(() => {
      performSearch();
    }, 500);
  }
  
  /**
   * Perform search against Spotify API
   */
  async function performSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) return;
    
    // Show loading
    searchTracksList.innerHTML = '<div class="loading-spinner">Searching...</div>';
    
    // Switch to search results tab
    switchTab('search-results');
    
    try {
      // Search for tracks, artists, and albums
      const results = await search(query, 'track,album,artist', accessToken, 30);
      
      // Process and display results
      displaySearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      searchTracksList.innerHTML = '<div class="error-message">Error searching. Please try again.</div>';
    }
  }
  
  /**
   * Display search results
   * @param {object} results - Search results from Spotify API
   */
  function displaySearchResults(results) {
    searchTracksList.innerHTML = '';
    
    // Handle no results
    if (!results || 
        (!results.tracks?.items?.length && 
         !results.albums?.items?.length && 
         !results.artists?.items?.length)) {
      searchTracksList.innerHTML = '<div class="no-results">No results found</div>';
      return;
    }
    
    // Add tracks
    if (results.tracks && results.tracks.items.length) {
      const tracksSection = document.createElement('div');
      tracksSection.innerHTML = '<h3>Tracks</h3>';
      
      const trackItems = createTrackList(results.tracks.items);
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
        const albumItem = createAlbumItem(album);
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
        const artistItem = createArtistItem(artist);
        artistsList.appendChild(artistItem);
      });
      
      artistsSection.appendChild(artistsList);
      searchTracksList.appendChild(artistsSection);
    }
  }
  
  /**
   * Create a track list element
   * @param {Array} tracks - Array of track objects
   * @returns {HTMLElement} - Track list element
   */
  function createTrackList(tracks) {
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
      trackItem.querySelector('.play-track').addEventListener('click', () => {
        playTrack(track.uri);
      });
      
      trackList.appendChild(trackItem);
    });
    
    return trackList;
  }
  
  /**
   * Create an album item element
   * @param {object} album - Album object
   * @returns {HTMLElement} - Album item element
   */
  function createAlbumItem(album) {
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
      loadAlbumTracks(album.id);
    });
    
    return albumItem;
  }
  
  /**
   * Create an artist item element
   * @param {object} artist - Artist object
   * @returns {HTMLElement} - Artist item element
   */
  function createArtistItem(artist) {
    const artistItem = document.createElement('div');
    artistItem.className = 'artist-item';
    artistItem.innerHTML = `
      <img src="${artist.images[0]?.url || ''}" alt="${artist.name}" class="artist-image">
      <div class="artist-name">${artist.name}</div>
    `;
    
    // Add click handler to load artist tracks
    artistItem.addEventListener('click', () => {
      loadArtistTopTracks(artist.id);
    });
    
    return artistItem;
  }
  
  /**
   * Load and display recently played tracks
   */
  async function loadRecentTracks() {
    try {
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
      const trackListElement = createTrackList(uniqueTracks);
      recentTracksList.appendChild(trackListElement);
    } catch (error) {
      console.error('Error loading recent tracks:', error);
      recentTracksList.innerHTML = '<div class="error-message">Could not load recent tracks</div>';
    }
  }
  
  /**
   * Load and display album tracks
   * @param {string} albumId - Spotify album ID
   */
  async function loadAlbumTracks(albumId) {
    try {
      // Show loading in search results
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
      
      // Display tracks
      searchTracksList.innerHTML = `<h3>Album Tracks</h3>`;
      const trackList = createTrackList(tracksData.tracks);
      searchTracksList.appendChild(trackList);
    } catch (error) {
      console.error('Error loading album tracks:', error);
      searchTracksList.innerHTML = '<div class="error-message">Error loading album tracks</div>';
    }
  }
  
  /**
   * Load and display artist's top tracks
   * @param {string} artistId - Spotify artist ID
   */
  async function loadArtistTopTracks(artistId) {
    try {
      // Show loading in search results
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
      
      // Display tracks
      searchTracksList.innerHTML = `<h3>Top Tracks</h3>`;
      const trackList = createTrackList(data.tracks);
      searchTracksList.appendChild(trackList);
      
      // Also load related artists
      loadRelatedArtists(artistId);
    } catch (error) {
      console.error('Error loading artist tracks:', error);
      searchTracksList.innerHTML = '<div class="error-message">Error loading artist tracks</div>';
    }
  }
  
  /**
   * Load and display related artists
   * @param {string} artistId - Spotify artist ID
   */
  async function loadRelatedArtists(artistId) {
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
          const artistItem = createArtistItem(artist);
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
  async function loadRecommendedTracks() {
    try {
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
      
      // Display recommended tracks
      recommendedTracksList.innerHTML = '';
      const trackList = createTrackList(data.tracks);
      recommendedTracksList.appendChild(trackList);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      recommendedTracksList.innerHTML = '<div class="error-message">Error loading recommendations</div>';
    }
  }
  
  /**
   * Play a track by URI
   * @param {string} uri - Spotify track URI
   */
  async function playTrack(uri) {
    try {
      // Use the device ID that was passed in, or try to retrieve it
      let deviceId = currentDeviceId;
      
      if (!deviceId) {
        // Try alternative methods to get device ID if not available
        try {
          const state = await player.getCurrentState();
          if (state && state.device_id) {
            deviceId = state.device_id;
            currentDeviceId = deviceId; // Store for future use
          }
        } catch (e) {
          console.warn('Could not get player state:', e);
        }
        
        // Use global variable as fallback
        if (!deviceId && window.spotifyDeviceId) {
          deviceId = window.spotifyDeviceId;
          currentDeviceId = deviceId; // Store for future use
        }
      }
      
      if (!deviceId) {
        // If we still don't have a device ID, try one last approach
        // Add a temporary listener for the ready event
        const deviceIdPromise = new Promise(resolve => {
          const listener = ({ device_id }) => {
            player.removeListener('ready', listener);
            resolve(device_id);
          };
          
          player.addListener('ready', listener);
          
          // Set a timeout to avoid waiting forever
          setTimeout(() => {
            player.removeListener('ready', listener);
            resolve(null);
          }, 3000);
        });
        
        deviceId = await deviceIdPromise;
        if (deviceId) {
          currentDeviceId = deviceId;
        }
      }
      
      if (!deviceId) {
        throw new Error('No active device found. Try refreshing the page.');
      }
      
      console.log('Playing track on device ID:', deviceId);
      
      // Play the track on the device
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
        // If we get a 404, the device might not be active anymore
        if (response.status === 404) {
          // Try to reconnect the player
          await player.connect();
          throw new Error('Playback device not ready. Try again in a moment.');
        }
        
        const errorData = await response.json().catch(() => ({}));
        console.error('Play track error:', response.status, errorData);
        throw new Error('Failed to play track');
      }
      
      // Update UI to show playing state
      isPlaying = true;
      updatePlayPauseButton();
    } catch (error) {
      console.error('Error playing track:', error);
      showError('Could not play track. Make sure Spotify is active and try again.');
    }
  }
  
  /**
   * Toggle play/pause
   */
  async function togglePlayback() {
    if (!player) return;
    
    try {
      if (isPlaying) {
        await player.pause();
      } else {
        await player.resume();
      }
      
      // UI will be updated via the player state listener
    } catch (error) {
      console.error('Error toggling playback:', error);
      showError('Playback control failed. Try again.');
    }
  }
  
  /**
   * Play previous track
   */
  async function playPrevious() {
    if (!player) return;
    
    try {
      await player.previousTrack();
    } catch (error) {
      console.error('Error playing previous track:', error);
      showError('Could not play previous track.');
    }
  }
  
  /**
   * Play next track
   */
  async function playNext() {
    if (!player) return;
    
    try {
      await player.nextTrack();
    } catch (error) {
      console.error('Error playing next track:', error);
      showError('Could not play next track.');
    }
  }
  
  /**
   * Update the player state UI
   * @param {object} state - Player state
   */
  function updatePlayerState(state) {
    if (!state) {
      // No active player state
      isPlaying = false;
      currentTrack = null;
      nowPlayingInfo.innerHTML = '<div class="now-playing-text">Not Playing</div>';
      updatePlayPauseButton();
      return;
    }
    
    // Update playing state
    isPlaying = !state.paused;
    updatePlayPauseButton();
    
    // Check for track change
    const track = state.track_window.current_track;
    if (!currentTrack || track.id !== currentTrack.id) {
      currentTrack = track;
      
      // Update now playing display
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
   * Update the play/pause button based on current state
   */
  function updatePlayPauseButton() {
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
  
  /**
   * Switch to a different tab
   * @param {string} tabName - Name of the tab to switch to
   */
  function switchTab(tabName) {
    // Update active tab button
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
    });
    
    // Update active tab content
    tabContents.forEach(content => {
      content.classList.toggle('active', content.classList.contains(tabName));
    });
    
    // Load content for the tab if needed
    if (tabName === 'recommended' && recommendedTracksList.children.length === 0) {
      loadRecommendedTracks();
    }
  }
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  function showError(message) {
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
        container.removeChild(errorEl);
      }, 300);
    }, 5000);
  }
  
  /**
   * Format milliseconds to MM:SS
   * @param {number} ms - Duration in milliseconds
   * @returns {string} - Formatted duration
   */
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return {
    element: container,
    playTrack,
    toggleBrowser,
    closeBrowser,
    // Add method to update device ID
    updateDeviceId: (newDeviceId) => {
      currentDeviceId = newDeviceId;
      console.log('Updated device ID:', newDeviceId);
    }
  };
}