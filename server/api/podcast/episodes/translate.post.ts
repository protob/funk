import { defineEventHandler, createError, readBody } from 'h3'
import OpenAI from 'openai'
import type { Language } from '~/types/podcast'

const openai = new OpenAI({ apiKey: useRuntimeConfig().openaiApiKey })

type TranslateRequest = {
  text: string
  targetLanguage?: Language
}

const translate = async (text: string, targetLanguage: Language = 'en') => {
  const model = 'gpt-4o-mini'
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a professional translator. Translate the following text to ${targetLanguage === 'en' ? 'English' : 'German'}. Maintain the original meaning and tone while ensuring natural flow in the target language.`
    },
    { role: 'user', content: text }
  ]

  return openai.chat.completions.create({ model, messages, temperature: 0.3 })
}

export default defineEventHandler(async (event) => {
  const { text, targetLanguage = 'en' } = await readBody<TranslateRequest>(event)

  if (!text) {
    throw createError({ statusCode: 400, message: 'No text provided for translation' })
  }

  const completion = await translate(text, targetLanguage)
  const translatedText = completion.choices[0]?.message?.content

  if (!translatedText) {
    throw createError({ statusCode: 500, message: 'No translation generated' })
  }

  try {
    return { text: translatedText }
  } catch (err) {
    const error = err as Error
    throw createError({
      statusCode: (err as any)?.response?.status ?? 500,
      message: error.message ?? 'Failed to translate text'
    })
  }
})