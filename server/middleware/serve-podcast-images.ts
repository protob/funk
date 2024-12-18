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
})