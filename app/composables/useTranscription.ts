import { ref } from 'vue'
import type { FetchError } from 'ofetch'
import { createError } from 'h3'
type Lang = 'de' | 'en'
type ApiResponse<T> = { text: T }

export const useTranscription = () => {
  const isTranscribing = ref(false)
  const transcriptionError = ref<string | null>(null)

  const handleError = (e: unknown) => {
    const error = e as FetchError
    transcriptionError.value = error.message || 'An error occurred'
    throw createError({ statusCode: error.status || 500, message: transcriptionError.value })
  }

  const transcribeAudio = async (file: File, language: Lang = 'de'): Promise<string | undefined> => {
    isTranscribing.value = true
    transcriptionError.value = null

    try {
      const form = new FormData()
      form.append('audio', file)
      form.append('language', language)

      const { text } = await $fetch<ApiResponse<string>>('/api/podcast/episodes/transcribe', {
        method: 'POST',
        body: form
      })

      return text
    } catch (e) {
      handleError(e)
    } finally {
      isTranscribing.value = false
    }
  }

  const translateTranscription = async (text: string, targetLang: Lang = 'en'): Promise<string | undefined> => {
    try {
      const { text: translatedText } = await $fetch<ApiResponse<string>>('/api/podcast/episodes/translate', {
        method: 'POST',
        body: { text, targetLanguage: targetLang }
      })

      return translatedText
    } catch (e) {
      handleError(e)
    }
  }

  return {
    transcribeAudio,
    translateTranscription,
    isTranscribing,
    transcriptionError
  }
}
