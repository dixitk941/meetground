import { useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { 
  Mic, 
  MicOff,
  MonitorUp, 
  MessageSquare, 
  Shield, 
  Users, 
  Video,
  VideoOff,
  Search,
  ChevronDown,
  ChevronUp,
  UserX,
  Crown,
  Volume2,
  VolumeX
} from 'lucide-react';

const AdminPanel = () => {
  const { 
    meetingSettings, 
    updateMeetingSettings, 
    participants, 
    muteParticipant,
    setParticipantPermissions,
    removeParticipant,
    currentUserId
  } = useMeeting();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [showAllParticipants, setShowAllParticipants] = useState(false);

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

  const turnOffAllCameras = () => {
    participants
      .filter(p => !p.isAdmin && p.isCameraOn)
      .forEach(p => setParticipantPermissions?.(p.id, { cameraAllowed: false }));
  };

  const nonAdminParticipants = participants.filter(p => !p.isAdmin && p.id !== currentUserId);
  const filteredParticipants = nonAdminParticipants.filter(p =>
    p.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const displayedParticipants = showAllParticipants 
    ? filteredParticipants 
    : filteredParticipants.slice(0, 5);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Host Controls</h2>
            <p className="text-xs text-gray-500">Manage meeting & participants</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={muteAllParticipants}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors text-red-400 border border-red-500/20"
            >
              <VolumeX className="w-4 h-4" />
              <span className="text-xs font-medium">Mute All</span>
            </button>
            <button
              onClick={turnOffAllCameras}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors text-red-400 border border-red-500/20"
            >
              <VideoOff className="w-4 h-4" />
              <span className="text-xs font-medium">Cameras Off</span>
            </button>
          </div>
        </div>

        {/* Global Permissions */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1 uppercase tracking-wider">
            Global Permissions
          </h3>
          
          <PermissionToggle
            icon={<Mic className="w-4 h-4" />}
            label="Allow Unmute"
            description="Participants can turn on mic"
            enabled={meetingSettings?.allowParticipantMic}
            onToggle={() => toggleSetting('allowParticipantMic')}
          />

          <PermissionToggle
            icon={<Video className="w-4 h-4" />}
            label="Allow Video"
            description="Participants can turn on camera"
            enabled={meetingSettings?.allowParticipantVideo !== false}
            onToggle={() => toggleSetting('allowParticipantVideo')}
          />

          <PermissionToggle
            icon={<MonitorUp className="w-4 h-4" />}
            label="Allow Screen Share"
            description="Participants can share screen"
            enabled={meetingSettings?.allowParticipantScreen}
            onToggle={() => toggleSetting('allowParticipantScreen')}
          />

          <PermissionToggle
            icon={<MessageSquare className="w-4 h-4" />}
            label="Allow Chat"
            description="Participants can send messages"
            enabled={meetingSettings?.allowParticipantChat}
            onToggle={() => toggleSetting('allowParticipantChat')}
          />
        </div>

        {/* Individual Participant Controls */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1 uppercase tracking-wider">
            Participant Controls
          </h3>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search participants..."
              className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#222222] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#333333]"
            />
          </div>

          {/* Participant List */}
          <div className="space-y-2">
            {displayedParticipants.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                {searchQuery ? 'No participants found' : 'No other participants yet'}
              </p>
            ) : (
              displayedParticipants.map((participant) => (
                <ParticipantControl
                  key={participant.id}
                  participant={participant}
                  isExpanded={expandedParticipant === participant.id}
                  onToggleExpand={() => setExpandedParticipant(
                    expandedParticipant === participant.id ? null : participant.id
                  )}
                  onMute={() => muteParticipant(participant.id)}
                  onSetPermissions={(perms) => setParticipantPermissions?.(participant.id, perms)}
                  onRemove={() => removeParticipant?.(participant.id)}
                />
              ))
            )}
          </div>

          {/* Show More/Less */}
          {filteredParticipants.length > 5 && (
            <button
              onClick={() => setShowAllParticipants(!showAllParticipants)}
              className="w-full flex items-center justify-center gap-2 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              {showAllParticipants ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show {filteredParticipants.length - 5} More
                </>
              )}
            </button>
          )}
        </div>

        {/* Meeting Stats */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1 uppercase tracking-wider">
            Meeting Stats
          </h3>
          <div className="bg-[#111111] rounded-xl p-3 space-y-3 border border-[#222222]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400 text-sm">Total Participants</span>
              </div>
              <span className="text-white font-medium">{participants.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-400 text-sm">Mics Active</span>
              </div>
              <span className="text-white font-medium">
                {participants.filter(p => p.isMicOn).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-gray-400 text-sm">Cameras Active</span>
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
  <div className="flex items-center justify-between p-3 bg-[#111111] rounded-xl border border-[#222222]">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${enabled ? 'text-green-500 bg-green-500/10' : 'text-gray-500 bg-gray-500/10'}`}>
        {icon}
      </div>
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-gray-500 text-xs">{description}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-green-500' : 'bg-[#333333]'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full transition-all bg-white shadow-sm ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

const ParticipantControl = ({ 
  participant, 
  isExpanded, 
  onToggleExpand, 
  onMute,
  onSetPermissions,
  onRemove 
}) => {
  return (
    <div className="bg-[#111111] rounded-xl border border-[#222222] overflow-hidden">
      {/* Main Row */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#222222] flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {(participant.displayName || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-medium truncate max-w-[120px]">
              {participant.displayName}
            </p>
            <div className="flex items-center gap-2">
              {participant.isMicOn ? (
                <Mic className="w-3 h-3 text-green-500" />
              ) : (
                <MicOff className="w-3 h-3 text-gray-500" />
              )}
              {participant.isCameraOn ? (
                <Video className="w-3 h-3 text-green-500" />
              ) : (
                <VideoOff className="w-3 h-3 text-gray-500" />
              )}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[#222222]">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onMute}
              disabled={!participant.isMicOn}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222222] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <MicOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-white">Mute</span>
            </button>
            <button
              onClick={() => onSetPermissions?.({ micAllowed: !participant.micAllowed })}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                participant.micAllowed !== false
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {participant.micAllowed !== false ? (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-xs">Mic On</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span className="text-xs">Mic Off</span>
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSetPermissions?.({ videoAllowed: !participant.videoAllowed })}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                participant.videoAllowed !== false
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {participant.videoAllowed !== false ? (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span className="text-xs">Video On</span>
                </>
              ) : (
                <>
                  <VideoOff className="w-3.5 h-3.5" />
                  <span className="text-xs">Video Off</span>
                </>
              )}
            </button>
            <button
              onClick={onRemove}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
            >
              <UserX className="w-3.5 h-3.5" />
              <span className="text-xs">Remove</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
