// frontend/src/ui/ErrorOverlay.js
import { clearTokens, redirectToLogin } from '../auth/handleAuth.js';

export function createErrorOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'error-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div class="error-container">
        <h2>Something went wrong</h2>
        <p id="error-message"></p>
        <div class="error-buttons">
          <button id="error-retry">Retry</button>
          <button id="error-reauthenticate">Re-authenticate</button>
          <button id="error-disconnect">Disconnect</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('error-retry').addEventListener('click', () => {
      window.location.reload();
    });
    
    document.getElementById('error-reauthenticate').addEventListener('click', () => {
      // Clear tokens and redirect to login for re-authentication
      clearTokens();
      redirectToLogin();
    });
    
    document.getElementById('error-disconnect').addEventListener('click', () => {
      window.location.href = '/';
    });
    
    return {
      show: (message) => {
        document.getElementById('error-message').textContent = message;
        overlay.style.display = '';
      },
      hide: () => {
        overlay.style.display = 'none';
      }
    };
}

/**
 * Show a message to the user that disappears after a timeout
 * @param {string} message - Message to display
 * @param {number} timeout - Timeout in ms (default: 3000)
 */
export function showMessage(message, timeout = 3000) {
    // Check if there's an existing message
    let messageElement = document.getElementById('toast-message');
    
    if (!messageElement) {
      // Create message element if it doesn't exist
      messageElement = document.createElement('div');
      messageElement.id = 'toast-message';
      messageElement.className = 'toast-message';
      document.body.appendChild(messageElement);
    }
    
    // Set message text
    messageElement.textContent = message;
    
    // Add visible class
    messageElement.classList.add('visible');
    
    // Clear any existing timeout
    if (messageElement.timeoutId) {
      clearTimeout(messageElement.timeoutId);
    }
    
    // Set timeout to hide message
    messageElement.timeoutId = setTimeout(() => {
      messageElement.classList.remove('visible');
    }, timeout);
}

/**
 * Create and show a re-authentication dialog
 * Allows users to reconnect their Spotify account with new permissions
 */
export function showReauthPrompt() {
    const overlay = document.createElement('div');
    overlay.className = 'reauth-overlay';
    overlay.innerHTML = `
      <div class="reauth-container">
        <h2>Re-authentication Required</h2>
        <p>Spotify visualization features require additional permissions.</p>
        <p>Please reconnect your Spotify account to enable all features.</p>
        <div class="reauth-buttons">
          <button id="reauth-button">Reconnect Spotify</button>
          <button id="reauth-cancel">Not Now</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('reauth-button').addEventListener('click', () => {
      // Clear existing tokens and redirect to login
      clearTokens();
      redirectToLogin();
    });
    
    document.getElementById('reauth-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    return overlay;
}
