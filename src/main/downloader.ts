import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface DownloadProgress {
  videoId: string;
  title:  string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
  filePath?: string;
}

export interface DownloadOptions {
  outputDir: string;
  format: 'mp3' | 'mp4' | 'best';
  quality: string;
}

export class Downloader {
  private static ytDlpPath: string = 'yt-dlp';
  private static ffmpegPath: string = 'ffmpeg';
  private currentProcess: ChildProcess | null = null;

  /**
   * Vérifie si yt-dlp est installé
   */
  static async checkYtDlp(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.ytDlpPath, ['--version']);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }

  /**
   * Vérifie si ffmpeg est installé
   */
  static async checkFfmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.ffmpegPath, ['-version']);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }

  /**
   * Configure les chemins des binaires
   */
  static setPaths(ytDlpPath?:  string, ffmpegPath?: string): void {
    if (ytDlpPath) this.ytDlpPath = ytDlpPath;
    if (ffmpegPath) this.ffmpegPath = ffmpegPath;
  }

  /**
   * Télécharge une vidéo YouTube
   */
  async downloadVideo(
    url: string,
    title: string,
    artist: string,
    options: DownloadOptions,
    onProgress:  (progress: DownloadProgress) => void
  ): Promise<string> {
    const videoId = url.split('v=')[1] || url;
    const sanitizedTitle = this.sanitizeFilename(`${artist} - ${title}`);
    
    // Créer le dossier de sortie s'il n'existe pas
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options. outputDir, { recursive: true });
    }

    const outputTemplate = path.join(
      options.outputDir,
      `${sanitizedTitle}.%(ext)s`
    );

    const args:  string[] = [
      url,
      '-o', outputTemplate,
      '--no-playlist',
      '--progress',
      '--newline',
      '--js-runtimes', 'node',
    ];

    // Configuration du format
    if (options.format === 'mp3') {
      args.push(
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', options.quality || '0',
        '--embed-thumbnail',
        '--add-metadata'
      );
    } else if (options.format === 'mp4') {
      args.push(
        '-f', `bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
        '--merge-output-format', 'mp4'
      );
    } else {
      args.push('-f', 'best');
    }

    // Spécifier ffmpeg si nécessaire
    if (Downloader.ffmpegPath !== 'ffmpeg') {
      args.push('--ffmpeg-location', Downloader.ffmpegPath);
    }

    return new Promise((resolve, reject) => {
      onProgress({
        videoId,
        title:  `${artist} - ${title}`,
        progress: 0,
        status: 'downloading',
      });

      this.currentProcess = spawn(Downloader.ytDlpPath, args);

      let outputFile = '';

      this.currentProcess.stdout?. on('data', (data:  Buffer) => {
        const output = data.toString();
        
        // Parser la progression
        const progressMatch = output.match(/(\d+\. ?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          onProgress({
            videoId,
            title: `${artist} - ${title}`,
            progress,
            status: 'downloading',
          });
        }

        // Capturer le nom du fichier de sortie
        const destMatch = output.match(/\[.*\] Destination: (.+)/);
        if (destMatch) {
          outputFile = destMatch[1]. trim();
        }

        const mergerMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
        if (mergerMatch) {
          outputFile = mergerMatch[1].trim();
        }
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        console.error('yt-dlp stderr:', data.toString());
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        
        if (code === 0) {
          // Trouver le fichier téléchargé
          const expectedPath = path.join(
            options.outputDir,
            `${sanitizedTitle}.${options.format === 'mp3' ? 'mp3' : 'mp4'}`
          );
          
          const finalPath = fs.existsSync(expectedPath) ? expectedPath : outputFile;

          onProgress({
            videoId,
            title: `${artist} - ${title}`,
            progress: 100,
            status: 'completed',
            filePath:  finalPath,
          });
          
          resolve(finalPath);
        } else {
          const error = `yt-dlp exited with code ${code}`;
          onProgress({
            videoId,
            title: `${artist} - ${title}`,
            progress: 0,
            status: 'error',
            error,
          });
          reject(new Error(error));
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        onProgress({
          videoId,
          title: `${artist} - ${title}`,
          progress: 0,
          status: 'error',
          error: error.message,
        });
        reject(error);
      });
    });
  }

  /**
   * Annule le téléchargement en cours
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  /**
   * Nettoie un nom de fichier
   */
  private sanitizeFilename(filename:  string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }
}