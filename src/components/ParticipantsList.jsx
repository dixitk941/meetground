import { Mic, MicOff, Video, VideoOff, Shield, MoreVertical, Users } from 'lucide-react';
import { useState } from 'react';
import { useMeeting } from '../context/MeetingContext';

const ParticipantsList = ({ participants, isAdmin }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Participants</h2>
            <p className="text-xs text-gray-500">{participants.length} in meeting</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {participants.map((participant) => (
          <ParticipantItem 
            key={participant.id} 
            participant={participant} 
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
};

const ParticipantItem = ({ participant, isAdmin }) => {
  const [showMenu, setShowMenu] = useState(false);
  const { muteParticipant } = useMeeting();

  const handleMuteParticipant = () => {
    muteParticipant(participant.id);
    setShowMenu(false);
  };

  return (
    <div className="flex items-center justify-between p-3 hover:bg-[#111111] rounded-lg transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
          <span className="text-sm font-medium text-white">
            {(participant.displayName || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">{participant.displayName}</span>
            {participant.isAdmin && (
              <span className="text-xs text-gray-500 flex items-center gap-1 px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#222222]">
                <Shield className="w-2.5 h-2.5" />
                Host
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className={`p-1.5 rounded ${participant.isMicOn ? 'text-green-500' : 'text-red-500'}`}>
            {participant.isMicOn ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5" />
            )}
          </div>
          <div className={`p-1.5 rounded ${participant.isCameraOn ? 'text-green-500' : 'text-red-500'}`}>
            {participant.isCameraOn ? (
              <Video className="w-3.5 h-3.5" />
            ) : (
              <VideoOff className="w-3.5 h-3.5" />
            )}
          </div>
        </div>

        {isAdmin && !participant.isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-[#222222] rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl py-1 min-w-[140px] z-50">
                  <button
                    onClick={handleMuteParticipant}
                    className="w-full flex items-center gap-2 px-3 py-2 text-white text-xs hover:bg-[#1a1a1a] transition-colors"
                  >
                    <MicOff className="w-3.5 h-3.5 text-red-500" />
                    Mute Participant
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;
