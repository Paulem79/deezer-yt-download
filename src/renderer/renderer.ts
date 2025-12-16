import './styles.css';
import type { ElectronAPI } from '../preload';

// CSS is now inline in index.html

declare global {
    interface Window {
        // Exposed by preload; optional for non-Electron/mobile builds.
        electronAPI?: ElectronAPI;
    }
}

const electronAPI = window.electronAPI;

const UNSUPPORTED_MESSAGES = {
    en: 'This build requires the desktop Electron app to run.',
    fr: 'Cette version nécessite l’environnement Electron pour fonctionner.',
};

function renderUnsupportedEnvironment() {
    const container = document.getElementById('app') ?? document.body;
    const wrapper = document.createElement('div');
    wrapper.className = 'unsupported-wrapper';

    const title = document.createElement('h1');
    title.textContent = 'Deezer YouTube Downloader';

    const englishMessage = document.createElement('p');
    englishMessage.textContent = UNSUPPORTED_MESSAGES.en;

    const frenchMessage = document.createElement('p');
    frenchMessage.textContent = UNSUPPORTED_MESSAGES.fr;

    wrapper.append(title, englishMessage, frenchMessage);
    container.replaceChildren(wrapper);
}

function assertElectronAPI(): ElectronAPI {
    if (!electronAPI) {
        throw new Error('Electron API unavailable');
    }
    return electronAPI;
}

interface Track {
    id: number;
    title: string;
    artist: string;
    album: string;
    duration: number;
    youtubeUrl?:  string;
    youtubeTitle?: string;
    status: 'pending' | 'searching' | 'found' | 'not-found' | 'downloading' | 'completed' | 'error';
    progress?:  number;
    selected:  boolean;
}

interface Playlist {
    id: number;
    title: string;
    description: string;
    nb_tracks: number;
    picture_medium: string;
    tracks: Track[];
}

// State
let currentPlaylist: Playlist | null = null;
let settings = {
    outputDir: '',
    format: 'mp3',
    quality: '0',
};

// DOM Elements
const elements = {
    playlistUrl: document.getElementById('playlistUrl') as HTMLInputElement,
    loadPlaylistBtn: document.getElementById('loadPlaylistBtn') as HTMLButtonElement,
    playlistInfo: document.getElementById('playlistInfo') as HTMLElement,
    playlistCover: document.getElementById('playlistCover') as HTMLImageElement,
    playlistTitle:  document.getElementById('playlistTitle') as HTMLElement,
    playlistDescription: document.getElementById('playlistDescription') as HTMLElement,
    playlistTrackCount: document.getElementById('playlistTrackCount') as HTMLElement,
    searchAllBtn: document.getElementById('searchAllBtn') as HTMLButtonElement,
    downloadAllBtn: document.getElementById('downloadAllBtn') as HTMLButtonElement,
    progressSection: document.getElementById('progressSection') as HTMLElement,
    progressBar: document.getElementById('progressBar') as HTMLElement,
    progressCount: document.getElementById('progressCount') as HTMLElement,
    cancelBtn: document.getElementById('cancelBtn') as HTMLButtonElement,
    trackList: document.getElementById('trackList') as HTMLElement,
    trackListBody: document.getElementById('trackListBody') as HTMLElement,
    selectAll: document.getElementById('selectAll') as HTMLInputElement,
    settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
    settingsModal: document.getElementById('settingsModal') as HTMLElement,
    closeSettingsBtn: document.getElementById('closeSettingsBtn') as HTMLButtonElement,
    outputDir: document.getElementById('outputDir') as HTMLInputElement,
    selectFolderBtn: document.getElementById('selectFolderBtn') as HTMLButtonElement,
    formatSelect: document.getElementById('formatSelect') as HTMLSelectElement,
    qualitySelect: document.getElementById('qualitySelect') as HTMLSelectElement,
    saveSettingsBtn: document.getElementById('saveSettingsBtn') as HTMLButtonElement,
    openOutputFolderBtn: document.getElementById('openOutputFolderBtn') as HTMLButtonElement,
    dependencyWarning: document.getElementById('dependencyWarning') as HTMLElement,
    dependencyMessage: document.getElementById('dependencyMessage') as HTMLElement,
    overallProgressBar: document.getElementById('overallProgressBar') as HTMLElement,
    overallProgressText: document.getElementById('overallProgressText') as HTMLElement,
};

