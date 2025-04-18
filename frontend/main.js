// Main entry point for the application
import './src/visualizer.css';
import { initVisualizer } from './src/three/index.js';
import { getAccessTokenFromUrl, getStoredAccessToken, redirectToLogin } from './src/auth/handleAuth.js';

// Define the Spotify callback globally if not already defined in index.html
if (typeof window.onSpotifyWebPlaybackSDKReady !== 'function') {
  window.onSpotifyWebPlaybackSDKReady = function () {
    console.log('Spotify Web Playback SDK is ready');
    if (window.spotifySDKCallback) {
      window.spotifySDKCallback();
    }
  };
}

window.onload = async () => {
  // First check for token in URL
  const accessToken = getAccessTokenFromUrl();

  if (accessToken) {
    showVisualizer(accessToken);
  } else {
    const storedToken = await getStoredAccessToken();
    if (storedToken) {
      showVisualizer(storedToken);
    } else {
      showLoginScreen();
    }
  }
};

/**
 * Show the visualizer and initialize it with the access token
 * @param {string} accessToken - Spotify access token
 */
function showVisualizer(accessToken) {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');

  if (loginScreen) loginScreen.style.display = 'none';
  if (app) app.style.display = 'block';

  const loading = document.createElement('div');
  loading.className = 'loading-spinner';
  document.body.appendChild(loading);

  initVisualizer(accessToken)
    .catch(error => {
      console.error('Error initializing visualizer:', error);
      document.body.removeChild(loading);
      showError('Failed to initialize visualizer. Please try again.');
    })
    .finally(() => {
      if (document.body.contains(loading)) {
        document.body.removeChild(loading);
      }
    });
}

/**
 * Show the login screen
 */
function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');

  if (loginScreen) loginScreen.style.display = 'flex';
  if (app) app.style.display = 'none';

  const connectButton = document.getElementById('connect-button');
  if (connectButton) {
    connectButton.addEventListener('click', () => {
      redirectToLogin();
    });
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  let errorOverlay = document.getElementById('error-overlay');

  if (!errorOverlay) {
    errorOverlay = document.createElement('div');
    errorOverlay.id = 'error-overlay';
    errorOverlay.innerHTML = `
      <div class="error-container">
        <h2>Error</h2>
        <p id="error-message"></p>
        <div class="error-buttons">
          <button id="error-retry">Retry</button>
          <button id="error-logout">Log Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(errorOverlay);

    document.getElementById('error-retry').addEventListener('click', () => {
      window.location.reload();
    });

    document.getElementById('error-logout').addEventListener('click', () => {
      localStorage.clear();
      window.location.href = '/';
    });
  }

  document.getElementById('error-message').textContent = message;
  errorOverlay.style.display = 'flex';
}
