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
})