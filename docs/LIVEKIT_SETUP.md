# LiveKit SFU Setup Guide for MeetGround

This guide explains how to enable SFU (Selective Forwarding Unit) mode in MeetGround to support **100+ participants** in meetings.

## Quick Comparison

| Feature | P2P Mode (Default) | SFU Mode (LiveKit) |
|---------|-------------------|-------------------|
| Max Participants | 6-8 | 100+ |
| Setup Complexity | None | Moderate |
| Server Required | No | Yes (LiveKit) |
| Cost | Free | Free tier available |
| Latency | Lower (direct) | Slightly higher |

## Setup Steps

### 1. Sign Up for LiveKit Cloud (Free Tier)

1. Go to [https://cloud.livekit.io](https://cloud.livekit.io)
2. Create a free account
3. Create a new project
4. Note down your:
   - **WebSocket URL**: `wss://your-project.livekit.cloud`
   - **API Key**: `APIxxxxxxxx`
   - **API Secret**: `xxxxxxxxxxxxxxx`

### 2. Configure Environment Variables

Create or update `.env` in your project root:

```env
# LiveKit Configuration
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud

# Enable SFU mode (change from 'p2p' to 'sfu')
VITE_MEETING_MODE=sfu
```

### 3. Set Up Token Generation Server

LiveKit requires secure tokens for authentication. You have two options:

#### Option A: Firebase Cloud Functions (Recommended)

1. Install Firebase Functions:
```bash
npm install -g firebase-tools
firebase init functions
```

2. Install LiveKit SDK in functions:
```bash
cd functions
npm install livekit-server-sdk
```

3. Create `functions/index.js`:
```javascript
const functions = require('firebase-functions');
const { AccessToken } = require('livekit-server-sdk');

exports.getLiveKitToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { roomName, participantName } = data;
  
  // Get these from Firebase Config or environment
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    ttl: '10h', // Token valid for 10 hours
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
```

4. Set config variables:
```bash
firebase functions:config:set livekit.api_key="YOUR_API_KEY"
firebase functions:config:set livekit.api_secret="YOUR_API_SECRET"
```

5. Deploy:
```bash
firebase deploy --only functions
```

#### Option B: Express.js Backend

Create a simple token server:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

app.post('/api/token', (req, res) => {
  const { roomName, participantName } = req.body;
  
  const at = new AccessToken(API_KEY, API_SECRET, {
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

app.listen(3001, () => {
  console.log('Token server running on port 3001');
});
```

### 4. Update Your App to Use Tokens

In your Meeting page, before joining a room:

```javascript
// Get token from your backend
const response = await fetch('/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    roomName: meetingId,
    participantName: user.displayName,
  }),
});
const { token } = await response.json();

// Connect to LiveKit
await connectToLiveKit(token);
```

### 5. Enable SFU Mode

In `src/App.jsx`, set the flag:

```javascript
// Set to true to use the new unified provider with SFU support
const USE_UNIFIED_PROVIDER = true;
```

## Development Testing Without Backend

For quick testing, you can generate tokens using the LiveKit CLI:

```bash
# Install CLI
npm install -g livekit-cli

# Generate a token
livekit-cli token create \
  --api-key YOUR_API_KEY \
  --api-secret YOUR_API_SECRET \
  --room test-meeting-123 \
  --identity test-user \
  --valid-for 24h
```

Then temporarily hardcode the token in your app for testing.

## Self-Hosting LiveKit (Advanced)

If you prefer to self-host instead of using LiveKit Cloud:

```bash
# Using Docker
docker run -d \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server

# Your WebSocket URL would be ws://localhost:7880
```

## Troubleshooting

### Connection fails
- Check that your LiveKit URL includes `wss://` protocol
- Verify your API key and secret are correct
- Ensure your token hasn't expired

### No video/audio
- Make sure `canPublish: true` is in your token grant
- Check browser permissions for camera/microphone
- Verify LiveKit room events are being received (check console)

### Fallback to P2P
If LiveKit connection fails, the app automatically falls back to P2P mode for small meetings.

## Resources

- [LiveKit Documentation](https://docs.livekit.io)
- [LiveKit React Components](https://docs.livekit.io/realtime/client/react/)
- [LiveKit Cloud Dashboard](https://cloud.livekit.io)
