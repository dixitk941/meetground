import { CircleDot } from 'lucide-react';

const RecordingIndicator = ({ time }) => {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      <span className="text-sm text-white font-medium">
        REC {formatTime(time)}
      </span>
    </div>
  );
};

export default RecordingIndicator;
