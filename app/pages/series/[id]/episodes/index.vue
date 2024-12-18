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
  </script>