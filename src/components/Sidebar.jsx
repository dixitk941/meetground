import { X } from 'lucide-react';

const Sidebar = ({ children, onClose }) => {
  return (
    <div className="w-80 bg-[#0a0a0a] border-l border-[#222222] flex flex-col h-full relative">
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors border border-[#222222]"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      {children}
    </div>
  );
};

export default Sidebar;
