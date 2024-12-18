import { defineEventHandler, createError, readBody } from 'h3'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { PodcastMetadata } from '~/types/podcast'

const openai = new OpenAI({ apiKey: useRuntimeConfig().openaiApiKey })

const MetadataSchema = z.object({
  categories: z.array(z.string()).describe("Broad content categories"),
  tags: z.array(z.string()).describe("Specific keywords and topics"),
  keyTopics: z.array(z.string()).describe("Main subjects discussed")
})

const generateMetadata = (text: string) => openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are an expert content analyzer.' },
    { role: 'user', content: `Analyze the following text and provide metadata:\n\n${text}` }
  ],
  temperature: 0.3,
  response_format: zodResponseFormat(MetadataSchema, "metadata")
})

export default defineEventHandler(async (event) => {
  const { text } = await readBody<{ text: string }>(event)
  if (!text) {
    throw createError({ statusCode: 400, message: 'No text provided for metadata generation' })
  }

  try {
    const response = await generateMetadata(text)
    const content = response.choices[0]?.message?.content ?? ''
    const metadata = JSON.parse(content) as PodcastMetadata

    if (!metadata) {
      throw createError({ statusCode: 500, message: 'No metadata generated' })
    }

    return { metadata }
  } catch (err) {
    throw createError({
      statusCode: (err as any).response?.status ?? 500,
      message: (err as Error).message ?? 'Failed to generate metadata'
    })
  }
})