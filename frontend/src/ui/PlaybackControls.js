// PlaybackControls.js - Simple playback controls for Spotify Web Playback SDK

/**
 * Create playback controls for Spotify
 * @param {Object} player - Spotify Web Player instance
 * @param {string} accessToken - Spotify access token
 * @returns {Object} - DOM element containing the controls
 */
export function createPlaybackControls(player, accessToken) {
    // Create container
    const container = document.createElement('div');
    container.className = 'playback-controls';
    
    // Create Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'control-btn play-pause';
    playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
    
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
        <button class="select-track-btn">Select Track</button>
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
    
    // Handle play/pause
    let isPlaying = false;
    
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            player.pause().then(() => {
                isPlaying = false;
                playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
            });
        } else {
            player.resume().then(() => {
                isPlaying = true;
                playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
            });
        }
    });
    
    // Handle next/previous
    nextBtn.addEventListener('click', () => {
        player.nextTrack();
    });
    
    prevBtn.addEventListener('click', () => {
        player.previousTrack();
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
                    displayTrackResults(tracks);
                })
                .catch(error => {
                    console.error('Error searching for tracks:', error);
                    trackResults.innerHTML = '<div class="track-error">Error searching for tracks</div>';
                });
        }, 500);
    });
    
    // Function to search tracks
    function searchTracks(query, token) {
        return fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Search failed');
            }
            return response.json();
        })
        .then(data => data.tracks.items);
    }
    
    // Display track results
    function displayTrackResults(tracks) {
        if (!tracks || tracks.length === 0) {
            trackResults.innerHTML = '<div class="no-results">No tracks found</div>';
            return;
        }
        
        trackResults.innerHTML = '';
        
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
            
            trackItem.addEventListener('click', () => {
                playTrack(track.uri);
                trackDropdown.style.display = 'none';
                selectTrackBtn.textContent = track.name;
            });
            
            trackResults.appendChild(trackItem);
        });
    }
    
    // Function to play a track
    function playTrack(uri) {
        // Get device ID from the player
        const deviceId = player._options.id;
        
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [uri]
            })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    console.error('No active device found. Make sure the player is ready.');
                } else {
                    throw new Error('Failed to play track');
                }
            }
            isPlaying = true;
            playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
        })
        .catch(error => {
            console.error('Error playing track:', error);
        });
    }
    
    // Handle player state changes
    player.addListener('player_state_changed', state => {
        if (!state) return;
        
        isPlaying = !state.paused;
        
        if (isPlaying) {
            playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
        } else {
            playPauseBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;
        }
        
        // Update track selection button with current track name if available
        if (state.track_window && state.track_window.current_track) {
            selectTrackBtn.textContent = state.track_window.current_track.name;
        }
    });
    
    return {
        element: container,
        playTrack
    };
}
