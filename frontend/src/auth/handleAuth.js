// Modified auth/handleAuth.js to fix authentication issues

/**
 * Get access token from URL parameters or localStorage
 * @returns {string|null} - Spotify access token or null if not found
 */
export function getAccessTokenFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const expiresIn = urlParams.get('expires_in');
  const error = urlParams.get('error');
  const errorMessage = urlParams.get('message');

  // Handle error from authentication process
  if (error) {
    console.error(`Authentication error: ${error}`, errorMessage);
    showAuthErrorMessage(errorMessage || 'Failed to authenticate with Spotify');
    return null;
  }

  if (accessToken) {
    console.log('Access token received from URL');
    storeTokens(accessToken, refreshToken, expiresIn);
    cleanUrl();
    return accessToken;
  }

  // If we have a code but no access token, that's an error case
  // The code should be exchanged by the backend
  if (urlParams.get('code')) {
    console.error('Received code instead of access token - check backend redirect configuration');
    showAuthErrorMessage('Authentication process incomplete. Please try again.');
    return null;
  }

  return null; // Async fallback is handled in main.js
}

/**
 * Show authentication error message to user
 * @param {string} message - Error message to display
 */
function showAuthErrorMessage(message) {
  // Create simple error message in login screen if it exists
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'error-message';
      errorDiv.className = 'error-message';
      loginScreen.insertBefore(errorDiv, loginScreen.querySelector('#connect-button'));
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  } else {
    alert(`Authentication Error: ${message}`);
  }
}

/**
 * Store tokens in localStorage with expiration
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} expiresIn
 */
function storeTokens(accessToken, refreshToken, expiresIn) {
  if (!accessToken) return;

  const expirationTime = Date.now() + parseInt(expiresIn) * 1000;
  localStorage.setItem('spotify_access_token', accessToken);
  if (refreshToken) {
    localStorage.setItem('spotify_refresh_token', refreshToken);
  }
  localStorage.setItem('spotify_token_expiration', expirationTime.toString());
  localStorage.setItem(
    'spotify_token_scope',
    'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-recently-played user-read-playback-position'
  );
}

/**
 * Get stored access token if valid, refresh if expired
 * @returns {Promise<string|null>}
 */
export async function getStoredAccessToken() {
  const accessToken = localStorage.getItem('spotify_access_token');
  const expirationTime = localStorage.getItem('spotify_token_expiration');

  if (!accessToken || !expirationTime) {
    return null;
  }

  const now = Date.now();

  if (now > parseInt(expirationTime)) {
    console.log('Token expired, attempting to refresh...');
    const newToken = await refreshAccessToken();
    return newToken;
  }

  if (now > parseInt(expirationTime) - 300000) {
    console.log('Token expiring soon, refreshing in background...');
    refreshAccessToken(); // Non-blocking
  }

  return accessToken;
}

/**
 * Clean up URL to remove tokens
 */
function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  url.searchParams.delete('expires_in');
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

/**
 * Refresh access token using stored refresh token
 * @returns {Promise<string|null>}
 */
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');

  if (!refreshToken) {
    console.error('No refresh token available');
    clearTokens();
    return null;
  }

  try {
    // Use dynamic server URL based on current window location
    const baseUrl = window.location.hostname === 'localhost' ? 
      'http://localhost:8888' : 
      `${window.location.protocol}//${window.location.hostname}:8888`;
    
    const response = await fetch(`${baseUrl}/auth/refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access token in refresh response');
    }

    storeTokens(data.access_token, refreshToken, data.expires_in || '3600');
    console.log('Token refreshed successfully');
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);

    if (error.message && (error.message.includes('401') || error.message.includes('400'))) {
      clearTokens();
      redirectToLogin();
    }

    return null;
  }
}

/**
 * Clear all stored tokens
 */
export function clearTokens() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiration');
  localStorage.removeItem('spotify_token_scope');
}

/**
 * Check if user has a token (sync only)
 * @returns {boolean}
 */
export function isAuthenticated() {
  return localStorage.getItem('spotify_access_token') !== null;
}

/**
 * Redirect user to login page
 */
export function redirectToLogin() {
  try {
    // Generate the backend URL dynamically based on current frontend URL
    const serverUrl = new URL(window.location.href).origin.replace('5173', '8888');
    window.location.href = `${serverUrl}/auth/login`;
  } catch (error) {
    // Fallback to a default URL if something goes wrong with URL parsing
    console.warn('Error creating dynamic URL for login redirect:', error);
    
    // Fallback URL - try to determine based on hostname
    const baseUrl = window.location.hostname === 'localhost' ? 
      'http://localhost:8888' : 
      `${window.location.protocol}//${window.location.hostname}:8888`;
    
    window.location.href = `${baseUrl}/auth/login`;
  }
}

/**
 * Handle authentication errors
 * @param {Error} error
 */
export function handleAuthError(error) {
  console.error('Authentication error:', error);

  if (error.response && error.response.status === 403) {
    console.log('Permission error detected, clearing tokens and redirecting to login');
    clearTokens();
    redirectToLogin();
    return;
  }

  refreshAccessToken().then(token => {
    if (!token) {
      redirectToLogin();
    } else {
      window.location.reload();
    }
  });
}
