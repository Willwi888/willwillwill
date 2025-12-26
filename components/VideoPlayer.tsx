import React, { useState, useRef, useEffect } from 'react';
import { TimedLyric } from '../types';
import KaraokeLyric from './KaraokeLyric';
import { ColorPalette, lyricColorPalettes } from '../styles/colors';
import { exportVideo } from '../services/ffmpegService';
import { lyricsToSrt } from '../utils';
import Loader from './Loader';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import AlignLeftIcon from './icons/AlignLeftIcon';
import AlignRightIcon from './icons/AlignRightIcon';
import FanIcon from './icons/FanIcon';
import VerticalLinesIcon from './icons/VerticalLinesIcon';
import EyeIcon from './icons/EyeIcon';
import EyeSlashIcon from './icons/EyeSlashIcon';
import DownloadIcon from './icons/DownloadIcon';
import FontSizeIcon from './icons/FontSizeIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';


interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  audioFile: File | null;
  imageUrls: string[];
  videoUrl: string | null;
  onBack: () => void;
  songTitle: string;
  artistName: string;
}

type LyricAlignment = 'text-left' | 'text-center' | 'text-right';
export type VisualEffect = 'none' | 'subtle-pan' | 'slow-zoom' | 'rain';

const ArrowsPointingOutIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25h4.5m-4.5 0v-4.5m0 4.5L9 15" />
  </svg>
);


