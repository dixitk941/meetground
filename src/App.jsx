import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MeetingProvider } from './context/MeetingContext';
import { UnifiedMeetingProvider } from './context/UnifiedMeetingContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Meeting from './pages/Meeting';
import './index.css';

// Set to true to use the new unified provider with SFU support
const USE_UNIFIED_PROVIDER = false;

function App() {
  const Provider = USE_UNIFIED_PROVIDER ? UnifiedMeetingProvider : MeetingProvider;
  
  return (
    <AuthProvider>
      <Provider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby/:meetingId?" element={<Lobby />} />
            <Route path="/meeting/:meetingId" element={<Meeting />} />
          </Routes>
        </BrowserRouter>
      </Provider>
    </AuthProvider>
  );
}

export default App;
