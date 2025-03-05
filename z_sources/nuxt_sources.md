## server/tsconfig.json
```
{
    "extends": "../.nuxt/tsconfig.server.json"
}
  ```

## server/middleware/serve-podcast-audio.ts
```
import { defineEventHandler, createError } from 'h3'
import { readFile, readdir, access } from 'fs/promises'
import { join, extname } from 'path'
import { createHash } from 'crypto'
import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()
const PODCAST_BASE_PATH = config.appDataPath
const DEFAULT_LANG = 'de'
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac']

async function findFirstAudioFile(directory: string): Promise<string | null> {
  try {
    const files = await readdir(directory)
    const audioFile = files.find(file =>
        SUPPORTED_AUDIO_FORMATS.includes(extname(file).toLowerCase())
    )
    return audioFile || null
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const url = event.node.req.url
  if (!url?.startsWith('/api/podcast/audio/')) return

  // Extract path and language from URL
  // Format: /api/podcast/audio/series/:seriesId/episodes/:episodeId/:lang?
  const parts = url.slice('/api/podcast/audio/'.length).split('/')
  const lang = parts.length >= 5 ? parts[4] : DEFAULT_LANG

  const audioDir = join(PODCAST_BASE_PATH, ...parts.slice(0, 4), lang, 'audio')

  // Find first audio
  const audioFileName = await findFirstAudioFile(audioDir)
  if (!audioFileName) {
    throw createError({
      statusCode: 404,
      statusMessage: `No supported audio file found in ${audioDir}`
    })
  }

  const audioPath = join(audioDir, audioFileName)
  const ext = extname(audioPath).toLowerCase()

  // MIME types
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac'
  }

  try {
    await access(audioPath)
    const audio = await readFile(audioPath)

    event.node.res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
    event.node.res.setHeader('Cache-Control', 'no-store, must-revalidate')
    event.node.res.setHeader('Pragma', 'no-cache')
    event.node.res.setHeader('Expires', '0')

    const hash = createHash('md5').update(audio).digest('hex')
    const etag = `"${hash}"`
    event.node.res.setHeader('ETag', etag)

    const ifNoneMatch = event.node.req.headers['if-none-match']
    if (ifNoneMatch === etag) {
      event.node.res.statusCode = 304
      return
    }

    return audio
  } catch (error: any) {
    console.error('Error serving podcast audio:', error)
    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Audio file not found'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Error serving audio: ${error.message}`
    })
  }
})```

## server/middleware/serve-podcast-images.ts
```
import { defineEventHandler, createError } from 'h3'
import { readFile, readdir } from 'fs/promises'
import { join, extname } from 'path'

import { useRuntimeConfig } from '#imports'
const config = useRuntimeConfig()
const PODCAST_BASE_PATH = config.appDataPath

const validImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

async function findDefaultImage(dirPath: string): Promise<{ filePath: string; contentType: string } | null> {
  try {
    // default image
    const files = await readdir(dirPath)
    const defaultImage = files.find(file =>
        file.toLowerCase().startsWith('default') &&
        validImageTypes.includes(extname(file).toLowerCase())
    )

    // img subdirectory
    if (!defaultImage) {
      try {
        const imgPath = join(dirPath, 'img')
        const imgFiles = await readdir(imgPath)
        const imgDefaultImage = imgFiles.find(file =>
            file.toLowerCase().startsWith('default') &&
            validImageTypes.includes(extname(file).toLowerCase())
        )
        if (imgDefaultImage) {
          return getImageInfo(join(imgPath, imgDefaultImage))
        }
      } catch {
        // No img
      }
      return null
    }

    return getImageInfo(join(dirPath, defaultImage))
  } catch (error) {
    return null
  }
}

function getImageInfo(filePath: string) {
  const ext = extname(filePath).toLowerCase()
  let contentType = 'image/jpeg'
  if (ext === '.png') contentType = 'image/png'
  if (ext === '.gif') contentType = 'image/gif'
  if (ext === '.webp') contentType = 'image/webp'

  return {
    filePath,
    contentType
  }
}

export default defineEventHandler(async (event) => {
  const url = event.node.req.url
  if (!url?.startsWith('/api/podcast/images/')) return

  let imagePath: string
  if (url.startsWith('/api/podcast/images/characters/')) {
    const characterId = url.split('/api/podcast/images/characters/')[1].split('/')[0]
    imagePath = join(PODCAST_BASE_PATH, 'characters', characterId)
  } else if (url.startsWith('/api/podcast/images/series/')) {
    const seriesId = url.split('/api/podcast/images/series/')[1].split('/')[0]
    imagePath = join(PODCAST_BASE_PATH, 'series', seriesId)
  } else {
    return
  }

  const imageInfo = await findDefaultImage(imagePath)
  if (!imageInfo) {
    throw createError({
      statusCode: 404,
      statusMessage: `No default image found at path: ${imagePath}`
    })
  }

  try {
    const image = await readFile(imageInfo.filePath)
    event.node.res.setHeader('Content-Type', imageInfo.contentType)
    return image
  } catch (error: any) {
    console.error('Error serving image:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Error serving image: ${error.message}`
    })
  }
})```

## server/types/podcast.ts
```
// Base types
type Base = {
  id: string
  name?: string
}

type MetadataBase = {
  categories: string[]
  tags: string[]
  keyTopics: string[]
}

type ContentBase = {
  title: string
  description: string
  about: string
}

// Core types
export type PodcastMetadata = MetadataBase

export type Character = {
  characterId: string
  name: string
  about: string
  tags: string[]
  imgPath: string
}

export type Series = Base & {
  about?: Record<string, unknown>
}

export interface TranscriptWord {
  text: string
  start: number
  end: number
}

export interface TranscriptSegment {
  speaker: string
  text: string
  start: number
  end: number
  words: TranscriptWord[]
}

export interface LanguageContent {
  audioUrl?: string
  dialogue?: string
  timestamps?: TranscriptSegment[]
}

export type EpisodeConfig = ContentBase & MetadataBase & {
  seriesId: string
  episodeId: string
  date: string
  imgPath: string
  provider: string
  hosts: string[]
}

export type PodcastEpisode = ContentBase & {
  id: string
  seriesId: string
  date: string
  metadata: PodcastMetadata
  audioUrl: string
  provider: string
  languages: string[]
  languageContent: Record<string, LanguageContent>
  hosts?: string[]
}

// Response types
export type SeriesListResponse = {
  series: Series[]
}

export type SeriesDetailsResponse = Series & {
  episodes: Array<{
    id: string
    date: string
    path: string
  }>
}

export type EpisodeResponse = PodcastEpisode & {
  series: Series
}

export type CharacterListResponse = {
  characters: Character[]
}

export type ApiError = {
  error: string
  statusCode: number
  message: string
}

// Text generation types
export type TextGenerationType = 'title' | 'description' | 'about'

export type GenerateTextRequest = {
  text: string
  type: TextGenerationType
  language?: 'de' | 'en'
}

export type GenerateTextResponse = Partial<ContentBase>

// Utility types
export type Language = 'de' | 'en'

export type Provider = 'notebooklm' | 'elevenlabs' | 'openai' | 'mixed'

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac'



// Api
export type EpisodeData = {
  path: string
  meta: EpisodeConfig
  langs: Language[]
  content: Record<string, LanguageContent>
}

export type EpisodeParams = {
  seriesId: string
  episodeId: string
  lang?: Language
}
```

## server/api/podcast/series/index.get.ts
```
import { defineEventHandler } from 'h3'
import { readdir } from 'fs/promises'

import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()
const BASE = `${config.appDataPath}/series`

interface Series {
  id: string
  name: string
  imgPath: string
}

export default defineEventHandler(async (): Promise<{ series: Series[] }> => {
  const dirs = await readdir(BASE)
  return {
    series: dirs.map(dir => ({
      id: dir,
      name: dir,
      imgPath: `/api/podcast/images/series/${dir}`
    }))
  }
})
```

## server/api/podcast/series/[seriesId].ts
```
import { defineEventHandler, getRouterParam } from 'h3'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type { SeriesDetailsResponse } from '~/types/podcast'

const BASE = '/home/dtb/Music/textmixture-funk/podcasts/series'

