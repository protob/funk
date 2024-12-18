import { ref } from 'vue'
import type { FetchError } from 'ofetch'
import { createError } from 'h3'
type GenerationType = 'title' | 'description' | 'about'
type Lang = 'de' | 'en'

interface TextGenerationOptions {
  text: string
  type: GenerationType
  language?: Lang
}

interface GenerateResponse {
  [key: string]: string
}

export const useTextGeneration = () => {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  const generateText = async ({ text, type, language = 'de' }: TextGenerationOptions): Promise<string> => {
    isGenerating.value = true
    error.value = null

    try {
      const response = await $fetch<GenerateResponse>('/api/podcast/episodes/generate-text', {
        method: 'POST',
        body: { text, type, language }
      })
      return response[type] || ''
    } catch (e) {
      const fetchError = e as FetchError
      error.value = fetchError.message || 'Failed to generate text'
      throw createError({ statusCode: fetchError.status || 500, message: error.value })
    } finally {
      isGenerating.value = false
    }
  }

  return { generateText, isGenerating, error }
}
