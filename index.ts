import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import dotenv from 'dotenv';

// 加載 .env 檔案
dotenv.config();
const youtubeUrl = process.env.YT_URL;

if (!youtubeUrl) {
  throw new Error('YOUTUBE_URL is not defined in the .env file');
}
// 生成音頻波形圖
function generateWaveform(videoFilePath: string, outputImagePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoFilePath)
      .outputOptions('-filter_complex', 'showwavespic=s=1920x480')
      .output(outputImagePath)
      .on('end', () => {
        console.log('Waveform image generated');
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

// 獲取影片的總時長
function getVideoDuration(videoFilePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFilePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration ?? 0);
      }
    });
  });
}

// 檢測波形的峰值
function detectBeatsFromWaveform(imagePath: string, videoDuration: number): Promise<number[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const image = await loadImage(imagePath);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const data = imageData.data;
      const beats: number[] = [];

      for (let x = 0; x < image.width; x++) {
        let sum = 0;
        for (let y = 0; y < image.height; y++) {
          const index = (y * image.width + x) * 4;
          sum += data[index]; // 只考慮紅色通道
        }
        if (sum > 1000) { // 假設峰值的閾值
          beats.push(x / image.width * videoDuration); // 將 x 軸位置轉換為時間
        }
      }

      resolve(beats);
    } catch (err) {
      reject(err);
    }
  });
}

// 擷取影片幀
function extractFramesAtBeats(videoFilePath: string, beatTimes: number[]) {
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  let count = 1;
  beatTimes.forEach((time) => {
    const fileName = `frame_${String(count).padStart(5, '0')}.jpg`; // 產生 `frame_00001.jpg` 格式
    count++;
    ffmpeg(videoFilePath)
      .seekInput(time)  // 跳到對應的時間戳
      .output(`${outputDir}/${fileName}`)  // 指定輸出的圖片文件
      .outputOptions('-vframes 1')  // 只抓取一幀
      .on('end', () => {
        console.log(`Captured frame at ${time}s`);
      })
      .run();
  });
}

// 確保目錄存在
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// 使用 youtube-dl-exec 下載 YouTube 影片
function downloadYouTubeVideoWithYoutubeDl(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    youtubedl(url, {
      output: outputPath,
      format: 'best',
    })
      .then(() => {
        console.log('YouTube video downloaded');
        resolve();
      })
      .catch((err) => {
        console.error('Error downloading video:', err);
        reject(err);
      });
  });
}

// 主處理函數
async function processYouTubeVideo(youtubeUrl: string) {
  try {
    const videoFilePath = './dist/temp/video.mp4';
    const waveformImagePath = './dist/temp/waveform.png';

    // 確保目錄存在
    ensureDirectoryExistence(videoFilePath);
    ensureDirectoryExistence(waveformImagePath);

    // 使用 youtube-dl-exec 下載 YouTube 影片
    await downloadYouTubeVideoWithYoutubeDl(youtubeUrl, videoFilePath);

    // 獲取影片的總時長
    const videoDuration = await getVideoDuration(videoFilePath);

    // 生成音頻波形圖
    await generateWaveform(videoFilePath, waveformImagePath);

    // 檢測波形的峰值
    const beatTimes = await detectBeatsFromWaveform(waveformImagePath, videoDuration);

    // 根據節拍擷取影片幀
    extractFramesAtBeats(videoFilePath, beatTimes);
  } catch (err) {
    console.error('Error processing YouTube video:', err);
  }
}


// 處理 YouTube 影片
processYouTubeVideo(youtubeUrl);