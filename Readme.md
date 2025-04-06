# Dancut

Dancut 是一個用於從 YouTube 影片中擷取節拍幀的工具。

## 功能

1. 下載 YouTube 影片。
2. 生成音頻波形圖。
3. 檢測波形的峰值（節拍）。
4. 根據節拍擷取影片幀。

## 安裝

1. 確保你已安裝以下工具：
   - [Node.js](https://nodejs.org/) (建議版本 16 或以上)
   - [FFmpeg](https://ffmpeg.org/) (需在系統路徑中可用)

2. 克隆此專案到本地：

   ```bash
   git clone <repository-url>
   cd dancut
   ```

3. 安裝依賴:

   ```bash
   npm i
   ```

4. 複製 `.env.sample` 並命名為 `.env`:

   ```bash
   cp .env.sample .env
   ```

5. 在 `.env` 文件中設定 `YT_URL` 為你想要處理的 YouTube 影片 URL：

   ```bash
   YT_URL=https://www.youtube.com/watch?v=VIDEO_ID
   ```

## 使用

1. 執行以下命令來處理影片：

   ```bash
   npx ts-node index.ts
   ```

2. 程式將會執行以下步驟：
   - 下載 YouTube 影片到 dist/temp/video.mp4。
   - 生成音頻波形圖到 dist/temp/waveform.png。
   - 檢測波形的節拍。
   - 根據節拍擷取影片幀，並將幀圖儲存到 output 資料夾。
   - 在 output 資料夾中可以找到擷取的幀圖，檔名格式為 frame_00001.jpg、frame_00002.jpg 等。

## 注意事項

確保你的系統已安裝 FFmpeg，並且可以從命令列執行 ffmpeg。
如果遇到錯誤，請檢查 .env 文件中的 YT_URL 是否正確，並確保網路連線正常。
