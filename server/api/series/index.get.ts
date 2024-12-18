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
