import Innertube from 'youtubei.js';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  url: string;
}

export class YouTubeService {
  private static innertube: Innertube | null = null;

  /**
   * Initialise le client YouTube
   */
  static async init(): Promise<void> {
    if (!this.innertube) {
      this.innertube = await Innertube.create();
    }
  }

  /**
   * Recherche une vidéo sur YouTube
   */
  static async searchVideo(
    title: string,
    artist: string
  ): Promise<YouTubeSearchResult | null> {
    await this.init();

    if (!this.innertube) {
      throw new Error('YouTube client non initialisé');
    }

    const query = `${artist} - ${title} official audio`;

    try {
      const search = await this.innertube.search(query, { type: 'video' });
      
      if (! search.results || search.results.length === 0) {
        // Essayer avec une recherche plus simple
        const simpleSearch = await this.innertube.search(`${artist} ${title}`, {
          type: 'video',
        });
        
        if (!simpleSearch.results || simpleSearch.results.length === 0) {
          return null;
        }

        const video = simpleSearch.results[0] as any;
        return {
          videoId: video.id,
          title: video.title?.text || '',
          channel: video.author?.name || '',
          duration: video.duration?.text || '',
          url: `https://www.youtube.com/watch?v=${video.id}`,
        };
      }

      const video = search.results[0] as any;
      return {
        videoId: video.id,
        title: video.title?.text || '',
        channel: video.author?.name || '',
        duration: video.duration?.text || '',
        url: `https://www.youtube.com/watch?v=${video.id}`,
      };
    } catch (error) {
      console.error(`Erreur recherche YouTube pour "${title}":`, error);
      return null;
    }
  }

  /**
   * Recherche plusieurs vidéos
   */
  static async searchVideos(
    tracks: Array<{ title: string; artist: string }>
  ): Promise<Map<string, YouTubeSearchResult | null>> {
    const results = new Map<string, YouTubeSearchResult | null>();

    for (const track of tracks) {
      const key = `${track.artist} - ${track.title}`;
      const result = await this.searchVideo(track.title, track.artist);
      results.set(key, result);
      
      // Petit délai pour éviter le rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return results;
  }
}