const getAbout = async (path: string): Promise<Record<string, unknown>> => {
  try {
    return yaml.load(await readFile(join(path, 'about.yaml'), 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

interface EpisodeInfo {
  id: string
  date: string
  path: string
}

const parseEpisode = (seriesId: string) => (dir: string): EpisodeInfo => ({
  id: dir,
  date: dir.split('_')[1] || '',
  path: `/api/podcast/episodes/${seriesId}/${dir}`
})

export default defineEventHandler(async (event): Promise<SeriesDetailsResponse> => {
  const seriesId = getRouterParam(event, 'seriesId')
  if (!seriesId) throw createError({ statusCode: 400, statusMessage: 'Series ID is required' })

  const seriesPath = join(BASE, seriesId)

  const [about, dirs] = await Promise.all([
    getAbout(seriesPath),
    readdir(join(seriesPath, 'episodes'))
  ])

  return {
    id: seriesId,
    name: seriesId,
    about,
    episodes: dirs
      .filter(dir => dir.startsWith('ep'))
      .map(parseEpisode(seriesId))
      .sort((a, b) => b.date.localeCompare(a.date))
  }
})
```

## server/api/podcast/episodes/transcribe-openai.post.ts
```
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
```

## server/api/podcast/episodes/create.post.ts
```
import { defineEventHandler, createError } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type { EpisodeConfig } from '~/types/podcast'

import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()
const BASE = config.appDataPath

const ensureDir = (path: string) => mkdir(path, { recursive: true })
const writeContent = (path: string, content: string | Buffer) => writeFile(path, content)

const yamlConfig = {
  lineWidth: -1, noRefs: true, quotingType: '', flowLevel: -1, noCompatMode: true,
  sortKeys: false, forceQuotes: false, noQuotes: true, skipInvalid: true,
  styles: { '!!null': 'empty', '!!str': 'plain', '!!seq': 'block' },
  schema: yaml.DEFAULT_SCHEMA
}

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No form data received' })

  const getValue = (name: string) => formData.find(item => item.name === name)?.data.toString()
  const seriesId = getValue('seriesId')
  const episodeId = getValue('episodeId')
  const timestampsDE = getValue('timestampsDE') // New field for German timestamps
  
  if (!seriesId || !episodeId) throw createError({ statusCode: 400, message: 'Missing required fields: seriesId or episodeId' })

  const epNumber = episodeId.split('_')[0]
  const episodePath = join(BASE, 'series', seriesId, 'episodes', episodeId)
  
  await ensureDir(episodePath)

  const metadata: EpisodeConfig = {
    seriesId,
    episodeId: epNumber,
    date: getValue('date') || new Date().toISOString().split('T')[0],
    title: getValue('title') || epNumber,
    imgPath: 'default.png',
    description: getValue('description') || '',
    about: getValue('about') || '',
    provider: getValue('provider') || 'elevenlabs',
    ...(JSON.parse(getValue('metadata') || '{}')),
    hosts: ['inga', 'konrad']
  }

  // Handle German timestamps if provided
  const writeTimestamps = async () => {
    if (timestampsDE) {
      const deDir = join(episodePath, 'de')
      await ensureDir(deDir)
      await writeContent(
        join(deDir, 'dialogue-timestamps.json'), 
        JSON.stringify(JSON.parse(timestampsDE), null, 2)
      )
    }
  }

  const writeOperations = [
    writeContent(join(episodePath, 'metadata.yaml'), yaml.dump(metadata, yamlConfig)),
    getValue('transcriptionDE') && ensureDir(join(episodePath, 'de')).then(() => writeContent(join(episodePath, 'de', 'dialogue.txt'), getValue('transcriptionDE')!)),
    getValue('transcriptionEN') && ensureDir(join(episodePath, 'en')).then(() => writeContent(join(episodePath, 'en', 'dialogue.txt'), getValue('transcriptionEN')!)),
    // Add timestamps saving operation
    getValue('timestampsDE') && ensureDir(join(episodePath, 'de')).then(() => 
      writeContent(
        join(episodePath, 'de', 'dialogue-timestamps.json'), 
        JSON.stringify(JSON.parse(getValue('timestampsDE')!), null, 2)
      )
    ),
    formData.find(item => item.name === 'audioFile')?.data && 
      ensureDir(join(episodePath, 'de', 'audio')).then(() => 
        writeContent(join(episodePath, 'de', 'audio', `de_${seriesId}_${epNumber}_${metadata.provider}.mp3`), 
                     formData.find(item => item.name === 'audioFile')!.data)
      )
  ].filter((op): op is Promise<void> => op instanceof Promise)
  
  await Promise.all(writeOperations).catch(error => {
    console.error('Error writing files:', error)
    throw createError({ statusCode: 500, message: 'Failed to create episode files' })
  })

  return { success: true, path: episodePath, content: metadata }
})```

## server/api/podcast/episodes/generate-text.post.ts
```
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
```

## server/api/podcast/episodes/transcribe.post.ts
```
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
```

## server/api/podcast/episodes/metadata.post.ts
```
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
})```

## server/api/podcast/episodes/translate.post.ts
```
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
})```

## server/api/podcast/episodes/[seriesId]/[episodeId].ts
```
import { defineEventHandler, getRouterParams, getQuery } from 'h3'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type { 
  PodcastEpisode, 
  LanguageContent, 
  Provider, 
  Language, 
  EpisodeConfig,
  TranscriptSegment 
} from '~/types/podcast'

const BASE = '/home/dtb/Music/textmixture-funk/podcasts/series'
const LANGS = ['de', 'en'] as const
const DEFAULT_LANG: Language = 'de'

const getLangContent = async (basePath: string, seriesId: string, episodeId: string, lang: Language): Promise<[string, LanguageContent]> => [
  lang,
  {
    audioUrl: `/api/podcast/audio/series/${seriesId}/episodes/${episodeId}/${lang}`,
    dialogue: await readFile(join(basePath, lang, 'dialogue.txt'), 'utf8').catch(() => undefined),
    timestamps: await readFile(join(basePath, lang, 'dialogue-timestamps.json'), 'utf8')
      .then(content => JSON.parse(content) as TranscriptSegment[])
      .catch(() => undefined)
  }
]

const buildEpisode = (
  { path, meta, langs, content }: { path: string; meta: EpisodeConfig; langs: Language[]; content: Record<string, LanguageContent> },
  { seriesId, episodeId, lang }: { seriesId: string; episodeId: string; lang?: Language }
): PodcastEpisode => ({
  id: episodeId,
  seriesId,
  title: meta.title,
  description: meta.description,
  about: meta.about,
  date: episodeId.split('_')[1] ?? '',
  audioUrl: content[langs.includes(lang ?? DEFAULT_LANG) ? lang ?? DEFAULT_LANG : DEFAULT_LANG]?.audioUrl ?? '',
  provider: meta.provider as Provider,
  languages: langs,
  metadata: {
    categories: meta.categories,
    tags: meta.tags,
    keyTopics: meta.keyTopics
  },
  hosts: meta.hosts,
  languageContent: content
})

export default defineEventHandler(async (event): Promise<PodcastEpisode> => {
  const { seriesId, episodeId } = getRouterParams(event)
  const { lang } = getQuery(event)
  
  if (!seriesId || !episodeId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing series ID or episode ID' })
  }

  const episodePath = join(BASE, seriesId, 'episodes', episodeId)
  const [meta, dirs] = await Promise.all([
    readFile(join(episodePath, 'metadata.yaml'), 'utf8').then(content => yaml.load(content) as EpisodeConfig),
    readdir(episodePath)
  ])

  const langs = dirs.filter((dir): dir is Language => LANGS.includes(dir as Language))
  const content = Object.fromEntries(await Promise.all(langs.map(l => getLangContent(episodePath, seriesId, episodeId, l))))

  return buildEpisode(
    { path: episodePath, meta, langs, content },
    { seriesId, episodeId, lang: lang as Language | undefined }
  )
})```

## server/api/podcast/characters.ts
```
import { defineEventHandler } from 'h3'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type { Character } from '~/types/podcast'

import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()
const CHARACTERS_BASE_PATH = `${config.appDataPath}/characters`

const readYamlFile = (path: string) => readFile(path, 'utf8').then(yaml.load)

const buildCharacterConfig = (dirName: string, config: Partial<Character>): Character => ({
  characterId: dirName,
  name: config.name ?? dirName,
  imgPath: `/api/podcast/images/characters/${dirName}`,
  about: config.about ?? '',
  tags: config.tags ?? []
})

export default defineEventHandler(async (event) => {
  const characterDirs = await readdir(CHARACTERS_BASE_PATH)
  
  const characters = await Promise.all(
    characterDirs.map(async dir => {
      try {
        const config = await readYamlFile(join(CHARACTERS_BASE_PATH, dir, 'about.yaml')) as Partial<Character>
        return buildCharacterConfig(dir, config)
      } catch (err) {
        console.error(`Failed to load character ${dir}:`, err)
        return null
      }
    })
  )

  return characters.filter((char): char is Character => char !== null)
})
```

## uno.config.ts
```
import {
    defineConfig,
    presetAttributify,
    presetIcons,
    presetUno,
    transformerCompileClass,
    transformerDirectives,
  } from 'unocss';
  
  import extractorPug from '@unocss/extractor-pug'


  // Utility function for rule generation
  type Rule = [RegExp, (m: [string, string, 'px' | 'rem' | '%']) => { [k: string]: string }]
  const generateRules = (map: Record<string, string>): Rule[] =>
    Object.entries(map).map(([prefix, prop]) => [
      new RegExp(`^${prefix}-\\[(\\d+)(px|rem|%)\\]$`),
      ([_, n, u]) => ({ [prop]: `${n}${u}` })
    ]);
  
  // Types for safelist
  type Suffix = number | string;
  interface ClassMap {
    [key: string]: Suffix[];
  }
  
  // Safelist classes definition
  const safelistClasses: ClassMap = {
    "bg-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "border-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "text-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "border": ["green-500", "blue-500"],
    "h": [6],
    "min-h": [6],
    "p": ["0.5"],
  
  };
  
  // Timeline extra classes
  const extraClasses = Array.from({ length: 21 }, (_, i) => `left-${i * 5}%`);
  

  // Main configuration
  export default defineConfig({

    extractors: [
        extractorPug(),
    ],


    // Important: Load presets first
    presets: [
      presetUno(),

    ],
  
    // Transformers
    transformers: [

      transformerCompileClass(),
      transformerDirectives({ enforce: 'pre' }),
    ],
  

  
    // Theme configuration
    theme: {

        breakpoints: {
            '2xs': '320px',
            xs: "480px",
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },

      colors: {
        active: { 100: '#ffffff', 400: '#3b82f6' },
        blk: {
          1: '#111827',
          2: '#1F2937',
          3: '#374151',
        },
        el: {
          1: '#334155',
          2: '#1E293B',
          3: '#064E3B',
          4: '#7C3AED',
          5: '#DB2777',
          6: '#059669',
          7: '#0284C7',
          8: '#DC2626',
          9: '#D97706',
          10: '#0EA5E9',
        },
        accent: {
          1: '#6B7280',
          2: '#FBBF24',
        },
        state: {
          success: '#4ADE80',
          error: '#EF4444',
          warning: '#F59E0B',
          disabled: '#A1A1AA',
        },
        brand: {
          primary: 'hsla(var(--hue, 217), 78%, 51%)',
        },
      },
    },
  
    // Custom rules
    rules: [
      ['px-100', { 'padding-left': '100px', 'padding-right': '100px' }],
      [/^left-(\d+)%$/, ([_, n]) => ({ left: `${n}%` })],
    ],
  
    // Shortcuts
    shortcuts: [
      {
        'custom-shortcut': 'text-lg text-orange hover:text-teal',
        'custom-btn': 'py-2 px-4 font-semibold rounded-lg shadow-md',
      },
      [/^btn-(.*)$/, ([, c]) => `bg-${c}-400 text-${c}-100 py-2 px-4 rounded-lg`],
    ],
  
    // Content pipeline
    content: {
      pipeline: {
        include: [
          '**/*.{vue,js,ts,jsx,tsx,html}',
        ],
      },
    },
  });```

## tsconfig.json
```
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "class-variance-authority": ["./node_modules/class-variance-authority"],
      "~/*": ["./server/*"],
      "@/*": ["./app/*"]
    },
    "types": ["@nuxt/image", "@pinia/nuxt", "@vueuse/nuxt","node", "googleapis"]
  },

