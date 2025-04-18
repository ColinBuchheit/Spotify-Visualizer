const qs = require('querystring');
const axios = require('axios');

function getSpotifyAuthHeader(client_id, client_secret) {
  return {
    Authorization:
      'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

async function exchangeCodeForToken(code, redirect_uri, client_id, client_secret) {
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    qs.stringify({
      code,
      redirect_uri,
      grant_type: 'authorization_code'
    }),
    {
      headers: getSpotifyAuthHeader(client_id, client_secret)
    }
  );
  return response.data;
}

module.exports = { exchangeCodeForToken, getSpotifyAuthHeader };
