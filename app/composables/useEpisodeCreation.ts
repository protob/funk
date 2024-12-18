export function useEpisodeCreation() {
  const createEpisode = async ({
    seriesId,
    episodeId,
    audioFile,
    provider,
    title,
    about,
    date,
    description,
    transcriptionDE,
    transcriptionEN,
    transcriptionTimestampsDE, // Add this parameter
    metadata
  }: {
    seriesId: string;
    episodeId: string;
    audioFile?: File;
    provider: string;
    title: string;
    about: string;
    date: string;
    description: string;
    transcriptionDE?: string;
    transcriptionEN?: string;
    transcriptionTimestampsDE?: any; // Add type for timestamps
    metadata: {
      categories: string[];
      tags: string[];
      keyTopics: string[];
    };
  }) => {
    const formData = new FormData();
    formData.append('seriesId', seriesId);
    formData.append('episodeId', episodeId);
    formData.append('title', title);
    formData.append('about', about);
    formData.append('date', date);
    formData.append('description', description);
    formData.append('provider', provider);
    
    if (audioFile) {
      formData.append('audioFile', audioFile);
    }
    
    if (transcriptionDE) {
      formData.append('transcriptionDE', transcriptionDE);
    }
    
    if (transcriptionEN) {
      formData.append('transcriptionEN', transcriptionEN);
    }

    // Add timestamps data
    if (transcriptionTimestampsDE) {
      formData.append('timestampsDE', JSON.stringify(transcriptionTimestampsDE));
    }
    
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch('/api/podcast/episodes/create', {
      method: 'POST',
      body: formData
    });

    return await response.json();
  };

  return {
    createEpisode
  };
}