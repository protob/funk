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
