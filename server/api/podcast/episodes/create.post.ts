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
})