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
})