"include": [
    "./app/**/*",
    "./server/**/*"
  ]

}
```

## package.json
```
{
  "name": "funk",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nuxt build --port=3001",
    "dev": "nuxt dev --port=3001",
    "generate": "nuxt generate",
    "preview": "NODE_TLS_REJECT_UNAUTHORIZED=0 nuxt preview",
    "postinstall": "nuxt prepare",
    "start": "nuxi preview"
  },
  "dependencies": {
    "@ai-sdk/vue": "^1.1.19",
    "@breezystack/lamejs": "^1.2.7",
    "@nuxt/image": "^1.9.0",
    "@picovoice/falcon-web": "^1.0.0",
    "@pinia/nuxt": "^0.10.1",
    "@unocss/extractor-pug": "^66.0.0",
    "@unocss/nuxt": "^66.0.0",
    "@unocss/reset": "^66.0.0",
    "@unocss/transformer-compile-class": "^66.0.0",
    "@vueuse/nuxt": "^12.7.0",
    "assemblyai": "^4.9.0",
    "class-variance-authority": "^0.7.1",
    "embla-carousel-autoplay": "^8.5.2",
    "embla-carousel-vue": "^8.5.2",
    "js-yaml": "^4.1.0",
    "lucide-vue-next": "^0.477.0",
    "nuxt": "^3.15.4",
    "nuxt-lucide-icons": "^1.0.5",
    "openai": "^4.86.1",
    "pinia": "^3.0.1",
    "pinia-plugin-persistedstate": "^4.2.0",
    "unocss": "^66.0.0",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@ai-sdk/openai": "^1.2.0",
    "@nuxt/devtools": "^2.1.3",
    "@types/node": "^22.13.9",
    "ai": "^4.1.51",
    "dayjs": "^1.11.13",
    "nanoid": "^5.1.2",
    "pug": "^3.0.3"
  }
}```

## app/components/TranscriptDisplay.vue
```
<template lang="pug">
  .transcript-container(class="p-4 rounded-lg overflow-y-auto max-h-[60vh]" ref="transcriptContainer")
    template(v-for="(segment, segmentIndex) in timestamps" :key="`segment-${segmentIndex}`")
      .segment( :class="{  'active-segment': segmentIndex === activeSegmentIndex, 'bg-neutral-800/50': isSegmentActive(segment) }", class="mb-4 p-2 rounded transition-colors duration-200")
        span(class="inline-block font-bold text-neutral-100 mr-2") {{ segment.speaker }}:
        .words(class="inline")
          template(
            v-for="(word, wordIndex) in segment.words" 
            :key="`word-${segmentIndex}-${wordIndex}`"
          )
            span.word(:class="{'highlighted': isWordActive(word),'transition-colors': true,'text-neutral-300': true }") {{ word.text }}{{ ' ' }}
  </template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import type { TranscriptSegment } from "@/composables/useTranscriptSync";

const props = defineProps<{
  timestamps: TranscriptSegment[];
  activeSegmentIndex: number;
  currentTime: number;
}>();

const transcriptContainer = ref<HTMLElement | null>(null);

const currentSegmentIndex = computed(() => {
  return props.timestamps.findIndex(
    (segment) =>
      props.currentTime >= segment.start && props.currentTime <= segment.end
  );
});

const isSegmentActive = (segment: TranscriptSegment) => {
  return props.currentTime >= segment.start && props.currentTime <= segment.end;
};

const isWordActive = (word: { start: number; end: number }) => {
  const bufferedStart = Math.max(0, word.start - 50);
  const bufferedEnd = word.end + 50;
  return props.currentTime >= bufferedStart && props.currentTime <= bufferedEnd;
};

// Auto-scroll
watch(
  () => props.activeSegmentIndex,
  (newIndex) => {
    if (newIndex === -1 || !transcriptContainer.value) return;

    nextTick(() => {
      const activeSegment = transcriptContainer.value?.querySelector(
        `.segment:nth-child(${newIndex + 1})`
      );
      if (activeSegment) {
        activeSegment.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    });
  },
  { immediate: false }
);
</script>

<style scoped>
.transcript-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.active-segment {
  @apply bg-neutral-900;
}

.word {
  @apply inline-block px-0.5;
}

.highlighted {
  @apply text-orange-500 font-medium;
}

.segment {
  transition: background-color 0.2s ease;
}

.word {
  transition: color 0.15s ease;
}
</style>
```

## app/components/PlayerFooter.vue
```
<template lang="pug">
footer.fixed.bottom-0.left-0.right-0.bg-neutral-900.border-t.border-neutral-800.px-4.py-2
  audioPlayer

</template>

```

## app/components/EpisodeCard.vue
```
<template lang="pug">
  .group.relative.flex.items-center.gap-4.rounded-lg.p-4.transition-colors.cursor-pointer.w-full.overflow-hidden(
    class='bg-neutral-900/40 hover:bg-neutral-800/40'
    @click='handleClick'
  )
    //- Episode Image
    .relative.w-16.h-16.rounded-md.overflow-hidden.bg-neutral-800.flex-shrink-0
      img.w-full.h-full.object-cover(
        :src='`/api/podcast/images/series/${episode.seriesId}`'
        :alt='episode.title'
      )
      //- Play Button Overlay
      .absolute.inset-0.flex.items-center.justify-center.opacity-0.transition-opacity(
        class='bg-black/60 group-hover:opacity-100'
        :class="{ 'opacity-100': isPlaying }"
      )
        button.w-8.h-8.flex.items-center.justify-center.rounded-full.bg-green-500.text-black.transition-transform(
          class='hover:scale-105'
          @click.stop='handlePlayClick'
        )
          component.w-4.h-4(:is='isPlaying ? Pause : Play')
    
    //- Episode Info
    .flex-1.min-w-0.overflow-hidden.mr-4
      h3.text-base.font-medium.text-white.truncate
        | {{ formatEpisodeId(episode.id) + " - " + episode.title }}
      p.text-sm.text-neutral-400.truncate
        | {{ episode.description }}
    
    //- Date
    span.text-sm.font-bold.text-neutral-300.flex-shrink-0.whitespace-nowrap.hidden(class="sm:block")
      | {{ formatDate(episode.date) }}
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import { Play, Pause } from 'lucide-vue-next'
  import { useAudioPlayerStore } from '@/stores/audioPlayer'
  import { useRouter } from 'vue-router'
  
  const props = defineProps<{
    episode: any
    detailed?: boolean
  }>()
  
  const router = useRouter()
  const audioStore = useAudioPlayerStore()
  

  const isPlaying = computed(() => {
    return (
      audioStore.currentEpisode?.id === props.episode.id &&
      audioStore.currentEpisode.isPlaying === true
    )
  })
  
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  const formatEpisodeId = (id: string) => {
    return id.split('_')[0].toUpperCase()
  }
  
  const handlePlayClick = async (event: Event) => {
    event.stopPropagation()
    if (audioStore.currentEpisode?.id === props.episode.id) {
      // episode is current - toggle play state
      audioStore.togglePlay()
    } else {
      // New episode - start playing
      await audioStore.playEpisode({
        id: props.episode.id,
        seriesId: props.episode.seriesId,
        title: props.episode.title,
        audioUrl: props.episode.audioUrl,
        description: props.episode.description
      })
    }
  }
  
  const handleClick = (event: MouseEvent) => {
    router.push(`/series/${props.episode.seriesId}/episodes/${props.episode.id}`)
  }
  </script>```

## app/components/AudioPlayer.vue
```
<template lang="pug">
  .flex.items-center.justify-between.h-24.bg-neutral-900(v-if="audioStore.currentEpisode" class="px-2 md:px-4")
    .items-center.gap-4.hidden(class="lg:flex sm:w-[300px] lg:w-[30%]")
      .flex.items-center.gap-3
        .w-14.h-14.bg-neutral-900.rounded.flex-shrink-0
          img.w-full.h-full.object-cover.rounded(:src="`/api/podcast/images/series/${audioStore.currentEpisode.seriesId}`" alt="Episode cover")
        .min-w-0.flex-1
          h6.text-sm.font-medium.text-neutral-200.truncate(class="max-w-[200px] xl:max-w-[300px]") {{ audioStore.currentEpisode.title }}
          p.text-xs.text-neutral-500.truncate(class="max-w-[200px]") {{ audioStore.currentEpisode.seriesId }}

    .flex.flex-col.items-center.gap-2(class="flex-1 sm:flex-none sm:w-[400px] lg:w-[500px]")
      .flex.items-center.justify-center.gap-4(class="sm:gap-6")
        .flex.items-center.gap-2(class="sm:hidden")
          button(class="text-neutral-400 hover:text-neutral-200 p-2" @click="toggleMute")
            Volume2(class="w-4 h-4" v-if="!mediaMuted && mediaVolume > 0.5")
            Volume1(class="w-4 h-4" v-else-if="!mediaMuted && mediaVolume > 0")
            VolumeX(class="w-4 h-4" v-else)
            
          button.p-2(class="text-neutral-400 hover:text-neutral-200" @click="isSpeedMenuOpen = !isSpeedMenuOpen")
            Gauge(class="w-4 h-4")
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="goToStart")
          SkipBack(class="w-4 h-4")
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="skipBackward")
          Undo(class="w-4 h-4")
        button.flex.items-center.justify-center.w-8.h-8.rounded-full.transition-colors(
          class="hover:bg-neutral-700"
          @click="togglePlay"
          :class="{'bg-neutral-800': !playing, 'bg-neutral-700': playing}"
        )
          Play(class="w-4 h-4 text-neutral-200 ml-0.5" v-if="!playing")
          Pause(class="w-4 h-4 text-neutral-200" v-else)
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="skipForward")
          Redo(class="w-4 h-4")

      .flex.items-center.gap-2.w-full.px-2
        span(class="text-[11px] text-neutral-400 font-mono min-w-[48px] text-right") {{ formatTime(currentTime) }}
        .relative.flex-1.mx-2
          PrtSlider(
            ref="sliderRef"
            :model-value="sliderValue"
            :min="0"
            :max="100"
            :step="0.1"
            @change="handleSliderChange"
            @start="handleDragStart"
            @end="handleDragEnd"
            @click="handleSliderClick"
            bg-color="bg-neutral-700/50"
            range-color="bg-neutral-400"
            handle-color="bg-white"
          )
        span(class="text-[11px] text-neutral-400 font-mono min-w-[48px]") {{ formatTime(duration) }}

    //- left side speed menu
    .items-center.gap-4.hidden(class="sm:flex sm:w-[180px] lg:w-[30%] justify-end")
      .relative.group
        button.flex.items-center.gap-1.px-2.py-1.rounded(
          class="text-neutral-400 hover:text-neutral-200"
          @click="isSpeedMenuOpen = !isSpeedMenuOpen"
        )
          Gauge(class="w-4 h-4")
          span.text-xs {{ audioStore.playbackSpeed }}x


        //- Speed Menu
   
        .absolute.bottom-full.right-0.mb-2.rounded-lg.shadow-lg.overflow-hidden.z-50(
          class="bg-neutral-800"
          v-if="isSpeedMenuOpen"
          @mouseleave="isSpeedMenuOpen = false"
        )
          .py-1
            button.w-full.px-4.py-2.text-sm.text-left(
              v-for="speed in playbackSpeeds"
              :key="speed"
              @click="setSpeed(speed)"
              class="hover:bg-neutral-700 text-neutral-200"
              :class="{ 'bg-neutral-700': audioStore.playbackSpeed === speed }"
            ) {{ speed }}x

      button(class="text-neutral-400 hover:text-neutral-200" @click="toggleMute")
        Volume2(class="w-5 h-5" v-if="!mediaMuted && mediaVolume > 0.5")
        Volume1(class="w-5 h-5" v-else-if="!mediaMuted && mediaVolume > 0")
        VolumeX(class="w-5 h-5" v-else)
      .relative.w-24
        PrtSlider(
          v-model="volumeValue"
          :min="0"
          :max="100"
          :step="1"
          @change="handleVolumeSliderChange"
          bg-color="bg-neutral-700/50"
          range-color="bg-neutral-400"
          handle-color="bg-white"
        )

    //- Speed Menu dropdown for mobile
    .fixed.inset-x-0.bottom-24.mx-auto.w-48.rounded-lg.shadow-lg.overflow-hidden.z-50(
      class="bg-neutral-800 sm:hidden"
      v-if="isSpeedMenuOpen"
      @click.self="isSpeedMenuOpen = false"
    )
   
      .py-1
        button.w-full.px-4.py-2.text-sm.text-left(
          v-for="speed in playbackSpeeds"
          :key="speed"
          @click="setSpeed(speed)"
          class="hover:bg-neutral-700 text-neutral-200"
          :class="{ 'bg-neutral-700': audioStore.playbackSpeed === speed }"
        ) {{ speed }}x

    audio(ref="audioElement")
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import { useMediaControls, useDebounceFn } from '@vueuse/core'
import { SkipBack, Undo, Redo, Play, Pause, Volume1, Volume2, VolumeX, Gauge } from 'lucide-vue-next'