// Initialize
async function init() {
    if (!electronAPI) {
        console.warn('Electron API unavailable. Stopping initialization.');
        renderUnsupportedEnvironment();
        return;
    }
    console.log('init() started');
    await loadSettings();
    await checkDependencies();
    setupEventListeners();
    setupProgressListener();
    console.log('init() completed');
}

async function loadSettings() {
    console.log('loadSettings() called');
    try {
        const savedSettings = await assertElectronAPI().settings.getAll();
        console.log('savedSettings:', savedSettings);
        settings = { ...settings, ...savedSettings };
        elements.outputDir.value = settings.outputDir;
        elements.formatSelect.value = settings.format;
        elements.qualitySelect.value = settings.quality;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function checkDependencies() {
    const deps = await assertElectronAPI().check.dependencies();

    if (!deps.ytDlp || !deps.ffmpeg) {
        const missing = [];
        if (!deps.ytDlp) missing.push('yt-dlp');
        if (!deps.ffmpeg) missing.push('ffmpeg');

        elements.dependencyMessage.textContent =
            `Dépendances manquantes: ${missing.join(', ')}. Le téléchargement ne fonctionnera pas.`;
        elements.dependencyWarning.classList.remove('hidden');
    }
}

function setupEventListeners() {
    console.log('setupEventListeners called');
    console.log('loadPlaylistBtn:', elements.loadPlaylistBtn);
    // Load playlist
    elements.loadPlaylistBtn.addEventListener('click', loadPlaylist);
    elements.playlistUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadPlaylist();
    });

    // Search and download
    elements.searchAllBtn.addEventListener('click', searchAllTracks);
    elements.downloadAllBtn.addEventListener('click', downloadSelectedTracks);
    elements.cancelBtn.addEventListener('click', cancelDownload);

    // Select all
    elements.selectAll.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        currentPlaylist?.tracks.forEach((track) => {
            track.selected = checked;
        });
        renderTrackList();
    });

    // Settings
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.remove('hidden');
    });
    elements.closeSettingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.add('hidden');
    });
    elements.selectFolderBtn.addEventListener('click', selectOutputFolder);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.openOutputFolderBtn.addEventListener('click', () => {
        assertElectronAPI().shell.openFolder(settings.outputDir);
    });

    // Close modal on outside click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            elements.settingsModal.classList.add('hidden');
        }
    });
}

function setupProgressListener() {
    assertElectronAPI().download.onProgress((progress) => {
        if (! currentPlaylist) return;

        const track = currentPlaylist.tracks.find(
            (t) => `${t.artist} - ${t.title}` === progress.title
        );

        if (track) {
            track.status = progress.status;
            track.progress = progress.progress;
            updateTrackStatus(track);
            updateOverallProgress();
        }
    });
}

async function loadPlaylist() {
    console.log('loadPlaylist called');
    const url = elements.playlistUrl.value.trim();
    console.log('URL:', url);
    if (!url) return;

    elements.loadPlaylistBtn.disabled = true;
    elements.loadPlaylistBtn.textContent = 'Chargement...';

    try {
        console.log('Calling electronAPI.deezer.getPlaylist...');
        const result = await assertElectronAPI().deezer.getPlaylist(url);
        console.log('Result:', result);

        if (!result.success) {
            alert(`Erreur: ${result.error}`);
            return;
        }

        currentPlaylist = {
            ...result.data,
            tracks: result.data.tracks.map((t: any) => ({
                ...t,
                status: 'pending',
                selected: true,
            })),
        };

        displayPlaylist();
    } catch (error) {
        alert(`Erreur: ${(error as Error).message}`);
    } finally {
        elements.loadPlaylistBtn.disabled = false;
        elements.loadPlaylistBtn.textContent = 'Charger';
    }
}

