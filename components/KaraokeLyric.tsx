import React, { useMemo } from 'react';
import { ColorPalette } from '../styles/colors';

interface KaraokeLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  colorPalette: ColorPalette;
  isPlaying: boolean; 
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({ text, startTime, endTime, currentTime, colorPalette, isPlaying }) => {
  const words = useMemo(() => text.split(/(\s+)/), [text]); // Keep spaces for layout
  const lineDuration = endTime - startTime;

  // Calculate overall progress for the line
  const lineProgress = lineDuration > 0 
    ? Math.max(0, Math.min(1, (currentTime - startTime) / lineDuration)) 
    : (currentTime >= endTime ? 1 : 0);

  // Count only non-space words for timing calculation
  const nonSpaceWordsCount = useMemo(() => words.filter(w => w.trim() !== '').length, [words]);
  
  let wordCounter = 0;

  return (
    <>
      <style>{`
        .karaoke-word-wrapper {
          position: relative;
          display: inline-block;
          white-space: pre; /* Render spaces correctly */
        }
        .karaoke-word-highlight {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          overflow: hidden;
          white-space: pre;
          transition: width ${isPlaying ? '0.05s linear' : '0s'};
        }
      `}</style>
      <div>
        {words.map((word, index) => {
          const isSpace = word.trim() === '';
          // Increment word counter only for actual words
          if (!isSpace) {
            wordCounter++;
          }

          // Don't try to time empty words
          if (nonSpaceWordsCount === 0) {
              return <span key={index}>{word}</span>;
          }

          const wordStartProgress = (wordCounter - 1) / nonSpaceWordsCount;
          const wordEndProgress = wordCounter / nonSpaceWordsCount;

          let highlightWidth = '0%';
          if (lineProgress >= wordEndProgress) {
            highlightWidth = '100%';
          } else if (lineProgress > wordStartProgress) {
            const progressIntoWord = (lineProgress - wordStartProgress) / (wordEndProgress - wordStartProgress);
            highlightWidth = `${progressIntoWord * 100}%`;
          }

          return (
            <span key={index} className="karaoke-word-wrapper" style={{ color: colorPalette.base }}>
              <span className="karaoke-word-highlight" style={{ width: highlightWidth, color: colorPalette.highlight }}>
                {word}
              </span>
              {word}
            </span>
          );
        })}
      </div>
    </>
  );
};

export default KaraokeLyric;