interface SliderComponent extends HTMLElement {
  $el: HTMLElement;
}

const audioStore = useAudioPlayerStore()
const audioElement = ref<HTMLMediaElement | null>(null)
const sliderRef = ref<SliderComponent | null>(null)


const {
  playing,
  currentTime,
  duration,
  volume: mediaVolume,
  muted: mediaMuted,
} = useMediaControls(audioElement, {
  src: computed(() => audioStore.currentEpisode?.audioUrl || ''),
})


const playbackRate = ref(1)

const isInternalChange = ref(false)
const isDragging = ref(false)
const isSpeedMenuOpen = ref(false)
const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5] as const

const sliderValue = ref(0)
const volumeValue = ref(mediaVolume.value * 100)

const updateVolume = useDebounceFn((newVolume: number) => {
  mediaVolume.value = newVolume
}, 50)

const seekTo = (time: number) => {
  if (!audioElement.value) return
  currentTime.value = time
  audioStore.setTime(time)
}

const handleSliderChange = (value: number) => {
  sliderValue.value = value
  if (!isDragging.value) {
    seekTo((value / 100) * duration.value)
  }
}

const handleDragStart = () => {
  isDragging.value = true
  if (audioElement.value && playing.value) {
    playing.value = false
  }
}

const handleDragEnd = async () => {
  if (!isDragging.value) return
  
  seekTo((sliderValue.value / 100) * duration.value)
  isDragging.value = false
  
  if (audioElement.value && audioStore.currentEpisode?.isPlaying) {
    await nextTick()
    playing.value = true
  }
}

const handleSliderClick = (event: MouseEvent) => {
  if (!sliderRef.value || !audioElement.value) return
  if (isDragging.value) return
  
  const sliderRect = sliderRef.value.$el.getBoundingClientRect()
  const clickPosition = event.clientX - sliderRect.left
  const sliderWidth = sliderRect.width
  const seekPercentage = (clickPosition / sliderWidth) * 100
  
  sliderValue.value = seekPercentage
  seekTo((seekPercentage / 100) * duration.value)
}

const togglePlay = async () => {
  if (!audioElement.value) return
  try {
    isInternalChange.value = true
    playing.value = !playing.value
    audioStore.setPlayingState(playing.value)
  } catch (error) {
    console.error('Playback error:', error)
  } finally {
    isInternalChange.value = false
  }
}

const toggleMute = () => {
  mediaMuted.value = !mediaMuted.value
  audioStore.toggleMute()
}

const handleVolumeSliderChange = (value: number) => {
    volumeValue.value = value
    const newVolume = value / 100
    updateVolume(newVolume)
    // TODO: Set volume in store
    // audioStore.setVolume(newVolume)
}

const setSpeed = (speed: number) => {
  if (audioElement.value) {
    audioElement.value.playbackRate = speed
    playbackRate.value = speed
    audioStore.setPlaybackSpeed(speed)
    isSpeedMenuOpen.value = false
  }
}

const SKIP_SECONDS = 15
const skipForward = () => {
  if (!audioElement.value) return
  seekTo(Math.min(currentTime.value + SKIP_SECONDS, duration.value))
}

const skipBackward = () => {
  if (!audioElement.value) return
  seekTo(Math.max(currentTime.value - SKIP_SECONDS, 0))
}

const goToStart = () => {
  if (!audioElement.value) return
  seekTo(0)
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const [mins, secs] = [Math.floor(seconds / 60), Math.floor(seconds % 60)]
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

watch(() => audioStore.currentEpisode?.audioUrl, async (newUrl) => {
  if (newUrl && audioStore.currentEpisode?.isPlaying) {
    await nextTick()
    playing.value = true
  }
}, { immediate: true })


watch(currentTime, (newTime) => {
  if (!isDragging.value) {
    audioStore.updateCurrentTime(newTime)
    
    if (duration.value && !isInternalChange.value) {
      isInternalChange.value = true
      sliderValue.value = (newTime / duration.value) * 100
      isInternalChange.value = false
    }
  }
}, { immediate: false })

watch(() => audioStore.currentEpisode?.isPlaying, async (newVal) => {
  if (!audioElement.value || isInternalChange.value) return
  try {
    playing.value = newVal ?? false
  } catch (error) {
    console.error('Error syncing playback state:', error)
  }
}, { immediate: true })

onMounted(() => {
  if (audioElement.value) {
    volumeValue.value = mediaVolume.value * 100
    playbackRate.value = audioStore.playbackSpeed
    
    // Initialize playback rate 
    if (audioElement.value && audioStore.playbackSpeed) {
      audioElement.value.playbackRate = audioStore.playbackSpeed
    }
  }
})
</script>
```

## app/stores/audioPlayer.ts
```
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface AudioState {
  currentEpisode: {
    id: string
    seriesId: string
    title: string
    audioUrl: string
    duration: number
    currentTime: number
    isPlaying: boolean
    image?: string
    description?: string
  } | null
  volume: number
  muted: boolean
  loading: boolean
  playbackSpeed: number
  currentTime: number
  isAudioPlaying: boolean
}

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  const currentEpisode = ref<AudioState['currentEpisode']>(null)
  const volume = ref(1)
  const muted = ref(false)
  const loading = ref(false)
  const playbackSpeed = ref(1)
  const currentTime = ref(0)
  const isAudioPlaying = ref(false)

  const progress = computed(() => {
    if (!currentEpisode.value?.duration) return 0
    return (currentEpisode.value.currentTime / currentEpisode.value.duration) * 100
  })

  const playEpisode = async (episode: {
    id: string,
    seriesId: string,
    title: string,
    audioUrl: string,
    description?: string
  }) => {
    if (currentEpisode.value?.id === episode.id) {
      togglePlay()
      return
    }

    if (currentEpisode.value) {
      stop()
    }
    loading.value = true
    currentEpisode.value = {
      ...episode,
      duration: 0,
      currentTime: 0,
      isPlaying: true,
      image: `/api/podcast/images/series/${episode.seriesId}`
    }
    isAudioPlaying.value = true
  }

  const togglePlay = () => {
    if (currentEpisode.value) {
      const newState = !currentEpisode.value.isPlaying
      currentEpisode.value.isPlaying = newState
      isAudioPlaying.value = newState
    }
  }

  const setPlayingState = (isPlaying: boolean) => {
    if (currentEpisode.value) {
      currentEpisode.value.isPlaying = isPlaying
      isAudioPlaying.value = isPlaying
    }
  }

  const updateProgress = (time: number, duration: number) => {
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
      currentEpisode.value.duration = duration
      loading.value = false
    }
  }

  const updateCurrentTime = (time: number) => {
    currentTime.value = time
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
    }
  }

  const setTime = (time: number) => {
    currentTime.value = time
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
    }
  }

  const setVolume = (volume: number) => {
    volume.value = Math.max(0, Math.min(1, volume))
  }

  const toggleMute = () => {
    muted.value = !muted.value
  }

  const setPlaybackSpeed = (speed: number) => {
    playbackSpeed.value = speed
  }

  const stop = () => {
    if (currentEpisode.value) {
      currentEpisode.value.isPlaying = false
      currentEpisode.value.currentTime = 0
      currentTime.value = 0
      loading.value = false
      isAudioPlaying.value = false
    }
  }

  return {
    currentEpisode,
    volume,
    muted,
    loading,
    playbackSpeed,
    currentTime,
    isAudioPlaying,
    progress,
    playEpisode,
    togglePlay,
    setPlayingState,
    updateProgress,
    updateCurrentTime,
    setTime,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    stop
  }
}, {
  persist: {
    key: 'audio-player',
    // storage: localStorage,
    // Array of dot-notation paths to pick what should be persisted.
    pick: ['state.volume', 'state.muted', 'state.playbackSpeed']
  }
})```

## app/layouts/default.vue
```
<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-24">
    <!-- Header -->
    <PrtAppHeader
      :pages="['forsche', 'characters', 'series', 'episodes', 'create']"
      @navigate="handleNavigation"
    >
      <template #logo>
        <nuxt-link to="/">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900">
              <PrtIcon size="base" iconComponent="home" />
            </div>
          </div>
        </nuxt-link>

      </template>
    </PrtAppHeader>

    <!-- Main Content -->
    <div :class="['container mx-auto px-4 py-8', maxWidthClass]">
      <main>
        <slot />
      </main>
    </div>

    <!-- Audio Player Footer -->
    <PlayerFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// routes
