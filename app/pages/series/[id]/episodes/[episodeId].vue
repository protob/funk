<template lang="pug">
  div(class="min-h-screen pb-24 bg-neutral-950")
    .container.mx-auto.px-4(class="max-w-[350px] xs:max-w-[480px] md:max-w-5xl")
      //- Back
      .mb-6
        NuxtLink(
          :to="`/series/${route.params.id}/episodes`" 
          class="text-neutral-400 hover:text-white flex items-center gap-2"
        )
          ArrowLeft(class="w-4 h-4")
          span Back to Episodes
      
      //- Episode Header
      .mb-6(v-if="episode")
        .bg-neutral-900.p-4
          .flex.flex-col.gap-4(class="sm:flex-row sm:items-start")
            //- Image and Play Button
            .relative.w-24.h-24.rounded-lg.overflow-hidden.bg-neutral-800.flex-shrink-0.group(
              class="sm:w-16 sm:h-16"
            )
              img(
                :src="`/api/podcast/images/series/${episode.seriesId}`" 
                :alt="episode.title"
                class="w-full h-full object-cover"
              )
              .absolute.inset-0.flex.items-center.justify-center(
                class="bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                :class="{ 'opacity-100': isPlaying }"
              )
                button(
                  class="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 text-black hover:scale-105 transition-transform sm:w-8 sm:h-8"
                  @click="handlePlayClick"
                )
                  component(:is="isPlaying ? Pause : Play" class="w-5 h-5 sm:w-4 sm:h-4")
            
            //- Episode Info
            .flex-1.min-w-0
              .episode-title
                h1.text-xl.font-bold.text-white.mb-1 {{ formatEpisodeId(episode.id) }} - {{ episode.title }}
                .text-neutral-200.text-sm {{ formatDate(episode.date) }}
              
              .episode-description.mt-4
                p.text-neutral-300.text-sm {{ episode.description }}
                p.text-neutral-400.text-sm.mt-2 {{ episode.about }}
              
              //- Metadata
              .metadata.mt-6.space-y-3
                .flex.flex-col.gap-2(v-if="episode.metadata?.categories?.length" class="sm:flex-row sm:items-center")
                  span.text-sm.font-bold.text-neutral-400.min-w-20 Categories:
                  .flex.flex-wrap.gap-2
                    PrtChip(
                      v-for="category in episode.metadata.categories" 
                      :key="category" 
                      class="text-xs bg-neutral-800"
                    ) {{ category }}
                
                .flex.flex-col.gap-1(v-if="episode.metadata?.tags?.length" class="sm:flex-row")
                  span.text-sm.font-bold.text-neutral-400.min-w-20 Tags:
                  p(class="text-neutral-300 text-xs leading-relaxed") {{ formatTags(episode.metadata.tags) }}
                
                .flex.flex-col.gap-1(v-if="episode.metadata?.keyTopics?.length" class="sm:flex-row")
                  span.text-sm.font-bold.text-neutral-400.min-w-20 Topics:
                  p(class="text-neutral-300 text-xs leading-relaxed") {{ formatTags(episode.metadata.keyTopics) }}
  
      //- Transcript
      .w-full.mb-6(v-if="episode?.languageContent?.de?.timestamps")
        transcriptDisplay(
          :timestamps="episode.languageContent.de.timestamps"
          :active-segment-index="activeSegmentIndex"
          :current-time="audioCurrentTime"
        )
  
      //- Language Content
      .grid.gap-6(
        v-if="episode"
        class="grid-cols-1 md:grid-cols-2"
      )
        //- German
        .w-full.bg-black.rounded-lg.p-4(v-if="episode.languageContent?.de?.dialogue")
          h3.text-lg.font-bold.text-white.mb-4 German
          pre.text-neutral-300.whitespace-pre-wrap.text-sm {{ formatDialogue(episode.languageContent.de.dialogue) }}
        
        //- English
        .w-full.rounded-lg.p-4(v-if="episode.languageContent?.en?.dialogue")
          h3.text-lg.font-bold.text-white.mb-4 English
          pre.text-neutral-300.whitespace-pre-wrap.text-sm {{ formatDialogue(episode.languageContent.en.dialogue) }}
  </template>

<script setup lang="ts">
import { computed} from 'vue'
import { ArrowLeft, Play, Pause } from 'lucide-vue-next'
import { usePodcastCrud } from '@/composables/usePodcastCrud'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import { useTranscriptSync } from '@/composables/useTranscriptSync'
import TranscriptDisplay from '@/components/TranscriptDisplay.vue'

const route = useRoute()
const { getEpisode } = usePodcastCrud()
const audioStore = useAudioPlayerStore()

interface Episode {
  id: string
  seriesId: string
  title: string
  date: string
  description: string
  about: string
  audioUrl: string
  metadata?: {
    categories?: string[]
    tags?: string[]
    keyTopics?: string[]
  }
  languageContent?: {
    de?: { 
      dialogue?: string
      audioUrl?: string
      timestamps?: TranscriptSegment[]
    }
    en?: { 
      dialogue?: string 
    }
  }
}

const { data: episode } = await useAsyncData<Episode>('episode', () => 
  getEpisode(route.params.id as string, route.params.episodeId as string)
)

const audioCurrentTime = computed(() => audioStore.currentTime * 1000)

const {
  activeSegmentIndex,
} = useTranscriptSync(
  computed(() => episode.value?.languageContent?.de?.timestamps || []),
  audioCurrentTime
)

const isPlaying = computed(() => 
  audioStore.currentEpisode?.id === episode.value?.id && 
  audioStore.currentEpisode?.isPlaying
)

const formatTags = (tags?: string[]): string => 
  tags?.map(tag => `#${tag.trim().replace(/\s+/g, '-')}`).join(', ') ?? ''

const formatDialogue = (text?: string): string => 
  text?.replace(/\r\n/g, '\n')
     .replace(/(\[[A-Z]\]:.*?)(?=\n\[[A-Z]\]:|$)/g, '$1\n\n')
     .replace(/\n{3,}/g, '\n\n')
     .trim() ?? ''

const formatDate = (dateString?: string): string => 
  dateString ? new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : ''

const formatEpisodeId = (id?: string): string => 
  id?.match(/^(ep\d+)/)?.[1].toUpperCase() ?? id?.toUpperCase() ?? ''

const handlePlayClick = async () => {
  if (!episode.value) return
  
  const audioUrl = episode.value.languageContent?.de?.audioUrl || episode.value.audioUrl
  
  await audioStore.playEpisode({
    id: episode.value.id,
    seriesId: episode.value.seriesId,
    title: formatEpisodeId(episode.value.id),
    audioUrl,
    description: episode.value.description,
    image: `/api/podcast/images/series/${episode.value.seriesId}`
  })
}
</script>

<style scoped>
pre {
  font-family: monospace;
  font-size: 0.9em;
  line-height: 1.6;
}

.overflow-y-auto::-webkit-scrollbar {
  display: none;
}

.overflow-y-auto {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>