import type { FetchError } from 'ofetch'
import { createError } from 'h3'

interface Metadata {
  categories: string[]
  tags: string[]
  keyTopics: string[]
}

export const useMetadata = () => ({
  generateMetadataFromText: async (text: string): Promise<Metadata> => {
    try {
      const { metadata } = await $fetch<{ metadata: Metadata }>('/api/podcast/episodes/metadata', {
        method: 'POST',
        body: { text }
      })
      return metadata
    } catch (error) {
      console.error('Failed to generate metadata:', error)
      throw createError({
        statusCode: (error as FetchError).status || 500,
        message: (error as Error).message || 'Failed to generate metadata'
      })
    }
  }
})