const isFullWidthRoute = (route: ReturnType<typeof useRoute>) => {

  const isEpisodeDetail = /^\/series\/[\w-]+\/episodes\/[\w-_]+$/.test(route.path)
  
  // TODO
  const isAlbumPage = route.name === 'albums-id'
  
  return isEpisodeDetail || isAlbumPage
}

const maxWidthClass = computed(() => {
  return isFullWidthRoute(route) ? 'max-w-full' : 'max-w-6xl'
})


type NavigationPage = 'forsche' | 'characters' | 'series' | 'episodes' | 'create'

const handleNavigation = (page: NavigationPage) => {
  const routeMap: Record<NavigationPage, string> = {
    forsche: '/series/forsche',
    characters: '/characters',
    series: '/series',
    episodes: '/series/forsche/episodes',
    create: '/create/episode'
  }

  const targetRoute = routeMap[page]
  
  router.push(targetRoute).catch(err => {
    if (err.name !== 'NavigationDuplicated') {
      console.error('Navigation error:', err)
    }
  })
}


</script>

<style scoped>
:deep(.p-5.flex-grow) {
  display: none;
}
/* :deep(.container.max-w-full .container) {
  max-width: 100%!important;
} */
</style>
```

## app/app.vue
```
<template>
  <div class="m-auto h-full w-full">
    <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  </div>
</template>
<script setup lang="ts">
</script>

<style>
html,
body {
  height: 100%;
}

#__nuxt {
  width: 100%;
}
</style>
```

## app/composables/usePodcastCrud.ts
```
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
}```

## app/composables/useDiarization.ts
```
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
```

## app/composables/useMetadata.ts
```
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
```

## app/composables/useTranscription.ts
```
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
```

## app/composables/useEpisodeCreation.ts
```
export function useEpisodeCreation() {
  const createEpisode = async ({
    seriesId,
    episodeId,
    audioFile,
    provider,
    title,
    about,
    date,
    description,
    transcriptionDE,
    transcriptionEN,
    transcriptionTimestampsDE, 
    metadata
  }: {
    seriesId: string;
    episodeId: string;
    audioFile?: File;
    provider: string;
    title: string;
    about: string;
    date: string;
    description: string;
    transcriptionDE?: string;
    transcriptionEN?: string;
    transcriptionTimestampsDE?: any; 
    metadata: {
      categories: string[];
      tags: string[];
      keyTopics: string[];
    };
  }) => {
    const formData = new FormData();
    formData.append('seriesId', seriesId);
    formData.append('episodeId', episodeId);
    formData.append('title', title);
    formData.append('about', about);
    formData.append('date', date);
    formData.append('description', description);
    formData.append('provider', provider);
    
    if (audioFile) {
      formData.append('audioFile', audioFile);
    }
    
    if (transcriptionDE) {
      formData.append('transcriptionDE', transcriptionDE);
    }
    
    if (transcriptionEN) {
      formData.append('transcriptionEN', transcriptionEN);
    }

    // Add timestamps data
    if (transcriptionTimestampsDE) {
      formData.append('timestampsDE', JSON.stringify(transcriptionTimestampsDE));
    }
    
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch('/api/podcast/episodes/create', {
      method: 'POST',
      body: formData
    });

    return await response.json();
  };

  return {
    createEpisode
  };
}
```

## app/composables/useHelpers.ts
```
export function useHelpers() {

    function daysAgo(dateString: string) {
        const today: Date = new Date();
        const createdDate: Date = new Date(dateString);
        const timeDifference: number = today.getTime() - createdDate.getTime();
        const daysAgo: number = Math.floor(timeDifference / (1000 * 3600 * 24));
        return daysAgo;
    }

    function formatDateString(dateString: string) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return {
        daysAgo,
        formatDateString

    };
}
```

## app/composables/useTextGeneration.ts
```
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
```

## app/composables/useTranscriptSync.ts
```
import { ref, watch, computed, type Ref } from 'vue'

export interface TranscriptWord {
  text: string
  start: number
  end: number
}

export interface TranscriptSegment {
  speaker: string
  text: string
  start: number
  end: number
  words: TranscriptWord[]
}

export interface FlattenedWord extends TranscriptWord {
  speaker: string
  globalIndex: number
  segmentIndex: number
  bufferedStart: number
  bufferedEnd: number
}

export function useTranscriptSync(
  timestamps: Ref<TranscriptSegment[]>,
  currentTimeMs: Ref<number>
) {
  const activeSegmentIndex = ref(-1)
  const activeWordIndex = ref(-1)
  const lastProcessedTime = ref(0)


  const flatWordsWithIndices = computed<FlattenedWord[]>(() => {
    let wordIndex = 0
    return timestamps.value.flatMap((segment, segmentIndex) =>
      segment.words.map(word => ({
        ...word,
        speaker: segment.speaker,
        globalIndex: wordIndex++,
        segmentIndex,
        bufferedStart: Math.max(0, word.start - 50),
        bufferedEnd: word.end + 50
      }))
    )
  })


  const findActiveWordIndex = (time: number, words: FlattenedWord[]): number => {
    if (!words.length) return -1

    const firstWord = words[0]
    const lastWord = words[words.length - 1]


    if (!firstWord || !lastWord) return -1


    if (time < firstWord.bufferedStart) return 0
    if (time > lastWord.bufferedEnd) return words.length - 1


    let start = 0
    let end = words.length - 1
    let bestMatchIndex = 0
    let bestMatchDistance = Infinity

    while (start <= end) {
      const mid = Math.floor((start + end) / 2)
      const word = words[mid]


      if (!word) continue

      if (time >= word.bufferedStart && time <= word.bufferedEnd) {
        return mid
      }

      const distance = Math.min(
        Math.abs(time - word.bufferedStart),
        Math.abs(time - word.bufferedEnd)
      )

      if (distance < bestMatchDistance) {
        bestMatchDistance = distance
        bestMatchIndex = mid
      }

      if (time < word.bufferedStart) {
        end = mid - 1
      } else {
        start = mid + 1
      }
    }

    return bestMatchIndex
  }

  let rafId: number | null = null

  watch(currentTimeMs, (time) => {

    if (Math.abs(time - lastProcessedTime.value) < 16) return

    if (rafId) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      const words = flatWordsWithIndices.value
      if (!words.length) return

      const foundWordIndex = findActiveWordIndex(time, words)
      if (foundWordIndex !== activeWordIndex.value) {
        activeWordIndex.value = foundWordIndex

        if (foundWordIndex >= 0 && foundWordIndex < words.length) {
          const word = words[foundWordIndex]
          if (word && word.segmentIndex !== activeSegmentIndex.value) {
            activeSegmentIndex.value = word.segmentIndex
          }
        }
      }

      lastProcessedTime.value = time
      rafId = null
    })
  }, { immediate: true })

  return {
    activeWordIndex,
    activeSegmentIndex
  }
}
```

## app/types/index.ts
```
export * from './componetTypes'```

## app/types/componentTypes.ts
```

//--- TODO
export interface Item {
    idx: number;
    name: string;
    slug: string;
    created_at: string;
}

```

## app/assets/style.css
```
:root {
    font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-weight: 400;

    color-scheme: light dark;
    color: rgba(255, 255, 255, 0.87);
    background-color: #242424;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

a {
    font-weight: 500;
    text-decoration: inherit;
}


body {
    margin: 0;
    /* display: flex;
    place-items: center; */
    width: 100%;

    min-height: 100vh;
    min-width: 320px;
}

#app {
    width: 100%;
}

button:hover {
    cursor: pointer;
}

*,
::before,
::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
    /* border-color: var(--un-default-border-color, #e5e7eb); */
}```

## app/pages/create/episode.vue
```
<template lang="pug">
  .container.mx-auto.p-4
    h1.text-2xl.font-semibold.mb-6.text-white Create Episode
    form(@submit.prevent="handleSubmit")
      PrtFormGroup.mb-4(label="Audio")
        PrtUploader(
          id="audio"
          v-model="audioFiles"
          accept=".mp3,.flac,.wav,.ogg,.m4a"
          :max-size="25 * 1024 * 1024"
          @error="handleUploadError"
          :key="uploaderKey"
        )
        .text-sm.text-neutral-400.mt-2(v-if="audioFiles.length > 0")
          span Selected: {{ audioFiles[0].name }} ({{ formatFileSize(audioFiles[0].size) }})
        .text-sm.text-el-8.mt-2(v-if="audioError") {{ audioError }}
  
      //- Form fields grid
      .grid.grid-cols-1.gap-4.mb-6(class="sm:grid-cols-2 md:grid-cols-4")
        PrtFormGroup(label="Series ID" required)
          PrtFormField(
            id="seriesId"
            type="text"
            v-model="formData.seriesId"
            placeholder="Enter series ID"
          )
        PrtFormGroup(label="Episode ID" required)
          PrtFormField(
            id="id"
            type="text"
            v-model="formData.id"
            placeholder="Enter episode ID"
          )
        PrtFormGroup(label="Date")
          PrtFormField(
            id="date"
            type="text"
            v-model="formData.date"
          )
        PrtFormGroup(label="Provider")
          PrtComboBox(
            id="provider"
            :options="providers"
            v-model="formData.provider"
          )
  
      //- Transcription grid
      .grid.grid-cols-1.gap-4.mb-6(class="md:grid-cols-3")
        PrtFormGroup(label="German Transcription")
          PrtFormField(
            id="transcriptionDE"
            type="textarea"
            v-model="formData.transcription.de"
            placeholder="Enter German transcription"
          )
          PrtBtn(
            color="bg-blue-600"
            class="mt-2"
            size="sm"
            :disabled="isGeneratingDe || !hasAudioFile"
            @click.prevent="generateGermanTranscription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingDe" type="spinner" size="sm" color="gray")
        
        PrtFormGroup(label="German Transcription Timestamps")
          PrtFormField(
            id="transcriptionTimestampsDE"
            type="textarea"
            :model-value="JSON.stringify(formData.transcriptionTimestamps.de, null, 2)"
            placeholder="German Transcription Timestamps"
          )
        
        PrtFormGroup(label="English Transcription")
          PrtFormField(
            id="transcriptionEN"
            type="textarea"
            v-model="formData.transcription.en"
            placeholder="Enter English transcription"
          )
          PrtBtn(
            color="bg-blue-600"
            class="mt-2"
            size="sm"
            :disabled="isGeneratingEn || !formData.transcription.de"
            @click.prevent="generateEnglishTranscription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingEn" type="spinner" size="sm" color="gray")
  
      //- Text content grid
      .grid.grid-cols-1.gap-4.mb-6(class="md:grid-cols-3")
        PrtFormGroup(label="Title" required)
          PrtFormField.mb-2(
            id="title"
            type="textarea"
            v-model="formData.title"
            placeholder="Enter episode title"
          )
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingTitle"
            @click.prevent="generateTitle"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingTitle" type="spinner" size="sm" color="gray")
  
        PrtFormGroup(label="Description")
          PrtFormField.mb-2(
            id="description"
            type="textarea"
            v-model="formData.description"
            placeholder="Enter episode description"
          )
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingDescription"
            @click.prevent="generateDescription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingDescription" type="spinner" size="sm" color="gray")
  
        PrtFormGroup(label="About")
          PrtFormField.mb-2(
            id="about"
            type="textarea"
            v-model="formData.about"
            placeholder="Enter episode about text"
          )
          PrtBtn.mb-2(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingAbout"
            @click.prevent="generateAbout"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingAbout" type="spinner" size="sm" color="gray")
  
      PrtFormGroup.mb-4(label="Metadata")
        .grid.grid-cols-1.gap-4.mb-2(class="sm:grid-cols-3")
          div(v-for="(value, key) in formData.metadata")
            label.block.text-white.mb-2 {{ key[0].toUpperCase() + key.slice(1).toLowerCase() }}
            PrtFormField(
              :id="key"
              type="text"
              v-model="formData.metadata[key]"
            )
        .flex.justify-between
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            @click.prevent="generateMetadata"
            :disabled="(!formData.transcription.en && !formData.transcription.de) || isGeneratingMetadata"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingMetadata" type="spinner" size="sm" color="gray")
  
      PrtBtn(
        color="bg-el-4"
        size="sm"
        type="submit"
        :disabled="isSubmitting"
      ) {{ isSubmitting ? 'Creating...' : 'Create Episode' }}
  </template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePodcastCrud } from '@/composables/usePodcastCrud'
