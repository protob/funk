import { defineEventHandler, createError, readBody } from 'h3'
import OpenAI from 'openai'
import type { TextGenerationType, GenerateTextRequest, GenerateTextResponse } from '~/types/podcast'

const openai = new OpenAI({ apiKey: useRuntimeConfig().openaiApiKey })

const prompts: Record<TextGenerationType, string> = {
  title: 'Generate a concise and technically focused title for a podcast episode. The title should be technical but can include subtle abstract humor. Format the title as "Topic: Subtitle". Output a clean title without any quotes or trailing punctuation. Base it on this transcript: ',
  description: 'Create a very brief description (maximum 10-15 words) that captures the core message without repeating the title topic. Focus on the key insight or revelation. The description should complement the title rather than repeat it. Base it on this transcript: ',
  about: 'Write 1-3 concise sentences explaining what this podcast episode is about. Be direct and technical in tone. Base it on this transcript: '
}

const generateCompletion = (text: string, type: TextGenerationType, language: 'de' | 'en') => 
  openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a technical writer specializing in concise, engaging podcast content. For descriptions, focus on the unique angle or insight without repeating the title\'s topic. Always provide clean, ready-to-use output without any need for post-processing.' },
      { role: 'user', content: `${prompts[type]} ${text}. Output in ${language}.` }
    ],
    temperature: 0.7,
    max_tokens: type === 'description' ? 50 : 150
  })

export default defineEventHandler(async (event): Promise<GenerateTextResponse> => {
  const { text, type, language = 'de' } = await readBody<GenerateTextRequest>(event)
  
  if (!text || !type) throw createError({ statusCode: 400, message: 'Missing required fields' })

  try {
    const response = await generateCompletion(text, type, language)
    return { [type]: response.choices[0]?.message?.content?.trim() ?? '' }
  } catch (error) {
    throw createError({
      statusCode: (error as any).response?.status ?? 500,
      message: (error as Error).message ?? 'Failed to generate text'
    })
  }
})
