<template lang="pug">
  .group.relative.flex.items-center.gap-4.rounded-lg.p-4.transition-colors.cursor-pointer.w-full.overflow-hidden(
    class='bg-neutral-900/40 hover:bg-neutral-800/40'
    @click='handleClick'
  )
    //- Episode Image
    .relative.w-16.h-16.rounded-md.overflow-hidden.bg-neutral-800.flex-shrink-0
      img.w-full.h-full.object-cover(
        :src='`/api/podcast/images/series/${episode.seriesId}`'
        :alt='episode.title'
      )
      //- Play Button Overlay
      .absolute.inset-0.flex.items-center.justify-center.opacity-0.transition-opacity(
        class='bg-black/60 group-hover:opacity-100'
        :class="{ 'opacity-100': isPlaying }"
      )
        button.w-8.h-8.flex.items-center.justify-center.rounded-full.bg-green-500.text-black.transition-transform(
          class='hover:scale-105'
          @click.stop='handlePlayClick'
        )
          component.w-4.h-4(:is='isPlaying ? Pause : Play')
    
    //- Episode Info
    .flex-1.min-w-0.overflow-hidden.mr-4
      h3.text-base.font-medium.text-white.truncate
        | {{ formatEpisodeId(episode.id) + " - " + episode.title }}
      p.text-sm.text-neutral-400.truncate
        | {{ episode.description }}
    
    //- Date
    span.text-sm.font-bold.text-neutral-300.flex-shrink-0.whitespace-nowrap.hidden(class="sm:block")
      | {{ formatDate(episode.date) }}
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import { Play, Pause } from 'lucide-vue-next'
  import { useAudioPlayerStore } from '@/stores/audioPlayer'
  import { useRouter } from 'vue-router'
  
  const props = defineProps<{
    episode: any
    detailed?: boolean
  }>()
  
  const router = useRouter()
  const audioStore = useAudioPlayerStore()
  

  const isPlaying = computed(() => {
    return (
      audioStore.currentEpisode?.id === props.episode.id &&
      audioStore.currentEpisode.isPlaying === true
    )
  })
  
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  const formatEpisodeId = (id: string) => {
    return id.split('_')[0].toUpperCase()
  }
  
  const handlePlayClick = async (event: Event) => {
    event.stopPropagation()
    if (audioStore.currentEpisode?.id === props.episode.id) {
      // episode is current - toggle play state
      audioStore.togglePlay()
    } else {
      // New episode - start playing
      await audioStore.playEpisode({
        id: props.episode.id,
        seriesId: props.episode.seriesId,
        title: props.episode.title,
        audioUrl: props.episode.audioUrl,
        description: props.episode.description
      })
    }
  }
  
  const handleClick = (event: MouseEvent) => {
    router.push(`/series/${props.episode.seriesId}/episodes/${props.episode.id}`)
  }
  </script>