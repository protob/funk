import { defineEventHandler, createError } from 'h3'
import { readMultipartFormData } from 'h3'
import { toFile } from 'openai/uploads'
import type { FileLike } from 'openai/uploads'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: useRuntimeConfig().openaiApiKey })

type AudioData = { file: FileLike; language: string }

const getAudioData = async (formData: Awaited<ReturnType<typeof readMultipartFormData>>): Promise<AudioData> => {
  if (!formData) throw createError({ statusCode: 400, message: 'No form data received' })
  
  const audioItem = formData.find(item => item.name === 'audio')
  if (!audioItem?.data) throw createError({ statusCode: 400, message: 'No audio file received' })
  
  return {
    file: await toFile(Buffer.from(audioItem.data), 'audio.mp3'),
    language: formData.find(item => item.name === 'language')?.data?.toString() ?? 'de'
  }
}

const transcribeAudio = ({ file, language }: AudioData): Promise<string> =>
  openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
    temperature: 1.0,
    language
  })

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    const audioData = await getAudioData(formData)
    const text = await transcribeAudio(audioData)
    return { text }
  } catch (err) {
    throw createError({
      statusCode: (err as any).response?.status ?? 500,
      message: (err as Error).message ?? 'Failed to transcribe audio'
    })
  }
})
