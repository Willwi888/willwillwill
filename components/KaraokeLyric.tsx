import React from 'react';

interface KaraokeLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  isPlaying: boolean;
  style?: React.CSSProperties;
  activeColor?: string;
  inactiveColor?: string;
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({ 
  text, 
  startTime, 
  endTime, 
  currentTime, 
  isPlaying, 
  style,
  activeColor = '#FFFFFF',
  inactiveColor = '#9ca3af' 
}) => {
  const duration = (endTime - startTime) * 1000;
  // Negative delay makes the animation jump to the correct progress if we start mid-lyric
  const delay = (startTime - currentTime) * 1000;

  const animationStyle: React.CSSProperties = {
    ...style,
    backgroundImage: `linear-gradient(to right, ${activeColor} 50%, ${inactiveColor} 50%)`,
    backgroundSize: '200% 100%',
    backgroundPosition: '100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animation: `karaoke-highlight ${Math.max(0, duration)}ms linear ${delay}ms forwards`,
    animationPlayState: isPlaying ? 'running' : 'paused',
  };

  return (
    <>
      <style>
        {`
          @keyframes karaoke-highlight {
            from { background-position: 100%; }
            to { background-position: 0%; }
          }
        `}
      </style>
      <p style={animationStyle} className="text-center font-bold drop-shadow-lg tracking-wide">
        {text}
      </p>
    </>
  );
};

export default KaraokeLyric;