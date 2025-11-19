import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import MusicIcon from './icons/MusicIcon';
import KaraokeLyric from './KaraokeLyric';
import ExportIcon from './icons/ExportIcon';

// Declare FFmpeg for TypeScript since it's loaded from a script tag
declare const FFmpeg: any;


interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  songTitle: string;
  artistName: string;
  onBack: () => void;
}

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
  { name: '日文黑體', value: "'Noto Sans JP', sans-serif" },
  { name: '韓文黑體', value: "'Noto Sans KR', sans-serif" },
];

const fontWeights = [
  { name: '細體 (300)', value: '300' },
  { name: '正常 (400)', value: '400' },
  { name: '中等 (500)', value: '500' },
  { name: '半粗體 (600)', value: '600' },
  { name: '粗體 (700)', value: '700' },
  { name: '特粗體 (800)', value: '800' },
  { name: '極粗體 (900)', value: '900' },
];

const resolutions: { [key: string]: { width: number; height: number } } = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const colorThemes: { [key: string]: { name: string; active: string; inactive1: string; inactive2: string; info: string; subInfo: string; } } = {
  light: {
    name: '明亮',
    active: '#FFFFFF',
    inactive1: '#E5E7EB',
    inactive2: '#D1D5DB',
    info: '#FFFFFF',
    subInfo: '#E5E7EB',
  },
  dark: {
    name: '深邃',
    active: '#1F2937',
    inactive1: '#4B5563',
    inactive2: '#6B7280',
    info: '#1F2937',
    subInfo: '#4B5563',
  },
  colorized: {
    name: '多彩',
    active: '#FBBF24', // Amber 400
    inactive1: '#FFFFFF',
    inactive2: '#E5E7EB',
    info: '#FBBF24',
    subInfo: '#FFFFFF',
  },
  sunset: {
    name: '日落',
    active: '#FDBA74', // Orange 300
    inactive1: '#FED7AA', // Orange 200
    inactive2: '#FFEDD5', // Orange 100
    info: '#FDBA74',
    subInfo: '#FED7AA',
  },
  ocean: {
    name: '海洋',
    active: '#7DD3FC', // Sky 300
    inactive1: '#BAE6FD', // Sky 200
    inactive2: '#E0F2FE', // Sky 100
    info: '#7DD3FC',
    subInfo: '#BAE6FD',
  },
  neon: {
    name: '霓虹',
    active: '#EC4899', // Pink 500
    inactive1: '#F9A8D4', // Pink 300
    inactive2: '#FBCFE8', // Pink 200
    info: '#EC4899',
    subInfo: '#F9A8D4',
  },
  sakura: {
    name: '櫻花',
    active: '#F9A8D4', // Pink 300
    inactive1: '#FBCFE8', // Pink 200
    inactive2: '#FCE7F3', // Pink 100
    info: '#F9A8D4',
    subInfo: '#FBCFE8',
  },
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number; details?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontWeight, setFontWeight] = useState<string>('700'); // Default bold
  const [strokeColor, setStrokeColor] = useState<string>('#000000'); // Default black
  const [strokeWidth, setStrokeWidth] = useState<number>(0); // Default no stroke
  const [colorTheme, setColorTheme] = useState('light');
  const [resolution, setResolution] = useState('720p');
  const [includeAlbumArt, setIncludeAlbumArt] = useState(true);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const isExportCancelled = useRef(false);
  const [albumArtSize, setAlbumArtSize] = useState(38); // percent of height
  const [albumArtPosition, setAlbumArtPosition] = useState<'left' | 'right'>('right');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);

  const lyricsToRender = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return [];
    // Add dummy lyrics at the start and end to ensure a 5-line display is always possible
    return [
      { text: '', startTime: -1, endTime: 0 }, // Dummy for pos -2
      { text: '', startTime: -1, endTime: 0 }, // Dummy for pos -1
      ...timedLyrics,
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy for pos +1
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy for pos +2
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy for pos +3
    ];
  }, [timedLyrics]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const animate = () => {
      setCurrentTime(audio.currentTime);
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      setCurrentTime(audio.currentTime); // Update time when pausing
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const endedHandler = () => {
      setIsPlaying(false);
      setIsEnded(true);
      setCurrentTime(audio.duration || 0); // Ensure currentTime is at the end
    };
    
    const handleScrubbing = () => {
      if (audio.paused) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener('ended', endedHandler);
    audio.addEventListener('timeupdate', handleScrubbing);

    return () => {
      audio.removeEventListener('ended', endedHandler);
      audio.removeEventListener('timeupdate', handleScrubbing);
    };
  }, []);

  // Effect to clean up the persistent AudioContext on component unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        mediaElementSourceRef.current?.disconnect();
        audioContextRef.current.close();
      }
    };
  }, []);
  
  const lastStartedLyricIndex = useMemo(() =>
    timedLyrics.findLastIndex(
      (lyric) => currentTime >= lyric.startTime
    ),
    [currentTime, timedLyrics]
  );

  const currentIndex = useMemo(() => {
    if (lastStartedLyricIndex === -1) {
        return 1;
    }
    // The index in lyricsToRender is the timedLyrics index + 2 (for the dummies).
    return lastStartedLyricIndex + 2;
  }, [lastStartedLyricIndex]);

  const transitionProgress = useMemo(() => {
    if (lastStartedLyricIndex < 0 || lastStartedLyricIndex >= timedLyrics.length - 1) {
      return 0;
    }

    const currentLyric = timedLyrics[lastStartedLyricIndex];
    const nextLyric = timedLyrics[lastStartedLyricIndex + 1];
    
    const transitionDuration = nextLyric.startTime - currentLyric.startTime;
    if (transitionDuration <= 0) {
      return 0;
    }
    
    const timeIntoTransition = currentTime - currentLyric.startTime;
    const progress = Math.min(1, Math.max(0, timeIntoTransition / transitionDuration));

    // ease-in-out-cubic for smoother animation
    return progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }, [lastStartedLyricIndex, currentTime, timedLyrics]);

  const currentTheme = colorThemes[colorTheme];
  
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!hasPlaybackStarted) {
      setHasPlaybackStarted(true);
    }

    if (audio.paused) {
      if (isEnded) {
        audio.currentTime = 0;
        setIsEnded(false);
      }
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [isEnded, hasPlaybackStarted]);
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = parseFloat(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (isEnded) setIsEnded(false);
    }
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
    setExportProgress(prev => prev ? { ...prev, message: '正在取消...', details: '請稍候，完成當前任務後將會停止。' } : null);
  };

  const handleExport = useCallback(async () => {
    if (!audioRef.current) return;
    
    isExportCancelled.current = false;
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    });

    try {
      setExportProgress({ message: '正在初始化...', progress: 0 });

      await ffmpeg.load();
      ffmpeg.setProgress(({ ratio }: { ratio: number }) => {
        if (ratio >= 0 && ratio <= 1) {
          setExportProgress(prev => prev ? { ...prev, message: '正在合成影片...', progress: Math.round(ratio * 100) } : null);
        }
      });
      
      setExportProgress({ message: '正在載入資源...', progress: 0 });
      const audioData = await fetchFile(audioUrl);
      const imageData = await fetchFile(imageUrl);
      ffmpeg.FS('writeFile', 'audio.mp3', audioData);
      ffmpeg.FS('writeFile', 'background.jpg', imageData);

      const canvas = document.createElement('canvas');
      const R = resolutions[resolution];
      canvas.width = R.width;
      canvas.height = R.height;
      const ctx = canvas.getContext('2d')!;

      const bgImage = new Image();
      bgImage.crossOrigin = "anonymous";
      bgImage.src = imageUrl;
      await new Promise((resolve, reject) => {
        bgImage.onload = resolve;
        bgImage.onerror = reject;
      });
      
      const albumArtImage = new Image();
      if (includeAlbumArt) {
        albumArtImage.crossOrigin = "anonymous";
        albumArtImage.src = imageUrl;
         await new Promise((resolve, reject) => {
            albumArtImage.onload = resolve;
            albumArtImage.onerror = reject;
         });
      }

      const FPS = 30;
      const duration = audioRef.current.duration;
      const totalFrames = Math.floor(duration * FPS);
      
      const getStyleForPosition = (pos: number) => {
          const lineHeight = (canvas.height * (fontSize / 1080)) * 1.5;
          const yOffset = pos * lineHeight;
          const absPos = Math.abs(pos);
          const scale = Math.max(0, 1 - 0.1 * absPos);
          const opacity = Math.max(0, 1 - 0.3 * absPos);
          return { y: yOffset, scale, opacity };
      };

      for (let i = 0; i < totalFrames; i++) {
        if (isExportCancelled.current) {
          console.log('Export cancelled by user.');
          break;
        }

        const t = i / FPS;
        const frameProgress = Math.round((i / totalFrames) * 100);
        setExportProgress({ message: '正在渲染影格...', progress: frameProgress, details: `${i} / ${totalFrames}` });
        
        // --- DRAWING LOGIC ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        const imgRatio = bgImage.width / bgImage.height;
        const canvasRatio = canvas.width / canvas.height;
        let sx, sy, sWidth, sHeight;
        if (imgRatio > canvasRatio) { // Image wider than canvas
            sHeight = bgImage.height;
            sWidth = sHeight * canvasRatio;
            sx = (bgImage.width - sWidth) / 2;
            sy = 0;
        } else { // Image taller than canvas
            sWidth = bgImage.width;
            sHeight = sWidth / canvasRatio;
            sx = 0;
            sy = (bgImage.height - sHeight) / 2;
        }
        ctx.drawImage(bgImage, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Album Art
        if (includeAlbumArt) {
            const artHeight = canvas.height * (albumArtSize / 100);
            const artWidth = artHeight;
            const artY = (canvas.height - artHeight) / 2;
            const artX = albumArtPosition === 'right' 
                ? canvas.width * 0.95 - artWidth
                : canvas.width * 0.05;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 20;
            ctx.drawImage(albumArtImage, artX, artY, artWidth, artHeight);
            ctx.shadowColor = 'transparent';
        }
        
        // Song Info
        const infoFontSize = canvas.height * 0.03;
        const subInfoFontSize = canvas.height * 0.025;
        const infoX = canvas.width * 0.05;
        const infoY = canvas.height * 0.95;
        ctx.font = `bold ${infoFontSize}px ${fontFamily}`;
        ctx.fillStyle = currentTheme.info;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(songTitle, infoX, infoY - subInfoFontSize * 1.2);
        ctx.font = `${subInfoFontSize}px ${fontFamily}`;
        ctx.fillStyle = currentTheme.subInfo;
        ctx.fillText(artistName, infoX, infoY);

        // Lyrics
        const renderFontSize = canvas.height * (fontSize / 1080); // Scale font size based on 1080p
        const lyricContainerWidth = includeAlbumArt ? canvas.width * 0.55 : canvas.width * 0.9;
        const lyricContainerX = albumArtPosition === 'right' ? canvas.width * 0.05 : canvas.width * 0.40;

        const lastStartedIdx = timedLyrics.findLastIndex(l => t >= l.startTime);
        const currentIdx = (lastStartedIdx === -1) ? 1 : lastStartedIdx + 2;

        let progress = 0;
        if(lastStartedIdx >= 0 && lastStartedIdx < timedLyrics.length -1){
          const currentLyric = timedLyrics[lastStartedIdx];
          const nextLyric = timedLyrics[lastStartedIdx+1];
          const transitionDuration = nextLyric.startTime - currentLyric.startTime;
          if (transitionDuration > 0) {
            const timeInto = t - currentLyric.startTime;
            progress = Math.min(1, Math.max(0, timeInto / transitionDuration));
          }
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let j = -2; j <= 3; j++) {
            const index = currentIdx + j;
            if (index < 0 || index >= lyricsToRender.length) continue;
            
            const lyric = lyricsToRender[index];
            const effectivePosition = j - progress;
            if (effectivePosition > 2.5 || effectivePosition < -2.5) continue;
            
            const style = getStyleForPosition(effectivePosition);
            
            ctx.save();
            ctx.globalAlpha = style.opacity;
            ctx.font = `${fontWeight} ${renderFontSize * style.scale}px ${fontFamily}`;
            
            const yPos = canvas.height / 2 + style.y;
            const xPos = lyricContainerX + lyricContainerWidth / 2;

            if (strokeWidth > 0) {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth * 2 * (renderFontSize / 48);
                ctx.strokeText(lyric.text, xPos, yPos);
            }

            if (index === currentIdx) { // Active karaoke line
                const karaokeProgress = (t - lyric.startTime) / (lyric.endTime - lyric.startTime);
                const textWidth = ctx.measureText(lyric.text).width;
                
                ctx.fillStyle = currentTheme.inactive2;
                ctx.fillText(lyric.text, xPos, yPos);

                ctx.save();
                ctx.beginPath();
                ctx.rect(xPos - textWidth / 2, yPos - renderFontSize, textWidth * Math.max(0, Math.min(1, karaokeProgress)), renderFontSize * 2);
                ctx.clip();
                ctx.fillStyle = currentTheme.active;
                ctx.fillText(lyric.text, xPos, yPos);
                ctx.restore();
            } else {
                ctx.fillStyle = Math.abs(effectivePosition) < 1.5 ? currentTheme.inactive1 : currentTheme.inactive2;
                ctx.fillText(lyric.text, xPos, yPos);
            }
            ctx.restore();
        }

        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!)));
        const frameData = new Uint8Array(await blob.arrayBuffer());
        ffmpeg.FS('writeFile', `frame${String(i).padStart(5, '0')}.png`, frameData);
      }
      
      if (isExportCancelled.current) {
        throw new Error("匯出已取消");
      }
      
      await ffmpeg.run(
        '-framerate', String(FPS),
        '-i', 'frame%05d.png',
        '-i', 'audio.mp3',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', '18',
        '-preset', 'fast',
        'output.mp4'
      );

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artistName} - ${songTitle} (Lyric Video).mp4`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      if ((error as Error).message !== "匯出已取消") {
        alert(`影片匯出失敗: ${(error as Error).message}`);
      }
    } finally {
      setExportProgress(null);
      try {
          if (ffmpeg.isLoaded()) {
              // Clean up FS
              const files = ffmpeg.FS('readdir', '/');
              for (const file of files) {
                  if (file !== '.' && file !== '..') {
                      try {
                          ffmpeg.FS('unlink', file);
                      } catch (e) {
                          console.warn(`Could not unlink ${file}`, e);
                      }
                  }
              }
          }
      } catch (e) {
        console.error("Error during FFmpeg cleanup:", e);
      }
    }
  }, [timedLyrics, audioUrl, imageUrl, songTitle, artistName, fontSize, fontFamily, fontWeight, strokeColor, strokeWidth, colorTheme, resolution, includeAlbumArt, albumArtSize, albumArtPosition, lyricsToRender, currentTheme]);
  

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} details={exportProgress.details} onCancel={handleCancelExport} />}
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-4 h-full md:h-[85vh]">
        {/* Left: Video Preview */}
        <div className="w-full md:w-2/3 aspect-video bg-black rounded-lg overflow-hidden relative shadow-2xl ring-1 ring-white/10">
          <audio ref={audioRef} src={audioUrl} />
          
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img src={imageUrl} alt="Background" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>

          {/* Album Art */}
          {includeAlbumArt && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-500"
              style={{
                height: `${albumArtSize}%`,
                aspectRatio: '1/1',
                left: albumArtPosition === 'left' ? '5%' : 'auto',
                right: albumArtPosition === 'right' ? '5%' : 'auto',
              }}
            >
              <img src={imageUrl} alt="Album Art" className="w-full h-full object-cover rounded-md shadow-lg" />
            </div>
          )}
          
          {/* Lyrics Container */}
          <div 
              className="absolute z-20"
              style={{
                  top: 0,
                  left: includeAlbumArt && albumArtPosition === 'right' ? '5%' : (includeAlbumArt ? '40%' : '5%'),
                  width: includeAlbumArt ? '55%' : '90%',
                  height: '100%',
                  fontFamily,
                  fontWeight,
                  textShadow: strokeWidth > 0 ? `${strokeColor} 0px 0px ${strokeWidth}px, ${strokeColor} 0px 0px ${strokeWidth}px, ${strokeColor} 0px 0px ${strokeWidth}px, ${strokeColor} 0px 0px ${strokeWidth}px` : 'none',
              }}
            >
              <div
                  className="relative w-full h-full"
              >
                  {[-2, -1, 0, 1, 2, 3].map(j => {
                      const index = currentIndex + j;
                      if (index < 0 || index >= lyricsToRender.length) return null;
                      
                      const lyric = lyricsToRender[index];
                      const effectivePosition = j - transitionProgress;

                      if (effectivePosition > 2.5 || effectivePosition < -2.5) return null;

                      const lineHeight = fontSize * 1.5;
                      const yOffset = effectivePosition * lineHeight;
                      const absPos = Math.abs(effectivePosition);

                      const scale = Math.max(0, 1 - 0.1 * absPos);
                      const opacity = Math.max(0, 1 - 0.3 * absPos);

                      const baseStyle: React.CSSProperties = {
                          position: 'absolute',
                          width: '100%',
                          top: '50%',
                          left: '50%',
                          transformOrigin: 'center center',
                          transform: `translate(-50%, -50%) translateY(${yOffset}px) scale(${scale})`,
                          opacity: opacity,
                          fontSize: `${fontSize}px`,
                          lineHeight: 1.4,
                      };

                      if (index === currentIndex) {
                          return (
                              <KaraokeLyric
                                  key={`lyric-${index}`}
                                  text={lyric.text}
                                  startTime={lyric.startTime}
                                  endTime={lyric.endTime}
                                  currentTime={currentTime}
                                  isPlaying={isPlaying}
                                  style={baseStyle}
                                  activeColor={currentTheme.active}
                                  inactiveColor={currentTheme.inactive2}
                              />
                          );
                      }
                      
                      const color = absPos < 1.5 ? currentTheme.inactive1 : currentTheme.inactive2;
                      return (
                          <p key={`lyric-${index}`} style={{...baseStyle, color}} className="tracking-wide">
                              {lyric.text}
                          </p>
                      );
                  })}
              </div>
          </div>

          {/* Song Info */}
          <div className="absolute bottom-4 left-5 z-20 text-left">
            <h2 className="text-2xl font-bold" style={{ color: currentTheme.info }}>{songTitle}</h2>
            <p className="text-xl" style={{ color: currentTheme.subInfo }}>{artistName}</p>
          </div>

          {/* Fallback for no lyrics */}
          {!hasPlaybackStarted && timedLyrics.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center z-30">
                <div className="text-center bg-black/50 p-6 rounded-lg">
                    <MusicIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-2xl font-bold">準備預覽</h3>
                    <p className="text-gray-300">點擊播放按鈕開始</p>
                </div>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-1/3 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 overflow-y-auto custom-scrollbar">
          <h3 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">樣式設定</h3>
          <div className="space-y-4 text-sm">
             <div>
                <label className="block font-medium mb-1.5 text-gray-300">解析度</label>
                <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                    {Object.keys(resolutions).map(r => <option key={r} value={r}>{r} ({resolutions[r].width}x{resolutions[r].height})</option>)}
                </select>
             </div>
             <div>
                <label className="block font-medium mb-1.5 text-gray-300">色彩主題</label>
                <select value={colorTheme} onChange={e => setColorTheme(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                    {Object.keys(colorThemes).map(key => <option key={key} value={key}>{colorThemes[key].name}</option>)}
                </select>
             </div>
             <div>
                <label className="block font-medium mb-1.5 text-gray-300">字體 ({fontSize}px)</label>
                <input type="range" min="16" max="128" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
             </div>
             <div>
                <label className="block font-medium mb-1.5 text-gray-300">字型</label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                    {fontOptions.map(f => <option key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.name}</option>)}
                </select>
             </div>
              <div>
                <label className="block font-medium mb-1.5 text-gray-300">字重</label>
                <select value={fontWeight} onChange={e => setFontWeight(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                    {fontWeights.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
             </div>
             <div>
                <label className="block font-medium mb-1.5 text-gray-300">文字描邊 ({strokeWidth}px)</label>
                <div className="flex items-center gap-2">
                    <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="p-0.5 h-8 w-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"/>
                    <input type="range" min="0" max="10" step="0.5" value={strokeWidth} onChange={e => setStrokeWidth(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
                </div>
             </div>
             <div className="pt-2 border-t border-gray-700">
                <label className="block font-medium mb-1.5 text-gray-300">專輯封面</label>
                <div className="flex items-center justify-between">
                    <span>顯示封面</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={includeAlbumArt} onChange={e => setIncludeAlbumArt(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#a6a6a6]"></div>
                    </label>
                </div>
                {includeAlbumArt && (
                    <>
                        <label className="block font-medium mt-3 mb-1.5 text-gray-300">封面尺寸 ({albumArtSize}%)</label>
                        <input type="range" min="20" max="60" value={albumArtSize} onChange={e => setAlbumArtSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
                        <label className="block font-medium mt-3 mb-1.5 text-gray-300">封面位置</label>
                        <div className="flex gap-2">
                           <button onClick={() => setAlbumArtPosition('left')} className={`w-full p-2 rounded ${albumArtPosition === 'left' ? 'bg-[#a6a6a6] text-black' : 'bg-gray-700'}`}>左</button>
                           <button onClick={() => setAlbumArtPosition('right')} className={`w-full p-2 rounded ${albumArtPosition === 'right' ? 'bg-[#a6a6a6] text-black' : 'bg-gray-700'}`}>右</button>
                        </div>
                    </>
                )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="flex-shrink-0 w-full max-w-7xl mt-4 bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-mono w-12 text-center">{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
            <input
                type="range"
                min={0}
                max={audioRef.current?.duration || 0}
                step="0.01"
                value={currentTime}
                onChange={handleTimelineChange}
                className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
            />
            <span className="text-sm text-gray-400 font-mono w-12 text-center">{audioRef.current?.duration ? new Date(audioRef.current.duration * 1000).toISOString().substr(14, 5) : '0:00'}</span>
        </div>
        <div className="flex items-center justify-between text-white mt-2 px-2">
            <div className="flex items-center gap-2">
                <button onClick={onBack} title="返回" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <PrevIcon className="w-6 h-6" />
                </button>
                 <button
                    onClick={handleExport}
                    disabled={!!exportProgress}
                    title="匯出影片"
                    className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ExportIcon className="w-6 h-6" />
                </button>
            </div>
            <button 
                onClick={handlePlayPause} 
                className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform"
            >
                {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 pl-1" />}
            </button>
            <div className="text-right w-1/3 truncate">
                <p className="font-bold text-sm">{songTitle}</p>
                <p className="text-xs text-gray-300">{artistName}</p>
            </div>
        </div>
      </div>
       <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #a6a6a6; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default VideoPlayer;