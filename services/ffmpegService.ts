// Since we are using CDN, we need to declare these globals
declare const FFmpeg: any;
declare const html2canvas: any;

const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg: any;

async function loadFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded()) return ffmpeg;
    ffmpeg = createFFmpeg({
        log: true,
        // Using jsdelivr CDN as an alternative to unpkg for better reliability
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js',
    });
    await ffmpeg.load();
    return ffmpeg;
}


export const exportVideo = async (
    playerElement: HTMLElement,
    audioFile: File,
    songTitle: string,
    onProgress: (message: string, progress?: number) => void
): Promise<void> => {
    const controls = playerElement.querySelector('[data-testid="player-controls"]') as HTMLElement | null;
    const audioEl = playerElement.querySelector('audio');
    
    if (!audioEl) throw new Error("找不到音訊元件。");
    if (!controls) throw new Error("找不到播放器控制項。");
    
    // Ensure duration is loaded and valid.
    const duration = audioEl.duration;
    if (!duration || !isFinite(duration)) {
        throw new Error("無法讀取有效的音訊長度。請確認音訊檔案已完整載入。");
    }

    try {
        onProgress('步驟 1/4: 載入轉檔核心...', 0);
        const ffmpegInstance = await loadFFmpeg();
        
        const FPS = 25; // Lower FPS for better stability
        const totalFrames = Math.floor(duration * FPS);
        
        ffmpegInstance.setProgress(({ ratio }: { ratio: number }) => {
            const progress = 85 + Math.round(ratio * 15); // from 85% to 100%
            if (progress < 100) {
              onProgress(`步驟 3/4: 合成影片與音訊... ${Math.round(ratio * 100)}%`, progress);
            }
        });

        // Hide controls for clean capture
        controls.style.visibility = 'hidden';
        
        onProgress('步驟 2/4: 擷取影片畫面...', 5);

        for (let i = 0; i < totalFrames; i++) {
            const time = i / FPS;
            audioEl.currentTime = time;
            
            // Wait a moment for React to re-render the lyrics and animations for the current time
            await new Promise(r => setTimeout(r, 100)); 

            const frameCanvas = await html2canvas(playerElement, {
                // Ensure we capture a consistent 720p frame
                width: 1280,
                height: 720,
                scale: 1, 
                useCORS: true,
                allowTaint: true,
                logging: false,
            });

            // Convert canvas to blob, which is more efficient
            const frameBlob: Blob | null = await new Promise(resolve => frameCanvas.toBlob(resolve, 'image/jpeg', 0.9));
            if (!frameBlob) throw new Error(`無法擷取第 ${i} 幀畫面`);
            
            const fileName = `frame-${String(i).padStart(5, '0')}.jpg`;
            ffmpegInstance.FS('writeFile', fileName, await fetchFile(frameBlob));
            
            const progress = 5 + Math.round((i / totalFrames) * 80); // Frame capture takes from 5% to 85%
            onProgress(`擷取畫面中... (${i+1}/${totalFrames})`, progress);
        }
        
        onProgress('步驟 3/4: 準備混合音訊...', 85);
        const audioFileName = 'audio.dat'; // Use a generic name
        const outputFileName = 'output.mp4';

        ffmpegInstance.FS('writeFile', audioFileName, await fetchFile(audioFile));

        await ffmpegInstance.run(
            '-framerate', String(FPS),
            '-i', 'frame-%05d.jpg',
            '-i', audioFileName,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', // Use a standard audio codec
            '-b:a', '192k', // Set audio bitrate
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest', // Finish encoding when the shortest input stream ends
            outputFileName
        );
        
        ffmpegInstance.setProgress(() => {}); // Clear progress handler

        onProgress('步驟 4/4: 完成！準備下載...', 99);
        const data = ffmpegInstance.FS('readFile', outputFileName);

        // Cleanup FFmpeg's virtual file system
        for (let i = 0; i < totalFrames; i++) {
            const fileName = `frame-${String(i).padStart(5, '0')}.jpg`;
            ffmpegInstance.FS('unlink', fileName);
        }
        ffmpegInstance.FS('unlink', audioFileName);
        ffmpegInstance.FS('unlink', outputFileName);

        const finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(finalBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'lyric-video'}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onProgress('下載已開始', 100);

    } catch (error) {
        console.error('影片匯出失敗:', error);
        throw error;
    } finally {
        // Always restore UI state
        if(controls) controls.style.visibility = 'visible';
        // Reset audio position
        if(audioEl) {
          audioEl.pause();
          audioEl.currentTime = 0;
        }
    }
};