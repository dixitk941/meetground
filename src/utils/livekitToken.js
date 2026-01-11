// LiveKit Token Generation Utility
// 
// IMPORTANT: In production, token generation MUST be done server-side!
// This file provides instructions and a client-side demo only.
//
// For production, use one of these approaches:
// 1. Firebase Cloud Functions
// 2. Express/Node.js backend
// 3. LiveKit Cloud's token API (with server-side key storage)

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Sign up for LiveKit Cloud (free tier): https://cloud.livekit.io
 * 
 * 2. Get your credentials from the dashboard:
 *    - WebSocket URL (e.g., wss://your-project.livekit.cloud)
 *    - API Key
 *    - API Secret
 * 
 * 3. Add to your .env file:
 *    VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
 * 
 * 4. For development/testing, generate tokens using LiveKit CLI:
 *    npm install -g livekit-cli
 *    livekit-cli token create \
 *      --api-key YOUR_API_KEY \
 *      --api-secret YOUR_API_SECRET \
 *      --room ROOM_NAME \
 *      --identity USER_NAME \
 *      --valid-for 24h
 * 
 * 5. For production, set up a token endpoint:
 */

// Example Firebase Cloud Function for token generation:
/*
const functions = require('firebase-functions');
const { AccessToken } = require('livekit-server-sdk');

exports.generateLiveKitToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { roomName, participantName } = data;
  
  const apiKey = functions.config().livekit.api_key;
  const apiSecret = functions.config().livekit.api_secret;
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });
  
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return { token: at.toJwt() };
});
*/

// Example Express.js endpoint:
/*
const express = require('express');
const { AccessToken } = require('livekit-server-sdk');

const app = express();

app.post('/api/livekit/token', async (req, res) => {
  const { roomName, participantName } = req.body;
  
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });
  
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: at.toJwt() });
});
*/

// For development without a backend, you can temporarily store tokens
// generated from CLI in localStorage or use this demo function
// that connects without authentication (NOT FOR PRODUCTION)

export const DEV_INSTRUCTIONS = `
=== LiveKit Development Setup ===

1. Install LiveKit CLI:
   npm install -g livekit-cli

2. Generate a token for testing:
   livekit-cli token create \\
     --api-key <YOUR_API_KEY> \\
     --api-secret <YOUR_API_SECRET> \\
     --room test-room \\
     --identity test-user \\
     --valid-for 24h

3. Copy the token and use it in your .env:
   VITE_LIVEKIT_DEV_TOKEN=<GENERATED_TOKEN>

4. Or create a simple token server (see examples above)

=== Alternative: Use P2P Mode ===

If you don't want to set up LiveKit, the app will automatically
fall back to P2P WebRTC mode which works for up to 6-8 users.
`;

console.log(DEV_INSTRUCTIONS);
