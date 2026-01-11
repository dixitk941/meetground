import { useMeeting } from '../context/MeetingContext';
import { Mic, MonitorUp, MessageSquare, Shield, Users, Video, Zap } from 'lucide-react';

const AdminPanel = () => {
  const { meetingSettings, updateMeetingSettings, participants, muteParticipant } = useMeeting();

  const toggleSetting = (setting) => {
    updateMeetingSettings({
      ...meetingSettings,
      [setting]: !meetingSettings[setting],
    });
  };

  const muteAllParticipants = () => {
    participants
      .filter(p => !p.isAdmin && p.isMicOn)
      .forEach(p => muteParticipant(p.id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#222222] flex items-center justify-center">
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Host Controls</h2>
            <p className="text-xs text-gray-500">Manage permissions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1">
            Quick Actions
          </h3>
          <button
            onClick={muteAllParticipants}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#111111] hover:bg-[#1a1a1a] rounded-lg transition-colors text-white border border-[#222222]"
          >
            <Mic className="w-4 h-4 text-red-500" />
            <span className="text-sm">Mute all participants</span>
          </button>
        </div>

        {/* Participant Permissions */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1">
            Permissions
          </h3>
          
          <PermissionToggle
            icon={<Mic className="w-4 h-4" />}
            label="Allow unmute"
            description="Participants can turn on mic"
            enabled={meetingSettings?.allowParticipantMic}
            onToggle={() => toggleSetting('allowParticipantMic')}
          />

          <PermissionToggle
            icon={<MonitorUp className="w-4 h-4" />}
            label="Allow screen share"
            description="Participants can share screen"
            enabled={meetingSettings?.allowParticipantScreen}
            onToggle={() => toggleSetting('allowParticipantScreen')}
          />

          <PermissionToggle
            icon={<MessageSquare className="w-4 h-4" />}
            label="Allow chat"
            description="Participants can send messages"
            enabled={meetingSettings?.allowParticipantChat}
            onToggle={() => toggleSetting('allowParticipantChat')}
          />
        </div>

        {/* Meeting Info */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1">
            Stats
          </h3>
          <div className="bg-[#111111] rounded-lg p-3 space-y-3 border border-[#222222]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400 text-sm">Participants</span>
              </div>
              <span className="text-white font-medium">{participants.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400 text-sm">Mics on</span>
              </div>
              <span className="text-white font-medium">
                {participants.filter(p => p.isMicOn).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400 text-sm">Cameras on</span>
              </div>
              <span className="text-white font-medium">
                {participants.filter(p => p.isCameraOn).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PermissionToggle = ({ icon, label, description, enabled, onToggle }) => (
  <div className="flex items-center justify-between p-3 bg-[#111111] rounded-lg border border-[#222222]">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${enabled ? 'text-green-500' : 'text-gray-500'}`}>
        {icon}
      </div>
      <div>
        <p className="text-white text-sm">{label}</p>
        <p className="text-gray-600 text-xs">{description}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        enabled ? 'bg-white' : 'bg-[#333333]'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
          enabled ? 'translate-x-5 bg-black' : 'translate-x-1 bg-gray-500'
        }`}
      />
    </button>
  </div>
);

export default AdminPanel;
