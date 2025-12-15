import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  deezer: {
    getPlaylist: (url: string) => Promise<any>;
  };
  youtube: {
    search: (title: string, artist: string) => Promise<any>;
    searchBatch: (tracks: Array<{ title: string; artist: string }>) => Promise<any>;
  };
  download: {
    video: (
      url: string,
      title: string,
      artist: string,
      options: any
    ) => Promise<any>;
    cancel: () => Promise<any>;
    onProgress: (callback: (progress: any) => void) => void;
  };
  check: {
    dependencies: () => Promise<{ ytDlp: boolean; ffmpeg: boolean }>;
  };
  dialog: {
    selectFolder: () => Promise<string | null>;
  };
  shell: {
    openFolder: (path: string) => Promise<void>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<any>;
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  deezer: {
    getPlaylist: (url: string) => ipcRenderer.invoke('deezer:get-playlist', url),
  },
  youtube: {
    search: (title: string, artist: string) =>
      ipcRenderer.invoke('youtube:search', title, artist),
    searchBatch: (tracks: Array<{ title: string; artist: string }>) =>
      ipcRenderer.invoke('youtube:search-batch', tracks),
  },
  download: {
    video: (url: string, title: string, artist: string, options: any) =>
      ipcRenderer.invoke('download:video', url, title, artist, options),
    cancel: () => ipcRenderer.invoke('download:cancel'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download:progress', (_event, progress) => callback(progress));
    },
  },
  check: {
    dependencies: () => ipcRenderer.invoke('check:dependencies'),
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  },
  shell: {
    openFolder: (path: string) => ipcRenderer.invoke('shell:open-folder', path),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
  },
} as ElectronAPI);