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
