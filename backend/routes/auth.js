// Modified backend/routes/auth.js

const express = require('express');
const axios = require('axios');
const qs = require('querystring');
require('dotenv').config();

const router = express.Router();

// Get environment variables
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_URL = 'http://127.0.0.1:5173'
} = process.env;

// Validate required environment variables
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
  console.error('Missing required environment variables for Spotify authentication!');
  console.error('Make sure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI are set in your .env file');
  process.exit(1);
}

/**
 * Redirect to Spotify authorization page
 */
router.get('/login', (req, res) => {
  // Define scopes - IMPORTANT: Include ALL necessary permissions
  // Adding more scopes to fix the 403 Forbidden errors
  const scope = [
    // User profile and account
    'user-read-private',
    'user-read-email',
    
    // Playback control
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    
    // History and data
    'user-read-recently-played',
    'user-read-playback-position',
    'user-top-read',
    
    // Library and playlists
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    
    // Required for audio features API access - critical for visualization
    'user-library-modify'   // ✅ ADDED THIS - provides broader access to track data
  ].join(' ');

  // Build authorization URL
  const params = qs.stringify({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    show_dialog: true // Force login dialog to ensure proper permissions
  });
  
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

/**
 * Handle callback from Spotify
 */
router.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const error = req.query.error || null;

  // If user denied access
  if (error) {
    return res.redirect(`${FRONTEND_URL}?error=access_denied&message=${error}`);
  }

  // Exchange code for tokens
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      qs.stringify({
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token, expires_in, scope } = response.data;

    console.log('Successfully exchanged code for tokens');
    
    // Make sure we're sending to the right domain and port
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
    
    // Redirect to frontend with tokens as URL parameters
    res.redirect(
      `${frontendUrl}?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}&scope=${encodeURIComponent(scope || '')}`
    );
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    
    // Provide more detailed error information
    const errorMsg = error.response?.data?.error_description || 
                     error.response?.data?.error || 
                     'authentication_failed';
    
    res.redirect(`${FRONTEND_URL}?error=authentication_failed&message=${encodeURIComponent(errorMsg)}`);
  }
});

/**
 * Refresh access token
 */
router.post('/refresh_token', async (req, res) => {
  const refresh_token = req.body.refresh_token;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      qs.stringify({
        grant_type: 'refresh_token',
        refresh_token
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );

    // Get all returned data including any new refresh token
    const { access_token, expires_in, refresh_token: new_refresh_token, scope } = response.data;
    
    // Return all data including potential new refresh token
    res.json({
      access_token,
      expires_in,
      refresh_token: new_refresh_token || refresh_token,
      scope
    });
  } catch (error) {
    console.error('Refresh token error:', error.response?.data || error.message);
    
    // Return detailed error for debugging
    res.status(401).json({ 
      error: 'Failed to refresh token', 
      details: error.response?.data || error.message
    });
  }
});

/**
 * Check token validity
 */
router.post('/validate_token', async (req, res) => {
  const { access_token } = req.body;
  
  if (!access_token) {
    return res.status(400).json({ error: 'Access token is required' });
  }
  
  try {
    // Test with a basic profile request
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    // If successful, token is valid
    res.json({ 
      valid: true, 
      user: {
        id: response.data.id,
        display_name: response.data.display_name,
        email: response.data.email,
        product: response.data.product // 'premium' or 'free'
      }
    });
  } catch (error) {
    console.error('Token validation error:', error.response?.data || error.message);
    
    // Token is invalid or expired
    res.json({ 
      valid: false, 
      error: error.response?.data?.error || 'Unknown error'
    });
  }
});

module.exports = router;
