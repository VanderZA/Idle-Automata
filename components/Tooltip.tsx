import React from 'react';

interface TooltipProps {
  visible: boolean;
  content: React.ReactNode;
  x: number;
  y: number;
}

const Tooltip: React.FC<TooltipProps> = ({ visible, content, x, y }) => {
  if (!visible || !content) return null;

  return (
    <div
      className="fixed z-50 p-3 bg-gray-950 border border-gray-600 rounded-lg shadow-xl text-sm text-gray-300 pointer-events-none"
      style={{ 
        left: x + 15, 
        top: y + 15,
        minWidth: '200px', 
        maxWidth: '350px',
        // Prevents the tooltip from flashing as the mouse moves over it
        transform: 'translateZ(0)',
      }}
    >
      {content}
    </div>
  );
};

export default Tooltip;
