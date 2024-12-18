import { ref } from 'vue'
import type { FetchError } from 'ofetch'
import { createError } from 'h3'

interface DiarizationSegment {
  speaker: number
  text: string
}

export const useDiarization = () => {
  const isDiarizing = ref(false)
  const error = ref<string | null>(null)

  const processAudio = async (audioFile: File): Promise<DiarizationSegment[]> => {
    isDiarizing.value = true
    error.value = null

    const formData = new FormData()
    formData.append('audio', audioFile)
    formData.append('language', 'de')

    try {
      const { utterances } = await $fetch<{ utterances: DiarizationSegment[] }>('/api/podcast/episodes/transcribe', {
        method: 'POST',
        body: formData
      })
      return utterances || []
    } catch (e) {
      const fetchError = e as FetchError
      error.value = fetchError.message || 'Audio processing failed'
      console.error('Diarization failed:', fetchError)
      throw createError({ statusCode: fetchError.status || 500, message: error.value })
    } finally {
      isDiarizing.value = false
    }
  }

  return { processAudio, isDiarizing, error }
}