const VideoPlayer: React.FC<VideoPlayerProps> = ({
  timedLyrics,
  audioUrl,
  audioFile,
  imageUrls,
  videoUrl,
  onBack,
  songTitle,
  artistName,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState<{ active: boolean; message: string; progress?: number }>({ active: false, message: '' });

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const [colorPalette, setColorPalette] = useState<ColorPalette>(lyricColorPalettes[0]);
  const [fontSize, setFontSize] = useState(3.5); // Using rem units
  const [alignment, setAlignment] = useState<LyricAlignment>('text-center');
  const [effect, setEffect] = useState<VisualEffect>('subtle-pan');
  const [showControls, setShowControls] = useState(true);
  
  const activeLyricIndex = timedLyrics.findIndex(
    lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration); // Ensure timeline shows full
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    // Sync video playback with audio
    const video = videoRef.current;
    if (!video || !audioRef.current) return;
    if (isPlaying && video.paused) {
      video.play().catch(console.error);
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
    // Sync time
    if (Math.abs(video.currentTime - audioRef.current.currentTime) > 0.5) {
      video.currentTime = audioRef.current.currentTime;
    }
  }, [isPlaying, currentTime]);

  useEffect(() => {
    if (imageUrls.length <= 1 || !isPlaying) return;
    const imageChangeInterval = 10000; // Change image every 10 seconds
    const intervalId = setInterval(() => {
      setCurrentImageIndex(prevIndex => (prevIndex + 1) % imageUrls.length);
    }, imageChangeInterval);
    return () => clearInterval(intervalId);
  }, [isPlaying, imageUrls.length]);
  
  const handleExport = async () => {
    if (!playerRef.current || !audioFile) {
        alert('無法匯出：缺少必要的元件或音訊檔案。');
        return;
    }
    if (isPlaying) {
        handlePlayPause(); // Pause before exporting
    }
    setIsExporting({ active: true, message: '準備匯出...', progress: 0 });
    try {
        await exportVideo(
            playerRef.current,
            audioFile,
            songTitle,
            (message, progress) => {
                setIsExporting({ active: true, message, progress });
            }
        );
    } catch (error) {
        let errorMessage = "未知錯誤";
        if (error instanceof Error) {
            errorMessage = error.message;
            if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('取得失敗')) {
                errorMessage = '無法載入必要的轉檔資源，請檢查您的網路連線並再試一次。這可能是暫時的網路問題或內容安全政策（CSP）所導致。';
            }
        }
        alert(`影片匯出失敗：${errorMessage}`);
        console.error(error);
    } finally {
        setIsExporting({ active: false, message: '' });
    }
  };

  const handleExportSrt = () => {
    try {
        const srtContent = lyricsToSrt(timedLyrics);
        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'lyrics'}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert(`SRT 匯出失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        console.error(error);
    }
  };


  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        // If song ended, restart from beginning
        if(audioRef.current.currentTime >= audioRef.current.duration - 0.1){
            audioRef.current.currentTime = 0;
        }
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return isNaN(minutes) || isNaN(secs) ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderLyrics = () => {
    const activeLyric = timedLyrics[activeLyricIndex];
    const nextLyric = timedLyrics[activeLyricIndex + 1];

    return (
        <>
            {activeLyric ? (
                <div className="animate-lyric-fade-in" style={{ fontSize: `${fontSize}rem`, lineHeight: 1.2, fontWeight: 'bold' }}>
                    <KaraokeLyric
                        text={activeLyric.text}
                        startTime={activeLyric.startTime}
                        endTime={activeLyric.endTime}
                        currentTime={currentTime}
                        colorPalette={colorPalette}
                        isPlaying={isPlaying}
                    />
                </div>
            ) : <div style={{ height: `${fontSize * 1.2}rem` }} /> /* Placeholder */}
            {nextLyric ? (
                <p 
                    className="transition-opacity duration-500"
                    style={{
                        fontSize: `${fontSize * 0.7}rem`,
                        lineHeight: 1.2,
                        color: colorPalette.base,
                        opacity: 0.6,
                    }}
                >
                    {nextLyric.text}
                </p>
            ) : <div style={{ height: `${fontSize * 0.7 * 1.2}rem` }} /> /* Placeholder */}
        </>
    );
  };

  const backgroundImageUrl = imageUrls[currentImageIndex] || '';

  const animationClass = {
    'subtle-pan': 'animate-subtle-pan',
    'slow-zoom': 'animate-slow-zoom',
    'rain': '',
    'none': '',
  }[effect];

  return (
    <div ref={playerRef} className="w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative font-sans">
      {isExporting.active && <Loader message={isExporting.message} progress={isExporting.progress} />}
      {/* Background */}
      <div className="absolute inset-0 w-full h-full">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-cover bg-center transition-all duration-1000 ${animationClass}`}
            style={{ backgroundImage: `url(${backgroundImageUrl})`, willChange: 'transform' }}
          />
        )}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        {effect === 'rain' && <div className="absolute inset-0 bg-rain-effect opacity-30"></div>}
      </div>
      
      {/* Overlay Content */}
      <div data-testid="player-controls" className={`relative z-10 w-full h-full flex flex-col p-4 sm:p-8 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-within:opacity-100'}`}>
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-black/30 hover:bg-black/50 border border-white/20 rounded-lg transition-colors">
                <PrevIcon className="w-5 h-5" />
                返回
            </button>
             <button onClick={handleExportSrt} title="匯出 SRT 字幕檔" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-black/30 hover:bg-black/50 border border-white/20 rounded-lg transition-colors">
                <DocumentTextIcon className="w-5 h-5" />
                匯出 SRT
            </button>
            <button onClick={handleExport} disabled={!audioFile} title="匯出 MP4 影片" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600/50 hover:bg-green-500/50 border border-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <DownloadIcon className="w-5 h-5" />
                匯出影片
            </button>
          </div>
          <div className="text-right">
             <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">{songTitle}</h1>
             <p className="text-sm sm:text-md text-gray-300 drop-shadow-md">{artistName}</p>
          </div>
        </header>
        
        {/* Lyrics Container */}
        <div className="flex-grow flex items-center justify-center overflow-hidden">
            <div className={`w-full max-w-4xl p-4 flex flex-col gap-4 items-center ${alignment}`}>
                {renderLyrics()}
            </div>
        </div>

        {/* Controls */}
        <footer className="flex-shrink-0 space-y-4">
            {/* Timeline */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300 font-mono w-12 text-center">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={handleTimelineChange}
                    className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                />
                <span className="text-sm text-gray-300 font-mono w-12 text-center">{formatTime(duration)}</span>
            </div>

            {/* Buttons & Settings */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Left Settings */}
                <div className="flex items-center gap-2 p-2 bg-black/30 rounded-full border border-white/10">
                    <span className="text-gray-300 pl-2 text-sm">顏色:</span>
                    {lyricColorPalettes.map(p => (
                        <button key={p.name} title={p.name} onClick={() => setColorPalette(p)} className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${colorPalette.name === p.name ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50' : ''}`} style={{background: p.bg}} />
                    ))}
                </div>

                {/* Play Button */}
                <button onClick={handlePlayPause} className="bg-white text-black rounded-full p-4 transform hover:scale-110 transition-transform shadow-lg">
                    {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
                </button>

                {/* Right Settings */}
                <div className="flex items-center justify-end flex-wrap gap-2 p-1.5 bg-black/30 rounded-full border border-white/10">
                    <div className="flex items-center gap-1" title="字體大小">
                        <FontSizeIcon className="w-5 h-5 text-gray-300 ml-2"/>
                        <input 
                            type="range"
                            min="2"
                            max="6"
                            step="0.1"
                            value={fontSize}
                            onChange={(e) => setFontSize(parseFloat(e.target.value))}
                            className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                        />
                    </div>
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                    <button onClick={() => setAlignment(a => a === 'text-left' ? 'text-center' : 'text-left')} title="靠左" className={`p-2 rounded-full transition-colors ${alignment === 'text-left' ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}> <AlignLeftIcon className="w-5 h-5" /></button>
                    <button onClick={() => setAlignment(a => a === 'text-right' ? 'text-center' : 'text-right')} title="靠右" className={`p-2 rounded-full transition-colors ${alignment === 'text-right' ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}> <AlignRightIcon className="w-5 h-5" /></button>
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                    <button onClick={() => setEffect(e => e === 'subtle-pan' ? 'none' : 'subtle-pan')} title="背景平移" className={`p-2 rounded-full transition-colors ${effect === 'subtle-pan' ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}> <FanIcon className="w-5 h-5" /></button>
                    <button onClick={() => setEffect(e => e === 'slow-zoom' ? 'none' : 'slow-zoom')} title="慢速縮放" className={`p-2 rounded-full transition-colors ${effect === 'slow-zoom' ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}><ArrowsPointingOutIcon className="w-5 h-5" /></button>
                    <button onClick={() => setEffect(e => e === 'rain' ? 'none' : 'rain')} title="下雨特效" className={`p-2 rounded-full transition-colors ${effect === 'rain' ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}> <VerticalLinesIcon className="w-5 h-5" /></button>
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                    <button onClick={() => setShowControls(s => !s)} title="顯示/隱藏控制項" className="p-2 text-gray-300 hover:bg-white/10 rounded-full transition-colors">{showControls ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}</button>
                </div>
            </div>
        </footer>
      </div>

      <audio ref={audioRef} src={audioUrl} playsInline />

      <style>{`
        @keyframes subtle-pan {
          from {
            transform: scale(1.1) translateX(-2.5%);
          }
          to {
            transform: scale(1.1) translateX(2.5%);
          }
        }
        .animate-subtle-pan {
          animation: subtle-pan 15s ease-in-out infinite alternate;
        }
        @keyframes slow-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s ease-in-out infinite alternate;
        }
        @keyframes lyric-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-lyric-fade-in {
            animation: lyric-fade-in 0.5s ease-out forwards;
        }
        .accent-white::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            margin-top: -7px; /* Center thumb */
        }
        .accent-white::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            border: none;
        }
        input[type=range].accent-white {
            height: 2px;
        }
        @keyframes rain-fall {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
        }
        .bg-rain-effect {
            background-image: linear-gradient(transparent, transparent), linear-gradient(180deg, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.2) 1px, transparent 1px);
            background-size: 100% 100%, 2px 20px, 4px 30px;
            background-repeat: repeat;
            animation: rain-fall 0.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;