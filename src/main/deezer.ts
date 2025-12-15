import axios from 'axios';

export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface DeezerPlaylist {
  id: number;
  title: string;
  description: string;
  nb_tracks: number;
  picture_medium: string;
  tracks: DeezerTrack[];
}

const DEEZER_API_BASE = 'https://api.deezer.com';

export class DeezerService {
  /**
   * Extrait l'ID de la playlist depuis une URL Deezer
   */
  static extractPlaylistId(url: string): string | null {
    const patterns = [
      /deezer\.com\/(?:\w+\/)?playlist\/(\d+)/,
      /^(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Récupère les informations d'une playlist Deezer
   */
  static async getPlaylist(playlistId: string): Promise<DeezerPlaylist> {
    try {
      // Récupérer les infos de base de la playlist
      const playlistResponse = await axios.get(
        `${DEEZER_API_BASE}/playlist/${playlistId}`
      );

      if (playlistResponse.data.error) {
        throw new Error(playlistResponse.data.error.message);
      }

      const playlistData = playlistResponse.data;
      const tracks: DeezerTrack[] = [];

      // Récupérer tous les tracks (gestion de la pagination)
      let tracksUrl = `${DEEZER_API_BASE}/playlist/${playlistId}/tracks?limit=100`;

      console.log(tracksUrl)

      while (tracksUrl) {
        const tracksResponse = await axios.get(tracksUrl);
        const tracksData = tracksResponse.data;

        for (const track of tracksData.data) {
          tracks.push({
            id: track.id,
            title: track.title,
            artist: track.artist.name,
            album: track.album.title,
            duration: track.duration,
          });
        }

        tracksUrl = tracksData.next || null;
      }

      return {
        id: playlistData.id,
        title: playlistData.title,
        description: playlistData.description || '',
        nb_tracks: playlistData.nb_tracks,
        picture_medium: playlistData.picture_medium,
        tracks,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Erreur Deezer API: ${error.message}`);
      }
      throw error;
    }
  }
}