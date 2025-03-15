import ffmpeg from 'fluent-ffmpeg';

// 提取音頻的節拍信息（這裡我們使用 ffmpeg 來提取節拍）
function extractAudioBeats(videoFilePath: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const beats: number[] = [];
    ffmpeg(videoFilePath)
      .audioFilters('silence=1:0.1:0.1') // 這是濾波器，會捕捉音頻中的靜默和節奏
      .on('end', () => {
        resolve(beats); // 返回檢測到的節拍時間
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

// 擷取影片幀
function extractFramesAtBeats(videoFilePath: string, beatTimes: number[]) {
  beatTimes.forEach((time) => {
    ffmpeg(videoFilePath)
      .seekInput(time)  // 跳到對應的時間戳
      .output(`frame_${time}.jpg`)  // 輸出圖片
      .outputOptions('-vframes 1')  // 只抓取一幀
      .on('end', () => {
        console.log(`Captured frame at ${time}s`);
      })
      .run();
  });
}

// 主處理函數
async function processVideo(videoFilePath: string) {
  try {
    // 提取音頻節拍
    const beatTimes = await extractAudioBeats(videoFilePath);
    
    // 根據節拍擷取影片幀
    extractFramesAtBeats(videoFilePath, beatTimes);
  } catch (err) {
    console.error('Error processing video:', err);
  }
}

// 處理影片
processVideo('./sample.MP4');
