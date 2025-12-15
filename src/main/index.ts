import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { DeezerService, DeezerTrack } from './deezer';
import { YouTubeService } from './youtube';
import { Downloader, DownloadOptions, DownloadProgress } from './downloader';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Configuration du store
const store = new Store({
  defaults: {
    outputDir: app.getPath('music'),
    format: 'mp3',
    quality: '0',
  },
});

let mainWindow: BrowserWindow | null = null;
const downloader = new Downloader();

function createWindow(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https:;"]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Configuration des chemins des binaires
  const isDev = !app.isPackaged;
  const binPath = isDev
    ? path.join(process.cwd(), 'bin')
    : path.join(process.resourcesPath, 'bin');

  const ytDlpExec = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const ffmpegExec = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  const ytDlpPath = path.join(binPath, ytDlpExec);
  const ffmpegPath = path.join(binPath, ffmpegExec);

  Downloader.setPaths(ytDlpPath, ffmpegPath);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Récupérer une playlist Deezer
ipcMain.handle('deezer:get-playlist', async (_event, url: string) => {
  console.log('IPC deezer:get-playlist called with url:', url);
  try {
    const playlistId = DeezerService.extractPlaylistId(url);
    console.log('Extracted playlistId:', playlistId);
    if (!playlistId) {
      throw new Error('URL de playlist invalide');
    }
    const playlist = await DeezerService.getPlaylist(playlistId);
    console.log('Playlist fetched successfully:', playlist.title);
    return { success: true, data: playlist };
  } catch (error) {
    console.error('Error in deezer:get-playlist:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Rechercher sur YouTube
ipcMain.handle(
  'youtube:search',
  async (_event, title: string, artist: string) => {
    try {
      const result = await YouTubeService.searchVideo(title, artist);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

// Rechercher plusieurs titres sur YouTube
ipcMain.handle(
  'youtube:search-batch',
  async (_event, tracks: Array<{ title: string; artist: string }>) => {
    try {
      const results = await YouTubeService.searchVideos(tracks);
      return { success: true, data: Object.fromEntries(results) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

// Télécharger une vidéo
ipcMain.handle(
  'download:video',
  async (
    event,
    url: string,
    title: string,
    artist:  string,
    options: DownloadOptions
  ) => {
    try {
      const filePath = await downloader.downloadVideo(
        url,
        title,
        artist,
        options,
        (progress: DownloadProgress) => {
          mainWindow?.webContents.send('download:progress', progress);
        }
      );
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
);

// Annuler le téléchargement
ipcMain.handle('download:cancel', async () => {
  downloader.cancel();
  return { success: true };
});

// Vérifier les dépendances
ipcMain.handle('check:dependencies', async () => {
  const ytDlp = await Downloader.checkYtDlp();
  const ffmpeg = await Downloader.checkFfmpeg();
  return { ytDlp, ffmpeg };
});

// Sélectionner un dossier
ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Ouvrir un dossier dans l'explorateur
ipcMain.handle('shell:open-folder', async (_event, folderPath: string) => {
  shell.openPath(folderPath);
});

// Gestion des paramètres
ipcMain.handle('settings:get', async (_event, key: string) => {
  return store.get(key);
});

ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
  store.set(key, value);
});

ipcMain.handle('settings:get-all', async () => {
  return store.store;
});