import { useEpisodeCreation } from '@/composables/useEpisodeCreation'
import { useTextGeneration } from '@/composables/useTextGeneration'
import { useDiarization } from '@/composables/useDiarization'
import { useTranscription } from '@/composables/useTranscription'
import { useMetadata } from '@/composables/useMetadata'
import type { TextGenerationType } from '~/types/podcast'

interface TranscriptionWord { text: string; start: number; end: number }
interface TranscriptionSpeakerSegment { speaker: string; text: string; start: number; end: number; words: TranscriptionWord[] }
interface Metadata { categories: string; tags: string; keyTopics: string }
interface FormData {
  provider: string; seriesId: string; id: string; title: string; description: string; about: string; date: string;
  metadata: Metadata; transcriptionTimestamps: { de: TranscriptionSpeakerSegment[] }; transcription: { de: string; en: string }
}

const { getSingleSeries } = usePodcastCrud()
const { createEpisode } = useEpisodeCreation()
const { generateText, isGenerating } = useTextGeneration()
const { processAudio, isDiarizing } = useDiarization()
const { transcribeAudio, translateTranscription, isTranscribing } = useTranscription()
const { generateMetadataFromText } = useMetadata()

const providers = ['notebooklm', 'elevanlabs', 'openai', 'mixed']
const formData = ref<FormData>({
  provider: 'notebooklm', seriesId: 'forsche', id: '', title: '', description: '', about: '',
  date: new Date().toISOString().slice(0, 10),
  metadata: { categories: '', tags: '', keyTopics: '' },
  transcriptionTimestamps: { de: [] },
  transcription: { de: '', en: '' }
})

const audioFiles = ref([])
const audioError = ref('')
const isSubmitting = ref(false)
const isGeneratingDe = ref(false)
const isGeneratingEn = ref(false)
const isGeneratingTitle = ref(false)
const isGeneratingDescription = ref(false)
const isGeneratingAbout = ref(false)
const isGeneratingMetadata = ref(false)
const hasAudioFile = computed(() => audioFiles.value.length > 0 && audioFiles.value[0])
const uploaderKey = ref(0);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024, sizes = ["Bytes", "KB", "MB", "GB"], i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}


const getEpisodeNumber = (episodeId: string): number => parseInt(episodeId.match(/ep(\d+)/)?.[1] ?? '0')

await useAsyncData('initEpisodeId', async () => {
  try {
    const series = await getSingleSeries('forsche')
    if (series?.episodes?.length) {
      const nextNumber = Math.max(...series.episodes.map(ep => getEpisodeNumber(ep.id))) + 1
      formData.value.id = `ep${nextNumber}`
    }
  } catch (error) {
    console.error('Failed to fetch series episodes:', error)
  }
})

const generateTextContent = async (type: TextGenerationType) => {
  const stateMap = { title: isGeneratingTitle, description: isGeneratingDescription, about: isGeneratingAbout }
  try {
    stateMap[type].value = true
    const result = await generateText({ text: formData.value.transcription.de, type, language: 'de' })
    if (result) formData.value[type] = result
  } catch (error) {
    console.error(`Failed to generate ${type}:`, error)
  } finally {
    stateMap[type].value = false
  }
}

const generateTitle = () => generateTextContent('title')
const generateDescription = () => generateTextContent('description')
const generateAbout = () => generateTextContent('about')

const generateGermanTranscription = async () => {
  try {
    isGeneratingDe.value = true
    if (!audioFiles.value[0]) throw new Error('Please upload an audio file first')

    const diarization = await processAudio(audioFiles.value[0].file)
    formData.value.transcription.de = diarization.map(segment => `[${segment.speaker}]: ${segment.text}`).join('\n')
    formData.value.transcriptionTimestamps.de = diarization.map(segment => ({
      speaker: segment.speaker,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      words: segment.words.map(word => ({ text: word.text, start: word.start, end: word.end }))
    }))
  } catch (error: any) {
    console.error('Failed to generate transcription:', error)
    audioError.value = error.message || 'Failed to process audio'
  } finally {
    isGeneratingDe.value = false
  }
}

const generateEnglishTranscription = async () => {
  try {
    isGeneratingEn.value = true
    if (!formData.value.transcription.de) throw new Error('Please generate German transcription first')
    formData.value.transcription.en = await translateTranscription(formData.value.transcription.de, 'en')
  } catch (error: any) {
    console.error('Failed to generate English transcription:', error)
  } finally {
    isGeneratingEn.value = false
  }
}

const generateMetadata = async () => {
  try {
    isGeneratingMetadata.value = true
    const text = formData.value.transcription.en || formData.value.transcription.de
    if (!text) return
    const metadata = await generateMetadataFromText(text)
    formData.value.metadata = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value])
    ) as Metadata
  } catch (error) {
    console.error('Failed to generate metadata:', error)
  } finally {
    isGeneratingMetadata.value = false
  }
}

const handleUploadError = (error: string) => { audioError.value = error }


const resetForm = () => {
  formData.value = {
    ...formData.value,
    title: '',
    description: '',
    about: '',
    metadata: {
      categories: '',
      tags: '',
      keyTopics: ''
    },
    transcriptionTimestamps: { de: [] },
    transcription: { de: '', en: '' }
  }
  audioFiles.value = [];
  audioError.value = '';
  uploaderKey.value += 1;
}

