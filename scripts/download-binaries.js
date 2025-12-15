const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');

console.log('Script started');

const binDir = path.join(__dirname, '..', 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

const platform = process.platform;
const ytDlpUrl = {
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
}[platform];

const ytDlpFilename = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const ffmpegFilename = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

const ytDlpPath = path.join(binDir, ytDlpFilename);
const destFfmpegPath = path.join(binDir, ffmpegFilename);

async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function main() {
  try {
    console.log('Setting up binaries...');

    // Copy ffmpeg
    console.log(`Copying ffmpeg from ${ffmpegPath} to ${destFfmpegPath}`);
    fs.copyFileSync(ffmpegPath, destFfmpegPath);
    if (platform !== 'win32') {
      fs.chmodSync(destFfmpegPath, 0o755);
    }

    // Download yt-dlp
    if (!fs.existsSync(ytDlpPath)) {
      console.log(`Downloading yt-dlp from ${ytDlpUrl} to ${ytDlpPath}`);
      try {
        await downloadFile(ytDlpUrl, ytDlpPath);
        if (platform !== 'win32') {
          fs.chmodSync(ytDlpPath, 0o755);
        }
        console.log('yt-dlp downloaded successfully.');
      } catch (error) {
        console.error('Error downloading yt-dlp:', error);
        process.exit(1);
      }
    } else {
      console.log('yt-dlp already exists.');
    }
  } catch (err) {
    console.error('Error in main:', err);
  }
}

main();
