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
            Icon.w-4.h-4(name="lucide:arrow-right")
  </template>
  
  <script setup lang="ts">
 
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
  </script>