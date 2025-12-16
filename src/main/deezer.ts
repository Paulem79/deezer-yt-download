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

      // Récupérer tous les tracks (gestion de la pagination) en parallèle
      const limit = 100;
      const pageCount = Math.max(
        1,
        Math.ceil((playlistData.nb_tracks || 0) / limit)
      );

      const trackRequests = Array.from({ length: pageCount }, (_value, index) =>
        axios.get(
          `${DEEZER_API_BASE}/playlist/${playlistId}/tracks?limit=${limit}&index=${index * limit}`
        )
      );

      const trackResponses = await Promise.all(trackRequests);

      for (const tracksResponse of trackResponses) {
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
