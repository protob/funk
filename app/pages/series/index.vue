<template lang="pug">
  .app-wrap.flex.justify-center.items-top.min-h-screen
    .container.p-8.w-full(class="max-w-xs sm:max-w-full")
      .grid.grid-cols-1.gap-6(class="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4")
        PrtCard.h-full(
          variant="elevated"
          v-for="series in seriesList"
          :key="series?.id"
          @click="series?.id && navigateToSeries(series.id)"
          class="cursor-pointer"
        )
          template(#image)
            img.w-full.object-cover(
              v-if="series?.imgPath"
              :src="series.imgPath"
              :alt="series?.name || 'Series Image'"
              @load="(event) => handleImageLoad(event.target)"
            )
          template(#header)
            h3.text-center.uppercase.text-xl.font-semibold.text-white(v-if="series?.name") {{ series.name }}
  </template>
  
  <script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  
  const router = useRouter()
  
  interface Series {
    id: string
    name: string
    imgPath?: string
  }
  
  const { data: seriesList } = await useAsyncData<Series[]>('seriesList', () => 
    usePodcastCrud().getSeriesList().then(result => result?.series || [])
  )
  
  const handleImageLoad = (target: EventTarget | null) => {
    (target as HTMLElement)?.parentElement?.classList.remove('opacity-0')
  }
  
  const navigateToSeries = (id: string) => router.push(`/series/${id}`)
  </script>
  
  <style scoped>
  :deep(.p-5.flex-grow) {
    display: none;
  }
  </style>
  