# MeetGround - Online Meeting Platform

A modern video conferencing application built with React, Vite, and TailwindCSS. Features include built-in whiteboard, code playground, meeting recording, and admin controls - inspired by Google Meet.

## ✨ Features

### 🎥 Video Conferencing
- High-quality video and audio calls
- Screen sharing capability
- Adaptive video grid layout (supports up to 6 participants in view)

### 🎨 Built-in Whiteboard
- Real-time collaborative whiteboard powered by Excalidraw
- Draw, sketch, and illustrate ideas together
- Admin-controlled editing (participants view only)

### 💻 Code Playground
- Monaco Editor integration (VS Code-like experience)
- Support for 14+ programming languages
- Real-time code sharing
- JavaScript code execution in browser

### 🔴 Meeting Recording
- Record meetings with audio
- Screen recording with mixed audio streams
- Automatic download as WebM file

### 👑 Admin Controls
- Host can control participant permissions
- Mute individual participants or all at once
- Toggle screen sharing permissions
- Enable/disable chat functionality

### 💬 In-meeting Chat
- Real-time messaging during meetings
- Messages visible only to meeting participants
- Persistent chat history for the duration of the meeting

### 🔗 Sharable Link System
- Generate unique meeting IDs
- Share links for easy joining
- Copy link with one click

## 🛠 Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: TailwindCSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Whiteboard**: Excalidraw
- **Code Editor**: Monaco Editor
- **Icons**: Lucide React
- **Recording**: RecordRTC + MediaRecorder API

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/meetground.git
cd meetground
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Anonymous + Google Sign-in)
   - Create a Firestore database
   - Copy your Firebase config

4. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

5. Start the development server:
```bash
npm run dev
```

6. Open http://localhost:5173 in your browser

## 🔥 Firebase Setup

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /meetings/{meetingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
      
      match /participants/{participantId} {
        allow read, write: if request.auth != null;
      }
      
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### Authentication Setup

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable:
   - Anonymous authentication
   - Google Sign-in

## 📁 Project Structure

```
meetground/
├── public/
├── src/
│   ├── components/
│   │   ├── AdminPanel.jsx      # Admin controls panel
│   │   ├── ChatPanel.jsx       # In-meeting chat
│   │   ├── CodePlayground.jsx  # Code editor component
│   │   ├── MeetingControls.jsx # Bottom control bar
│   │   ├── ParticipantsList.jsx # Participants sidebar
│   │   ├── RecordingIndicator.jsx # Recording status
│   │   ├── Sidebar.jsx         # Sidebar wrapper
│   │   ├── VideoGrid.jsx       # Video tiles grid
│   │   └── Whiteboard.jsx      # Excalidraw whiteboard
│   ├── config/
│   │   └── firebase.js         # Firebase configuration
│   ├── context/
│   │   ├── AuthContext.jsx     # Authentication state
│   │   └── MeetingContext.jsx  # Meeting state management
│   ├── pages/
│   │   ├── Home.jsx            # Landing page
│   │   ├── Lobby.jsx           # Pre-meeting lobby
│   │   └── Meeting.jsx         # Main meeting room
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

## 📖 Usage Guide

### Starting a Meeting

1. Click "New meeting" on the home page
2. Enter your name (or sign in with Google)
3. Configure your camera and microphone in the lobby
4. Click "Start meeting" to begin

### Joining a Meeting

1. Enter the meeting code/link on the home page
2. Click "Join" or navigate directly to the meeting link
3. Configure your media settings in the lobby
4. Click "Join now"

### Host Controls

As a meeting host, you can:
- Switch between Video, Whiteboard, and Code views
- Control participant microphone permissions
- Allow/disallow screen sharing
- Mute individual participants
- Manage chat permissions

### Recording a Meeting

1. Click the recording button in the control bar
2. Select the screen/window to record
3. Recording indicator shows elapsed time
4. Click stop to end and download the recording

## 🌐 Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Meet](https://meet.google.com) - Design inspiration
- [Excalidraw](https://excalidraw.com) - Whiteboard functionality
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Lucide Icons](https://lucide.dev) - Beautiful icons

---

Built with ❤️ using React + Vite + TailwindCSS
