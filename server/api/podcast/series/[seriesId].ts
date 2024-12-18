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