function displayPlaylist() {
    if (!currentPlaylist) return;

    elements.playlistCover.src = currentPlaylist.picture_medium;
    elements.playlistTitle.textContent = currentPlaylist.title;
    elements.playlistDescription.textContent = currentPlaylist.description || '';
    elements.playlistTrackCount.textContent = `${currentPlaylist.nb_tracks} titres`;

    elements.playlistInfo.classList.remove('hidden');
    elements.trackList.classList.remove('hidden');

    renderTrackList();
}

function renderTrackList() {
    if (!currentPlaylist) return;

    elements.trackListBody.innerHTML = currentPlaylist.tracks
        .map((track, index) => createTrackRow(track, index))
        .join('');

    // Add event listeners for checkboxes
    currentPlaylist.tracks.forEach((track, index) => {
        const checkbox = document.getElementById(`track-${index}`) as HTMLInputElement;
        checkbox?.addEventListener('change', (e) => {
            track.selected = (e.target as HTMLInputElement).checked;
            updateDownloadButton();
        });
    });
}

function createTrackRow(track: Track, index: number): string {
    let youtubeCell = '';
    let statusCell = '';

    switch (track.status) {
        case 'pending':
            youtubeCell = '<span class="not-searched">-</span>';
            statusCell = '<span class="status-pending">En attente</span>';
            break;
        case 'searching':
            youtubeCell = '<span class="searching">🔍 Recherche... </span>';
            statusCell = '<span class="status-pending">Recherche</span>';
            break;
        case 'found':
            youtubeCell = `<a href="${track.youtubeUrl}" target="_blank" title="${track.youtubeTitle}">▶️ ${track.youtubeTitle?.substring(0, 30)}...</a>`;
            statusCell = '<span class="status-completed">✓ Trouvé</span>';
            break;
        case 'not-found':
            youtubeCell = '<span class="not-found">❌ Non trouvé</span>';
            statusCell = '<span class="status-error">Non trouvé</span>';
            break;
        case 'downloading':
            youtubeCell = `<a href="${track.youtubeUrl}" target="_blank">▶️ YouTube</a>`;
            statusCell = `<span class="status-downloading">⏳ ${track.progress?.toFixed(0) || 0}%</span>`;
            break;
        case 'completed':
            youtubeCell = `<a href="${track.youtubeUrl}" target="_blank">▶️ YouTube</a>`;
            statusCell = '<span class="status-completed">✓ Terminé</span>';
            break;
        case 'error':
            youtubeCell = `<a href="${track.youtubeUrl}" target="_blank">▶️ YouTube</a>`;
            statusCell = '<span class="status-error">❌ Erreur</span>';
            break;
    }

    return `
    <div class="track-item" id="track-row-${index}">
      <span class="col-check">
        <input type="checkbox" id="track-${index}" ${track.selected ? 'checked' :  ''} />
      </span>
      <span class="track-title" title="${track.title}">${track.title}</span>
      <span class="track-artist" title="${track.artist}">${track.artist}</span>
      <span class="track-youtube">${youtubeCell}</span>
      <span class="track-status">${statusCell}</span>
    </div>
  `;
}

function updateTrackStatus(track: Track) {
    if (!currentPlaylist) return;
    const index = currentPlaylist.tracks.indexOf(track);
    const row = document.getElementById(`track-row-${index}`);
    if (row) {
        row.outerHTML = createTrackRow(track, index);

        // Re-add event listener
        const checkbox = document.getElementById(`track-${index}`) as HTMLInputElement;
        checkbox?.addEventListener('change', (e) => {
            track.selected = (e.target as HTMLInputElement).checked;
            updateDownloadButton();
        });
    }
}