const handleSubmit = async () => {
  try {
    isSubmitting.value = true
    audioError.value = ''
    
    const storageId = `${formData.value.id}_${formData.value.date}`
    const audioFile = audioFiles.value[0]?.file
    
    const processedMetadata = {
      categories: formData.value.metadata.categories.split(',').filter(Boolean),
      tags: formData.value.metadata.tags.split(',').filter(Boolean),
      keyTopics: formData.value.metadata.keyTopics.split(',').filter(Boolean)
    }

    await createEpisode({
      seriesId: formData.value.seriesId,
      episodeId: storageId,
      title: formData.value.title,
      about: formData.value.about,
      date: formData.value.date,
      description: formData.value.description,
      provider: formData.value.provider,
      audioFile,
      transcriptionDE: formData.value.transcription.de,
      transcriptionEN: formData.value.transcription.en, 
      transcriptionTimestampsDE: formData.value.transcriptionTimestamps.de,
      metadata: processedMetadata
    })

    resetForm()
    
  } catch (error) {
    console.error('Failed to create episode:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>```

## app/pages/index.vue
```
<template lang="pug">
  .app-wrap.min-h-screen
    .container.mx-auto(v-if="series")
      //- Header section
      .pb-6.flex.flex-col.gap-6(class="xs:flex-row")
        //- Image
        .flex-shrink-0(class="w-full xs:w-48")
          .aspect-square.overflow-hidden.bg-neutral-800.rounded-lg
            img.w-full.h-full.object-cover(:src="`/api/podcast/images/series/${series.id}`")
        
        //- Content
        .flex-1.min-w-0
          h1.text-xl.font-bold.text-white.mb-2(class="sm:text-2xl") {{ series.name.toUpperCase() }}
          p.text-neutral-400.mb-4.line-clamp-3(class="sm:line-clamp-none") {{ series.about?.description }}
          .flex.flex-wrap.gap-2(v-if="series.about?.categories")
            prt-chip(
              color="bg-neutral-700" 
              v-for="category in series.about.categories" 
              :key="category"
              class="text-sm"
            ) {{ category }}
      
      //- Episodes section
      .shadow-lg.overflow-hidden.rounded-lg(class="bg-neutral-900/40")
        .px-4.py-4(class="sm:px-6 bg-neutral-800/40")
          h2.text-lg.font-bold.text-white(class="sm:text-xl") Episodes
        
        .divide-y(class="divide-neutral-800/40")
          EpisodeCard(
            v-for="episode in episodes" 
            :key="episode.id" 
            :episode="episode"
            class="transition-colors hover:bg-neutral-800/20"
          )
        
        .p-4.text-center
          NuxtLink(
            :to="`/series/${series.id}/episodes`" 
            class="text-neutral-400 hover:text-white hover:underline inline-flex items-center gap-2"
          ) 
            span See All Episodes
            ArrowRight(class="w-4 h-4")
  </template>
  
  <script setup lang="ts">
  import { ArrowRight } from 'lucide-vue-next'
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  import { useAudioPlayerStore } from '@/stores/audioPlayer'
  import type { Series, Episode } from '@/types/podcast'
  
  const route = useRoute()
  const { getSingleSeries, getEpisode } = usePodcastCrud()
  const audioStore = useAudioPlayerStore()
  
  const seriesId = 'forsche'
  
  const { data: series } = await useAsyncData<Series>('series', () => getSingleSeries(seriesId))
  
  const loadAndProcessEpisode = async (episodeInfo: Partial<Episode>): Promise<Episode | null> => {
    try {
      return await getEpisode(episodeInfo.seriesId || seriesId, episodeInfo.id!)
    } catch (error) {
      console.error('Failed to fetch episode:', error)
      return null
    }
  }
  
  const { data: episodes } = await useAsyncData('episodes', async () => {
    if (!series.value?.episodes?.length) return []
    const episodePromises = series.value.episodes
      .slice(0, 5)
      .map(ep => loadAndProcessEpisode({ ...ep, seriesId }))
    return (await Promise.all(episodePromises)).filter((ep): ep is Episode => ep !== null)
  })
  </script>```

## app/pages/series/index.vue
```
<template lang="pug">
  .app-wrap.flex.justify-center.items-top.min-h-screen
    .container.p-8.w-full(class="max-w-xs sm:max-w-full")
      .grid.grid-cols-1.gap-6(class="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4")
        PrtCard.h-full(
          variant="elevated"
          v-for="series in seriesList"
          :key="series?.id"
          @click="series?.id && navigateToSeries(series.id)"
          class="cursor-pointer"
        )
          template(#image)
            img.w-full.object-cover(
              v-if="series?.imgPath"
              :src="series.imgPath"
              :alt="series?.name || 'Series Image'"
              @load="(event) => handleImageLoad(event.target)"
            )
          template(#header)
            h3.text-center.uppercase.text-xl.font-semibold.text-white(v-if="series?.name") {{ series.name }}
  </template>
  
  <script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  
  const router = useRouter()
  
  interface Series {
    id: string
    name: string
    imgPath?: string
  }
  
  const { data: seriesList } = await useAsyncData<Series[]>('seriesList', () => 
    usePodcastCrud().getSeriesList().then(result => result?.series || [])
  )
  
  const handleImageLoad = (target: EventTarget | null) => {
    (target as HTMLElement)?.parentElement?.classList.remove('opacity-0')
  }
  
  const navigateToSeries = (id: string) => router.push(`/series/${id}`)
  </script>
  
  <style scoped>
  :deep(.p-5.flex-grow) {
    display: none;
  }
  </style>
  ```

## app/pages/series/[id]/index.vue
```
<template lang="pug">
  .app-wrap.min-h-screen
    .container.mx-auto(v-if="series") 
      //- Header
      .pb-6.flex.flex-col.gap-6(class="xs:flex-row")
        //- Image
        .flex-shrink-0(class="w-full xs:w-48")
          .aspect-square.overflow-hidden.bg-neutral-800.rounded-lg
            img.w-full.h-full.object-cover(:src="`/api/podcast/images/series/${series.id}`")
        
        //- Content
        .flex-1.min-w-0
          h1.text-xl.font-bold.text-white.mb-2(class="sm:text-2xl") {{ series.name.toUpperCase() }}
          p.text-neutral-400.mb-4.line-clamp-3(class="sm:line-clamp-none") {{ series.about?.description }}
          .flex.flex-wrap.gap-2(v-if="series.about?.categories")
            prt-chip(
              color="bg-neutral-700" 
              v-for="category in series.about.categories" 
              :key="category"
              class="text-sm"
            ) {{ category }}
      
      //- Episodes
      .shadow-lg.overflow-hidden.rounded-lg(class="bg-neutral-900/40")
        .px-4.py-4(class="sm:px-6 bg-neutral-800/40")
          h2.text-lg.font-bold.text-white(class="sm:text-xl") Episodes
        
        .divide-y(class="divide-neutral-800/40")
          EpisodeCard(
            v-for="episode in episodes" 
            :key="episode.id" 
            :episode="episode"
            class="transition-colors hover:bg-neutral-800/20"
          )
        
        .p-4.text-center
          NuxtLink(
            :to="`/series/${series.id}/episodes`" 
            class="text-neutral-400 hover:text-white hover:underline inline-flex items-center gap-2"
          ) 
            span See All Episodes
            ArrowRight(class="w-4 h-4")
  </template>
  
  <script setup lang="ts">
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  import { useAudioPlayerStore } from '@/stores/audioPlayer'
  
  const route = useRoute()
  const { getSingleSeries, getEpisode } = usePodcastCrud()
  const audioStore = useAudioPlayerStore()
  
  interface Series {
    id: string
    name: string
    about?: {
      description?: string
      categories?: string[]
    }
    episodes?: any[]
  }
  
  interface Episode {
    id: string
    seriesId: string
    // Add other episode properties
  }
  
  const seriesId = route.params.id as string
  
  const { data: series } = await useAsyncData<Series>('series', () => getSingleSeries(seriesId))
  
  const loadAndProcessEpisode = async (episodeInfo: Partial<Episode>): Promise<Episode | null> => {
    try {
      const fullEpisode = await getEpisode(episodeInfo.seriesId || seriesId, episodeInfo.id!)
      return { ...fullEpisode, seriesId }
    } catch (error) {
      console.error('Failed to fetch episode:', error)
      return null
    }
  }
  
  const { data: episodes } = await useAsyncData('episodes', async () => {
    if (!series.value?.episodes?.length) return []
    const episodePromises = series.value.episodes
      .slice(0, 5)
      .map(ep => loadAndProcessEpisode(ep))
    return (await Promise.all(episodePromises)).filter((ep): ep is Episode => ep !== null)
  })
  </script>
  ```

## app/pages/series/[id]/episodes/index.vue
```
<template lang="pug">
  .app-wrap.min-h-screen.bg-neutral-950
    .container.mx-auto.px-4(class="max-w-[350px] xs:max-w-[480px] sm:max-w-5xl")
      //- Back and Title
      .mb-6
        NuxtLink(
          :to="`/series/${seriesId}`" 
          class="text-neutral-400 hover:text-white mb-4 inline-flex items-center gap-2"
        )
          ArrowLeft.w-4.h-4
          span Back to Series
      
      //- Title and Info
      .flex.flex-col.mb-6.gap-4(class="sm:flex-row sm:items-center sm:justify-between")
        h1.text-2xl.font-bold.text-white Episodes
        .text-sm.text-neutral-400
          | Showing {{ paginationInfo.from }}-{{ paginationInfo.to }} of {{ paginationInfo.total }} episodes
      
      //- Pagination
      .flex.justify-center.mb-6(class="sm:justify-end")
        PrtPagination(
          v-model:page="currentPage"
          :total-pages="totalPages"
          variant="default"
          :show-first-last="true"
          :show-arrows="true"
        )
      
      //- Episodes
      .grid.gap-4
        EpisodeCard(
          v-for="episode in paginatedEpisodes" 
          :key="episode.id" 
          :episode="episode"
        )
  </template>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ArrowLeft } from 'lucide-vue-next'
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  
  const ITEMS_PER_PAGE = 10
  const route = useRoute()
  const seriesId = route.params.id as string
  const { getSingleSeries, getEpisode } = usePodcastCrud()
  
  interface Episode {
    id: string
    seriesId: string

  }
  
  const currentPage = ref(1)
  
  const loadAndProcessEpisode = async (episodeInfo: Partial<Episode>): Promise<Episode | null> => {
    try {
      const fullEpisode = await getEpisode(seriesId, episodeInfo.id!)
      return { ...fullEpisode, seriesId }
    } catch (error) {
      console.error('Failed to fetch episode:', error)
      return null
    }
  }
  
  const { data: episodes } = await useAsyncData('episodes', async () => {
    const series = await getSingleSeries(seriesId)
    if (!series?.episodes?.length) return []
    const episodePromises = series.episodes.map(ep => loadAndProcessEpisode(ep))
    return (await Promise.all(episodePromises)).filter((ep): ep is Episode => ep !== null)
  })
  
  const totalPages = computed(() => Math.ceil((episodes.value?.length ?? 0) / ITEMS_PER_PAGE))
  
  const paginatedEpisodes = computed(() => {
    const start = (currentPage.value - 1) * ITEMS_PER_PAGE
    return episodes.value?.slice(start, start + ITEMS_PER_PAGE) ?? []
  })
  
  const paginationInfo = computed(() => {
    const total = episodes.value?.length ?? 0
    const from = (currentPage.value - 1) * ITEMS_PER_PAGE + 1
    const to = Math.min(from + ITEMS_PER_PAGE - 1, total)
    return { from, to, total }
  })
  </script>```

## app/pages/series/[id]/episodes/[episodeId].vue
```
<template lang="pug">
  div(class="min-h-screen pb-24 bg-neutral-950")
    .container.mx-auto.px-4(class="max-w-[350px] xs:max-w-[480px] md:max-w-5xl")
      //- Back
      .mb-6
        NuxtLink(
          :to="`/series/${route.params.id}/episodes`" 
          class="text-neutral-400 hover:text-white flex items-center gap-2"
        )
          ArrowLeft(class="w-4 h-4")
          span Back to Episodes
      
      //- Episode Header
      .mb-6(v-if="episode")
        div(class="bg-neutral-900 p-4")
          .flex.flex-col.gap-4(class="sm:flex-row sm:items-start")
            //- Image and Play Button
            .relative.rounded-lg.overflow-hidden.flex-shrink-0.group(
              class="w-24 h-24 sm:w-16 sm:h-16 bg-neutral-800"
            )
              img(
                :src="`/api/podcast/images/series/${episode.seriesId}`" 
                :alt="episode.title"
                class="w-full h-full object-cover"
              )
              .absolute.inset-0.flex.items-center.justify-center.transition-opacity(
                class="bg-black/60 opacity-0 group-hover:opacity-100"
                :class="{ 'opacity-100': isPlaying }"
              )
                button(
                  class="flex items-center justify-center rounded-full bg-green-500 text-black hover:scale-105 transition-transform w-10 h-10 sm:w-8 sm:h-8"
                  @click="handlePlayClick"
                )
                  component(:is="isPlaying ? Pause : Play" class="w-5 h-5 sm:w-4 sm:h-4")
            
            //- Episode Info
            .flex-1.min-w-0
              .episode-title
                h1.text-xl.font-bold.text-white.mb-1 {{ formatEpisodeId(episode.id) }} - {{ episode.title }}
                .text-sm(class="text-neutral-200") {{ formatDate(episode.date) }}
              
              .episode-description.mt-4
                p.text-sm(class="text-neutral-300") {{ episode.description }}
                p.text-sm.mt-2(class="text-neutral-400") {{ episode.about }}
              
              //- Metadata
              .metadata.mt-6.space-y-3
                .flex.flex-col.gap-2(
                  v-if="episode.metadata?.categories?.length" 
                  class="sm:flex-row sm:items-center"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Categories:
                  .flex.flex-wrap.gap-2
                    PrtChip(
                      v-for="category in episode.metadata.categories" 
                      :key="category" 
                      class="text-xs bg-neutral-800"
                    ) {{ category }}
                
                .flex.flex-col.gap-1(
                  v-if="episode.metadata?.tags?.length" 
                  class="sm:flex-row"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Tags:
                  p.text-xs.leading-relaxed(class="text-neutral-300") {{ formatTags(episode.metadata.tags) }}
                
                .flex.flex-col.gap-1(
                  v-if="episode.metadata?.keyTopics?.length" 
                  class="sm:flex-row"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Topics:
                  p.text-xs.leading-relaxed(class="text-neutral-300") {{ formatTags(episode.metadata.keyTopics) }}
  
      //- Transcript highlighting
      .w-full.mb-6(v-if="episode?.languageContent?.de?.timestamps")
        transcriptDisplay(
          :timestamps="episode.languageContent.de.timestamps"
          :active-segment-index="activeSegmentIndex"
          :current-time="audioCurrentTime"
        )
  
      .mb-8(v-if="processedDialogues.de.length || processedDialogues.en.length")
        .grid.grid-cols-2
          .p-3.font-bold.text-lg.text-white(class="bg-neutral-800 rounded-t-lg") German
          .p-3.font-bold.text-lg.text-white(class="bg-neutral-800 rounded-t-lg ml-1") English
        
        //- Common container
        .overflow-y-auto(class="h-96 bg-neutral-900/40 rounded-b-lg" ref="transcriptContainer")
          //- each dialogue line is a grid row
          .dialogue-grid
            template(v-for="(_, index) in Math.max(processedDialogues.de.length, processedDialogues.en.length)" :key="index")
              .dialogue-row
                //- German side
                .dialogue-cell.border-r(class="border-neutral-800/50")
                  template(v-if="processedDialogues.de[index]")
                    span.speaker(v-if="processedDialogues.de[index].speaker") {{ processedDialogues.de[index].speaker }}:
                    span.text {{ processedDialogues.de[index].text }}
                
                //- English side  
                .dialogue-cell
                  template(v-if="processedDialogues.en[index]")
                    span.speaker(v-if="processedDialogues.en[index].speaker") {{ processedDialogues.en[index].speaker }}:
                    span.text {{ processedDialogues.en[index].text }}
  </template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { ArrowLeft, Play, Pause } from "lucide-vue-next";
import { usePodcastCrud } from "@/composables/usePodcastCrud";
import { useAudioPlayerStore } from "@/stores/audioPlayer";
import {
  useTranscriptSync,
  type TranscriptSegment,
} from "@/composables/useTranscriptSync";
import TranscriptDisplay from "@/components/TranscriptDisplay.vue";
import { useRoute, useAsyncData } from "nuxt/app";

const route = useRoute();
const { getEpisode } = usePodcastCrud();
const audioStore = useAudioPlayerStore();

interface Episode {
  id: string;
  seriesId: string;
  title: string;
  date: string;
  description: string;
  about: string;
  audioUrl: string;
  metadata?: {
    categories?: string[];
    tags?: string[];
    keyTopics?: string[];
  };
  languageContent?: {
    de?: {
      dialogue?: string;
      audioUrl?: string;
      timestamps?: TranscriptSegment[];
    };
    en?: {
      dialogue?: string;
    };
  };
}

interface DialogueLine {
  speaker: string;
  text: string;
}

interface PlayEpisodeParams {
  id: string;
  seriesId: string;
  title: string;
  audioUrl: string;
  description?: string;
  image?: string;
}

const { data: episode } = await useAsyncData<Episode>("episode", () =>
  getEpisode(route.params.id as string, route.params.episodeId as string)
);

const audioCurrentTime = computed(() => audioStore.currentTime * 1000);

const { activeSegmentIndex } = useTranscriptSync(
  computed(() => episode.value?.languageContent?.de?.timestamps || []),
  audioCurrentTime
);

const isPlaying = computed(
  () =>
    audioStore.currentEpisode?.id === episode.value?.id &&
    audioStore.currentEpisode?.isPlaying
);

const processedDialogues = computed(() => {
  const result = {
    de: [] as DialogueLine[],
    en: [] as DialogueLine[],
  };

  if (episode.value?.languageContent?.de?.dialogue) {
    result.de = parseDialogueLines(episode.value.languageContent.de.dialogue);
  }

  if (episode.value?.languageContent?.en?.dialogue) {
    result.en = parseDialogueLines(episode.value.languageContent.en.dialogue);
  }

  if (result.de.length && result.en.length) {
    const alignedDialogues = alignDialoguesBySpeaker(result.de, result.en);
    return alignedDialogues;
  }

  return result;
});

const parseDialogueLines = (text: string): DialogueLine[] => {
  if (!text) return [];

  const cleanText = text.replace(/\r\n/g, "\n").trim();
  const blocks = cleanText.split(/\n\n+/);

  return blocks.map((block) => {
    const match = block.match(/^([A-Za-z]+):(.+)$/s);
    if (match && match[1] && match[2]) {
      return {
        speaker: match[1],
        text: match[2].trim(),
      };
    }
    return {
      speaker: "",
      text: block.trim(),
    };
  });
};

const alignDialoguesBySpeaker = (
  deLine: DialogueLine[],
  enLine: DialogueLine[]
) => {
  const result = {
    de: [...deLine],
    en: [...enLine],
  };

  if (deLine.length === enLine.length) {
    return result;
  }

  return result;
};

const formatTags = (tags?: string[]): string =>
  tags?.map((tag) => `#${tag.trim().replace(/\s+/g, "-")}`).join(", ") ?? "";

const formatDate = (dateString?: string): string =>
  dateString
    ? new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const formatEpisodeId = (id?: string): string => {
  if (!id) return "";

  const match = id.match(/^(ep\d+)/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }

  return id.toUpperCase();
};

const handlePlayClick = async () => {
  if (!episode.value) return;

  const audioUrl =
    episode.value.languageContent?.de?.audioUrl || episode.value.audioUrl;

  await audioStore.playEpisode({
    id: episode.value.id,
    seriesId: episode.value.seriesId,
    title: formatEpisodeId(episode.value.id),
    audioUrl,
    description: episode.value.description,
    image: `/api/podcast/images/series/${episode.value.seriesId}`,
  } as PlayEpisodeParams);
};
</script>

<style scoped>
:deep(.overflow-y-auto::-webkit-scrollbar) {
  width: 6px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.2);
}

.dialogue-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}

.dialogue-row {
  display: contents;
}

.dialogue-cell {
  padding: 1rem;
  color: #e5e7eb; /* text-neutral-300 */
}

.speaker {
  font-weight: bold;
  color: white;
  margin-right: 0.25rem;
}

.text {
  white-space: pre-line;
}
</style>
```

## app/pages/characters.vue
```
<template lang="pug">
  .app-wrap.flex.justify-center.items-top.min-h-screen
    .container.p-8.w-full(class="max-w-xs sm:max-w-full")
      .grid.grid-cols-1.gap-6(class="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3")
        PrtCard.h-full(
          variant="elevated"
          v-for="character in characters"
          :key="character.characterId"
        )
          template(#image)
            img.w-full.object-cover(
              :src="character.imgPath"
              :alt="character.name"
              @load="(event) => handleImageLoad(event.target)"
            )
          
          template(#header)
            h3.text-xl.font-semibold.text-white {{ character.name }}
          
          template(#content)
            p.text-gray-300.mb-4 {{ character.about }}
            .flex.flex-wrap.gap-2.justify-start
              span.inline-block.bg-gray-700.px-3.py-1.text-sm.font-semibold.text-gray-300(
                v-for="tag in character.tags"
                :key="tag"
              ) {{ tag }}
          
          template(#footer)
            .flex.justify-between.items-center
              span.text-sm.text-gray-400 Character
              PrtBtn(color="bg-neutral-900" size="sm") View Details
  </template>
  
  <script setup lang="ts">
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  import type { Character } from '@/types/podcast'
  
  const { data: characters } = await useAsyncData<Character[]>('characters', () => 
    usePodcastCrud().getCharacters()
  )
  
  const handleImageLoad = (target: EventTarget | null) => {
    (target as HTMLElement)?.parentElement?.classList.remove('opacity-0')
  }
  </script>
  ```

## app/app.config.ts
```
export default defineAppConfig({
    theme: {
      primaryColor: '#ababab',
      sampleSetting:"sample"
    }
  })
  ```

## nuxt.config.ts
```
// https://nuxt.com/docs/api/configuration/nuxt-config

import { resolve } from 'path'
export default defineNuxtConfig({
  compatibilityDate: '2024-12-09',
  devtools: { enabled: true },
  devServer: {
    port: 3001,
  },
  app: {
    head: {
      charset: 'utf-8',
      title: 'Funk',
      viewport: 'width=device-width, initial-scale=1',
    },
  },
  alias: {
    '~': './server',
    '@': './app'
  },
  future: {compatibilityVersion: 4},
  extends: [
    'github:monoprotium/protobiont-ui-layer'
  ],
  modules: [
    '@unocss/nuxt',
    "@vueuse/nuxt",
    '@pinia/nuxt',
    '@nuxt/image',
    'nuxt-lucide-icons', 
    'pinia-plugin-persistedstate/nuxt',
  ],

  css: [
    // '@unocss/reset/tailwind-compat.css',
    '@/assets/style.css',
  ],

  build: {

    transpile: [
        'class-variance-authority',
        /\.vue$/,
    ]
},

  ssr: false,
  unocss: {
    preflight: true,
  },
  runtimeConfig: {
      appDataPath: process.env.APP_DATA_PATH,
      assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
  },

  vite: {
    resolve: {
      extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
      alias: {
        '@': resolve(__dirname, './app'),
        '~': resolve(__dirname, './server')
      }
    }
  }
})
```

## z_sources/nuxt_sources.md
```
```

