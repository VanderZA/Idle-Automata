
import React from 'react';

interface ProgressBarProps {
  progress: number;
  text?: string;
  bgColor?: string;
  fillColor?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  text,
  bgColor = 'bg-gray-700',
  fillColor = 'bg-green-500',
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full ${bgColor} rounded-full h-6 relative overflow-hidden shadow-inner`}>
      <div
        className={`${fillColor} h-6 rounded-full transition-all duration-100 ease-linear`}
        style={{ width: `${clampedProgress}%` }}
      ></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-medium text-white mix-blend-difference">{text || `${clampedProgress.toFixed(0)}%`}</span>
      </div>
    </div>
  );
};

export default ProgressBar;