async function searchAllTracks() {
    if (!currentPlaylist) return;

    elements.searchAllBtn.disabled = true;
    elements.searchAllBtn.textContent = '🔍 Recherche en cours...';

    for (const track of currentPlaylist.tracks) {
        if (!track.selected) continue;

        track.status = 'searching';
        updateTrackStatus(track);

        try {
            const result = await assertElectronAPI().youtube.search(track.title, track.artist);

            if (result.success && result.data) {
                track.youtubeUrl = result.data.url;
                track.youtubeTitle = result.data.title;
                track.status = 'found';
            } else {
                track.status = 'not-found';
            }
        } catch (error) {
            track.status = 'not-found';
        }

        updateTrackStatus(track);
    }

    elements.searchAllBtn.disabled = false;
    elements.searchAllBtn.textContent = '🔍 Rechercher sur YouTube';
    updateDownloadButton();
}

function updateDownloadButton() {
    if (!currentPlaylist) return;

    const foundTracks = currentPlaylist.tracks.filter(
        (t) => t.selected && t.status === 'found'
    );

    elements.downloadAllBtn.disabled = foundTracks.length === 0;
    elements.downloadAllBtn.textContent = `📥 Télécharger (${foundTracks.length})`;
}

async function downloadSelectedTracks() {
    if (!currentPlaylist) return;

    const tracksToDownload = currentPlaylist.tracks.filter(
        (t) => t.selected && t.status === 'found' && t.youtubeUrl
    );

    if (tracksToDownload.length === 0) return;

    elements.progressSection.classList.remove('hidden');
    elements.cancelBtn.classList.remove('hidden');
    elements.downloadAllBtn.disabled = true;
    elements.searchAllBtn.disabled = true;

    let completed = 0;
    const total = tracksToDownload.length;

    for (const track of tracksToDownload) {
        try {
            await assertElectronAPI().download.video(
                track.youtubeUrl!,
                track.title,
                track.artist,
                {
                    outputDir: settings.outputDir,
                    format: settings.format,
                    quality: settings.quality,
                }
            );
            completed++;
        } catch (error) {
            console.error(`Erreur téléchargement ${track.title}:`, error);
        }

        updateOverallProgress();
    }

    elements.cancelBtn.classList.add('hidden');
    elements.downloadAllBtn.disabled = false;
    elements.searchAllBtn.disabled = false;
}

function updateOverallProgress() {
    if (!currentPlaylist) return;
    if (!elements.overallProgressBar || !elements.overallProgressText) return;

    const tracksToDownload = currentPlaylist.tracks.filter(
        (t) => t.selected && (t.status === 'found' || t.status === 'downloading' || t.status === 'completed')
    );

    const completed = currentPlaylist.tracks.filter(
        (t) => t.selected && t.status === 'completed'
    ).length;

    const total = tracksToDownload.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    elements.overallProgressBar.style.width = `${percent}%`;
    elements.overallProgressText.textContent = `${completed}/${total} téléchargés (${percent}%)`;
}

async function cancelDownload() {
    try {
        await assertElectronAPI().download.cancel();
        elements.cancelBtn.classList.add('hidden');
        elements.downloadAllBtn.disabled = false;
        elements.searchAllBtn.disabled = false;
    } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
    }
}

async function selectOutputFolder() {
    const folder = await assertElectronAPI().dialog.selectFolder();
    if (folder) {
        settings.outputDir = folder;
        elements.outputDir.value = folder;
    }
}

async function saveSettings() {
    settings.format = elements.formatSelect.value as 'mp3' | 'mp4';
    settings.quality = elements.qualitySelect.value as 'best' | 'worst';

    await assertElectronAPI().settings.set('outputDir', settings.outputDir);
    await assertElectronAPI().settings.set('format', settings.format);
    await assertElectronAPI().settings.set('quality', settings.quality);

    elements.settingsModal.classList.add('hidden');
}

// Start the application
init();
