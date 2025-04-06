import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import dotenv from 'dotenv';

// 加載 .env 檔案
dotenv.config();

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
function ensureDirectoryExistence(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
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

// 單一影片處理（原有功能）
async function processSingleVideo(videoFilePath: string) {
  const waveformImagePath = './dist/temp/waveform.png';

  // 獲取影片的總時長
  const videoDuration = await getVideoDuration(videoFilePath);

  // 生成音頻波形圖
  await generateWaveform(videoFilePath, waveformImagePath);

  // 檢測波形的峰值
  const beatTimes = await detectBeatsFromWaveform(waveformImagePath, videoDuration);

  // 根據節拍擷取影片幀
  extractFramesAtBeats(videoFilePath, beatTimes);
}

// 每分鐘切割影片
async function processVideoByMinute(videoFilePath: string, outputDir: string, clipDuration: number) {
  // 確保輸出目錄存在
  ensureDirectoryExistence(outputDir);

  const videoDuration = await getVideoDuration(videoFilePath);
  const fileExtension = path.extname(videoFilePath).toLowerCase(); // 動態取得原始檔案的副檔名

  for (let startTime = 0; startTime < videoDuration; startTime += clipDuration) {
    const endTime = Math.min(startTime + clipDuration, videoDuration);
    const outputFileName = `clip_${path.basename(videoFilePath, fileExtension)}_${String(startTime).padStart(4, '0')}${fileExtension}`;
    const outputPath = path.join(outputDir, outputFileName);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoFilePath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(outputPath)
        .on('end', () => {
          console.log(`Created clip: ${outputFileName}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`Error creating clip: ${err}`);
          reject(err);
        })
        .run();
    });
  }
}

// 主處理函數
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node index.js <source> <path_or_url> [clip_duration]');
    console.error('<source>: "yt" (YouTube) 或 "l" (local)');
    console.error('<path_or_url>: YouTube URL 或地端影片路徑（檔案或資料夾）');
    console.error('[clip_duration]: (可選) 切割影片的片段長度（以秒為單位）');
    process.exit(1);
  }

  // 簡化參數
  const source = args[0] === 'yt' ? 'youtube' : args[0] === 'l' ? 'local' : args[0];
  const inputPath = args[1];
  const clipDuration = args[2] ? parseInt(args[2], 10) : null; // 可選的切割長度
  const outputDir = './output';

  try {
    // 確保必要的目錄存在
    ensureDirectoryExistence(outputDir);

    if (source === 'local') {
      console.log('Using local video file or directory...');

      // 檢查路徑是否為資料夾
      if (fs.lstatSync(inputPath).isDirectory()) {
        console.log(`Processing all videos in directory: ${inputPath}`);
        const videoFiles = fs
          .readdirSync(inputPath)
          .filter((file) => {
            const ext = path.extname(file).toLowerCase(); // 將副檔名轉為小寫
            return ext === '.mp4' || ext === '.mov'; // 支援 .mp4 和 .mov
          });

        if (videoFiles.length === 0) {
          throw new Error(`No .mp4 or .mov files found in directory: ${inputPath}`);
        }

        for (const file of videoFiles) {
          const fullPath = path.join(inputPath, file);
          console.log(`Processing video: ${fullPath}`);

          if (clipDuration) {
            // 如果提供了切割長度，執行切割功能
            console.log(`Splitting video into ${clipDuration}-second clips...`);
            await processVideoByMinute(fullPath, outputDir, clipDuration);
          } else {
            // 否則執行原有功能
            console.log('Processing video for waveform and frame extraction...');
            await processSingleVideo(fullPath);
          }
        }
      } else {
        // 單一檔案處理
        if (!fs.existsSync(inputPath)) {
          throw new Error(`Local file not found: ${inputPath}`);
        }

        if (clipDuration) {
          // 如果提供了切割長度，執行切割功能
          console.log(`Splitting video into ${clipDuration}-second clips...`);
          await processVideoByMinute(inputPath, outputDir, clipDuration);
        } else {
          // 否則執行原有功能
          console.log('Processing video for waveform and frame extraction...');
          await processSingleVideo(inputPath);
        }
      }
    } else {
      throw new Error('Invalid source. Use "l" for local videos.');
    }
  } catch (err) {
    console.error('Error processing video:', err);
  }
}

main();