import { useState, useMemo } from 'react';
import { X } from 'lucide-react';

interface Reaction {
  emoji: string;
  userId: string;
  userName?: string;
}

interface ReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: Reaction[];
  currentUserId: string;
  onRemoveReaction: (emoji: string) => void;
}

export function ReactionsModal({
  isOpen,
  onClose,
  reactions,
  currentUserId,
  onRemoveReaction,
}: ReactionsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  // Aggregate reactions by emoji
  const aggregated = useMemo(() => {
    const counts = reactions.reduce((acc, rx) => {
      acc[rx.emoji] = (acc[rx.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort((a, b) => b[1] - a[1]); // Sort by count descending
  }, [reactions]);

  // Filter reactions based on active tab
  const displayedReactions = useMemo(() => {
    if (activeTab === 'all') return reactions;
    return reactions.filter(rx => rx.emoji === activeTab);
  }, [reactions, activeTab]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div 
        className="absolute left-0 top-full mt-2 z-50 bg-gray-900 rounded-xl shadow-2xl w-full sm:w-[320px] max-w-[90vw] border border-gray-800/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <h2 className="text-gray-200 font-semibold">{reactions.length} reactions</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors rounded-full p-1 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-2 pt-2 border-b border-gray-700/50 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-t-lg'
            }`}
          >
            All
          </button>
          
          {aggregated.map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => setActiveTab(emoji)}
              className={`flex items-center space-x-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === emoji
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-t-lg'
              }`}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>

        {/* User List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {displayedReactions.map((rx, idx) => {
            const isMe = rx.userId === currentUserId;
            
            return (
              <div 
                key={`${rx.userId}-${rx.emoji}-${idx}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-md bg-gradient-to-br from-gray-700 to-gray-500 flex items-center justify-center text-white font-bold shadow-md border border-gray-800 flex-shrink-0">
                    {(rx.userName?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-200 font-medium">
                      {isMe ? 'You' : (rx.userName || 'Unknown User')}
                    </span>
                    {isMe && (
                      <button 
                        onClick={() => onRemoveReaction(rx.emoji)}
                        className="text-xs text-gray-500 hover:text-red-400 text-left transition-colors"
                      >
                        Click to remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xl">
                  {rx.emoji}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
