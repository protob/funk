import type { FetchError } from 'ofetch'
import { createError } from 'h3'
import type { 
  // Series, 
  SeriesListResponse, 
  SeriesDetailsResponse, 
  EpisodeResponse, 
  Character,
  ApiError 
} from '~/types/podcast'

export const usePodcastCrud = () => {
  const fetchWrapper = async <T>(url: string): Promise<T> => {
    try {
      return await $fetch<T>(url, {
        headers: { 
          'Accept': 'application/json',
          // 'Cache-Control': 'no-cache' 
        }
      })
    } catch (error) {
      console.error(`Error fetching ${url}:`, error)
      const apiError: ApiError = {
        error: 'FetchError',
        statusCode: (error as FetchError).status || 500,
        message: (error as Error).message || `Failed to fetch data from ${url}`
      }
      throw createError(apiError)
    }
  }

  return {
    getSeriesList: () => 
      fetchWrapper<SeriesListResponse>('/api/podcast/series'),
    
    getSingleSeries: (seriesId: string) => 
      fetchWrapper<SeriesDetailsResponse>(`/api/podcast/series/${seriesId}`),
    
    getEpisode: (seriesId: string, episodeId: string) => 
      fetchWrapper<EpisodeResponse>(`/api/podcast/episodes/${seriesId}/${episodeId}`),
    
    getCharacters: () => 
      fetchWrapper<Character[]>('/api/podcast/characters')
  }
}