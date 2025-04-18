// src/spotify/spotifyAPI.js with improved error handling
import axios from 'axios';
import { refreshAccessToken, handleAuthError } from '../auth/handleAuth.js';

const BASE_URL = 'https://api.spotify.com/v1';

// Create axios instance with built-in auth handling
const spotifyAxios = axios.create({
  baseURL: BASE_URL
});

// Add response interceptor to handle auth errors
spotifyAxios.interceptors.response.use(
  response => response,
  async error => {
    // Only refresh token on 401 Unauthorized errors (not 403 Forbidden)
    // 401 = invalid/expired token, 403 = valid token but insufficient permissions
    if (error.response && error.response.status === 401) {
      // Check if we've already tried refreshing for this request
      if (error.config._isRetry) {
        console.log('Already attempted refresh for this request, not retrying again');
        return Promise.reject(error);
      }
      
      console.log('Token expired (401), attempting to refresh...');
      
      try {
        // Try to refresh the token
        const token = await refreshAccessToken();
        
        if (token) {
          // If token refresh was successful, retry the request
          console.log('Token refreshed, retrying request...');
          
          // Get original request configuration
          const originalRequest = error.config;
          
          // Mark this request as retried to prevent loops
          originalRequest._isRetry = true;
          
          // Update the authorization header with the new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          // Retry the request
          return spotifyAxios(originalRequest);
        } else {
          // If refresh failed, handle the auth error
          console.error('Token refresh failed');
          handleAuthError(error);
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('Error during token refresh:', refreshError);
        handleAuthError(refreshError);
        return Promise.reject(error);
      }
    }
    
    // For 403 Forbidden, don't try to refresh token - the user doesn't have permission
    if (error.response && error.response.status === 403) {
      console.log('Permission denied (403) - user lacks necessary permission for this resource');
      // Just reject the promise, no retries needed
      return Promise.reject(error);
    }
    
    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

/**
 * Get the currently playing track
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object>} - Current track data
 */
export async function getCurrentlyPlayingTrack(accessToken) {
  try {
    const response = await spotifyAxios.get('/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching currently playing track:', error.response?.data || error);
    
    // Rethrow the error but don't show UI error for this specific endpoint
    // as it's called frequently and might fail if nothing is playing
    throw error;
  }
}

/**
 * Get audio features for a track
 * @param {string} trackId - Spotify track ID
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object>} - Audio features data
 */
export async function getAudioFeatures(trackId, accessToken) {
  if (!trackId) {
    console.error('No track ID provided for audio features');
    return getDefaultAudioFeatures();
  }
  
  try {
    const response = await spotifyAxios.get(`/audio-features/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    // For 403 Forbidden errors, immediately return default values without retrying
    if (error.response && error.response.status === 403) {
      console.log('Audio features access forbidden for this track. Using default values.');
      return getDefaultAudioFeatures();
    }
    
    // For 401 Unauthorized, let the interceptor handle token refresh
    if (error.response && error.response.status === 401) {
      // Let interceptor handle it
      throw error;
    } 
    
    // For other errors, return default values
    console.log('Error fetching audio features. Returning default values:', error.response?.status || error.message);
    return getDefaultAudioFeatures();
  }
}

/**
 * Get default audio features when API call fails
 * @returns {Object} - Default audio features
 */
function getDefaultAudioFeatures() {
  return {
    energy: 0.5,
    tempo: 120,
    valence: 0.5,
    danceability: 0.5,
    acousticness: 0.5,
    instrumentalness: 0.5,
    liveness: 0.5,
    speechiness: 0.5
  };
}

/**
 * Get detailed audio analysis for a track
 * @param {string} trackId - Spotify track ID
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object>} - Audio analysis data including segments, beats, etc.
 */
export async function getAudioAnalysis(trackId, accessToken) {
  if (!trackId) {
    console.error('No track ID provided for audio analysis');
    return null;
  }
    
  try {
    const response = await spotifyAxios.get(`/audio-analysis/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    // For 403 Forbidden errors, immediately return null without retrying
    if (error.response && error.response.status === 403) {
      console.log('Audio analysis access forbidden for this track. Using fallback values.');
      return null;
    }
    
    // For 401 Unauthorized, let the interceptor handle token refresh
    if (error.response && error.response.status === 401) {
      // Let interceptor handle it
      throw error;
    }
    
    // For other errors, return null so the calling code can use fallback values
    console.log('Error fetching audio analysis. Using fallback values:', error.response?.status || error.message);
    return null;
  }
}

/**
 * Get user profile information
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object>} - User profile data
 */
export async function getUserProfile(accessToken) {
  try {
    const response = await spotifyAxios.get('/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error.response?.data || error);
    
    // Handle auth errors with the interceptor
    throw error;
  }
}

/**
 * Control playback - play, pause, skip, etc.
 * @param {string} action - Action to perform: 'play', 'pause', 'next', 'previous'
 * @param {string} accessToken - Spotify access token
 * @param {string} deviceId - Optional device ID
 * @returns {Promise<Object>} - Response data
 */
export async function controlPlayback(action, accessToken, deviceId = null) {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  try {
    let endpoint = '';
    let method = 'PUT';
    let body = null;

    // Construct request based on action
    switch (action) {
      case 'play':
        endpoint = deviceId ? 
          `/me/player/play?device_id=${deviceId}` : 
          `/me/player/play`;
        method = 'PUT';
        break;
      case 'pause':
        endpoint = `/me/player/pause`;
        method = 'PUT';
        break;
      case 'next':
        endpoint = `/me/player/next`;
        method = 'POST';
        break;
      case 'previous':
        endpoint = `/me/player/previous`;
        method = 'POST';
        break;
      default:
        throw new Error(`Unknown playback action: ${action}`);
    }

    // Send request using our custom axios instance
    const response = await spotifyAxios({
      method,
      url: endpoint,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: body
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error controlling playback (${action}):`, error.response?.data || error);
    
    // For 404 errors, device might not be ready
    if (error.response && error.response.status === 404) {
      return { 
        success: false, 
        error: 'Playback device not ready. Try again in a moment.' 
      };
    }
    
    throw error;
  }
}

/**
 * Get recently played tracks
 * @param {string} accessToken - Spotify access token
 * @param {number} limit - Number of tracks to return (default: 20, max: 50)
 * @returns {Promise<Object>} - Recently played tracks
 */
export async function getRecentlyPlayed(accessToken, limit = 20) {
  try {
    const response = await spotifyAxios.get('/me/player/recently-played', {
      params: { limit: Math.min(50, limit) },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching recently played tracks:', error.response?.data || error);
    throw error;
  }
}

/**
 * Get available devices
 * @param {string} accessToken - Spotify access token
 * @returns {Promise<Object>} - Available devices
 */
export async function getAvailableDevices(accessToken) {
  try {
    const response = await spotifyAxios.get('/me/player/devices', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching available devices:', error.response?.data || error);
    throw error;
  }
}

/**
 * Search for tracks, albums, artists, or playlists
 * @param {string} query - Search query
 * @param {string} type - Item types to search across: 'album', 'artist', 'playlist', 'track' (can be comma-separated list)
 * @param {string} accessToken - Spotify access token
 * @param {number} limit - Number of items to return (default: 20, max: 50)
 * @returns {Promise<Object>} - Search results
 */
export async function search(query, type, accessToken, limit = 20) {
  try {
    const response = await spotifyAxios.get('/search', {
      params: {
        q: query,
        type,
        limit: Math.min(50, limit)
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error searching:', error.response?.data || error);
    throw error;
  }
}
