import { defineEventHandler, createError } from 'h3'
import { readMultipartFormData } from 'h3'
import { AssemblyAI } from 'assemblyai'

const client = new AssemblyAI({ apiKey: useRuntimeConfig().assemblyaiApiKey })

type AudioData = { audio: Buffer; language: string }
type TranscriptionResult = { text: string; utterances: any[] }

const getAudioData = (formData: Awaited<ReturnType<typeof readMultipartFormData>>): AudioData => {
  if (!formData) throw createError({ statusCode: 400, message: 'No form data received' })
  const audioItem = formData.find(item => item.name === 'audio')
  if (!audioItem?.data) throw createError({ statusCode: 400, message: 'No audio file received' })
  return {
    audio: Buffer.from(audioItem.data),
    language: formData.find(item => item.name === 'language')?.data?.toString() ?? 'de'
  }
}

const transcribe = async ({ audio, language }: AudioData): Promise<TranscriptionResult> => {
  const transcript = await client.transcripts.transcribe({
    audio,
    speaker_labels: true,
    language_code: language
  })

  if (transcript.status === 'error') {
    throw createError({ statusCode: 500, message: `Transcription failed: ${transcript.error}` })
  }

  return { 
    text: transcript.text ?? '', 
    utterances: transcript.utterances ?? []
  }
}

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    return await transcribe(getAudioData(formData))
  } catch (err) {
    throw createError({
      statusCode: (err as any).response?.status ?? 500,
      message: (err as Error).message ?? 'Failed to transcribe audio'
    })
  }
})
