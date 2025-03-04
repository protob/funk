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
        div(class="bg-neutral-900 p-4")
          .flex.flex-col.gap-4(class="sm:flex-row sm:items-start")
            //- Image and Play Button
            .relative.rounded-lg.overflow-hidden.flex-shrink-0.group(
              class="w-24 h-24 sm:w-16 sm:h-16 bg-neutral-800"
            )
              img(
                :src="`/api/podcast/images/series/${episode.seriesId}`" 
                :alt="episode.title"
                class="w-full h-full object-cover"
              )
              .absolute.inset-0.flex.items-center.justify-center.transition-opacity(
                class="bg-black/60 opacity-0 group-hover:opacity-100"
                :class="{ 'opacity-100': isPlaying }"
              )
                button(
                  class="flex items-center justify-center rounded-full bg-green-500 text-black hover:scale-105 transition-transform w-10 h-10 sm:w-8 sm:h-8"
                  @click="handlePlayClick"
                )
                  component(:is="isPlaying ? Pause : Play" class="w-5 h-5 sm:w-4 sm:h-4")
            
            //- Episode Info
            .flex-1.min-w-0
              .episode-title
                h1.text-xl.font-bold.text-white.mb-1 {{ formatEpisodeId(episode.id) }} - {{ episode.title }}
                .text-sm(class="text-neutral-200") {{ formatDate(episode.date) }}
              
              .episode-description.mt-4
                p.text-sm(class="text-neutral-300") {{ episode.description }}
                p.text-sm.mt-2(class="text-neutral-400") {{ episode.about }}
              
              //- Metadata
              .metadata.mt-6.space-y-3
                .flex.flex-col.gap-2(
                  v-if="episode.metadata?.categories?.length" 
                  class="sm:flex-row sm:items-center"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Categories:
                  .flex.flex-wrap.gap-2
                    PrtChip(
                      v-for="category in episode.metadata.categories" 
                      :key="category" 
                      class="text-xs bg-neutral-800"
                    ) {{ category }}
                
                .flex.flex-col.gap-1(
                  v-if="episode.metadata?.tags?.length" 
                  class="sm:flex-row"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Tags:
                  p.text-xs.leading-relaxed(class="text-neutral-300") {{ formatTags(episode.metadata.tags) }}
                
                .flex.flex-col.gap-1(
                  v-if="episode.metadata?.keyTopics?.length" 
                  class="sm:flex-row"
                )
                  span.text-sm.font-bold.min-w-20(class="text-neutral-400") Topics:
                  p.text-xs.leading-relaxed(class="text-neutral-300") {{ formatTags(episode.metadata.keyTopics) }}
  
      //- Transcript highlighting
      .w-full.mb-6(v-if="episode?.languageContent?.de?.timestamps")
        transcriptDisplay(
          :timestamps="episode.languageContent.de.timestamps"
          :active-segment-index="activeSegmentIndex"
          :current-time="audioCurrentTime"
        )
  
      .mb-8(v-if="processedDialogues.de.length || processedDialogues.en.length")
        .grid.grid-cols-2
          .p-3.font-bold.text-lg.text-white(class="bg-neutral-800 rounded-t-lg") German
          .p-3.font-bold.text-lg.text-white(class="bg-neutral-800 rounded-t-lg ml-1") English
        
        //- Common container
        .overflow-y-auto(class="h-96 bg-neutral-900/40 rounded-b-lg" ref="transcriptContainer")
          //- each dialogue line is a grid row
          .dialogue-grid
            template(v-for="(_, index) in Math.max(processedDialogues.de.length, processedDialogues.en.length)" :key="index")
              .dialogue-row
                //- German side
                .dialogue-cell.border-r(class="border-neutral-800/50")
                  template(v-if="processedDialogues.de[index]")
                    span.speaker(v-if="processedDialogues.de[index].speaker") {{ processedDialogues.de[index].speaker }}:
                    span.text {{ processedDialogues.de[index].text }}
                
                //- English side  
                .dialogue-cell
                  template(v-if="processedDialogues.en[index]")
                    span.speaker(v-if="processedDialogues.en[index].speaker") {{ processedDialogues.en[index].speaker }}:
                    span.text {{ processedDialogues.en[index].text }}
  </template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { ArrowLeft, Play, Pause } from "lucide-vue-next";
import { usePodcastCrud } from "@/composables/usePodcastCrud";
import { useAudioPlayerStore } from "@/stores/audioPlayer";
import {
  useTranscriptSync,
  type TranscriptSegment,
} from "@/composables/useTranscriptSync";
import TranscriptDisplay from "@/components/TranscriptDisplay.vue";
import { useRoute, useAsyncData } from "nuxt/app";

const route = useRoute();
const { getEpisode } = usePodcastCrud();
const audioStore = useAudioPlayerStore();

interface Episode {
  id: string;
  seriesId: string;
  title: string;
  date: string;
  description: string;
  about: string;
  audioUrl: string;
  metadata?: {
    categories?: string[];
    tags?: string[];
    keyTopics?: string[];
  };
  languageContent?: {
    de?: {
      dialogue?: string;
      audioUrl?: string;
      timestamps?: TranscriptSegment[];
    };
    en?: {
      dialogue?: string;
    };
  };
}

interface DialogueLine {
  speaker: string;
  text: string;
}

interface PlayEpisodeParams {
  id: string;
  seriesId: string;
  title: string;
  audioUrl: string;
  description?: string;
  image?: string;
}

const { data: episode } = await useAsyncData<Episode>("episode", () =>
  getEpisode(route.params.id as string, route.params.episodeId as string)
);

const audioCurrentTime = computed(() => audioStore.currentTime * 1000);

const { activeSegmentIndex } = useTranscriptSync(
  computed(() => episode.value?.languageContent?.de?.timestamps || []),
  audioCurrentTime
);

const isPlaying = computed(
  () =>
    audioStore.currentEpisode?.id === episode.value?.id &&
    audioStore.currentEpisode?.isPlaying
);

const processedDialogues = computed(() => {
  const result = {
    de: [] as DialogueLine[],
    en: [] as DialogueLine[],
  };

  if (episode.value?.languageContent?.de?.dialogue) {
    result.de = parseDialogueLines(episode.value.languageContent.de.dialogue);
  }

  if (episode.value?.languageContent?.en?.dialogue) {
    result.en = parseDialogueLines(episode.value.languageContent.en.dialogue);
  }

  if (result.de.length && result.en.length) {
    const alignedDialogues = alignDialoguesBySpeaker(result.de, result.en);
    return alignedDialogues;
  }

  return result;
});

const parseDialogueLines = (text: string): DialogueLine[] => {
  if (!text) return [];

  const cleanText = text.replace(/\r\n/g, "\n").trim();
  const blocks = cleanText.split(/\n\n+/);

  return blocks.map((block) => {
    const match = block.match(/^([A-Za-z]+):(.+)$/s);
    if (match && match[1] && match[2]) {
      return {
        speaker: match[1],
        text: match[2].trim(),
      };
    }
    return {
      speaker: "",
      text: block.trim(),
    };
  });
};

const alignDialoguesBySpeaker = (
  deLine: DialogueLine[],
  enLine: DialogueLine[]
) => {
  const result = {
    de: [...deLine],
    en: [...enLine],
  };

  if (deLine.length === enLine.length) {
    return result;
  }

  return result;
};

const formatTags = (tags?: string[]): string =>
  tags?.map((tag) => `#${tag.trim().replace(/\s+/g, "-")}`).join(", ") ?? "";

const formatDate = (dateString?: string): string =>
  dateString
    ? new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const formatEpisodeId = (id?: string): string => {
  if (!id) return "";

  const match = id.match(/^(ep\d+)/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }

  return id.toUpperCase();
};

const handlePlayClick = async () => {
  if (!episode.value) return;

  const audioUrl =
    episode.value.languageContent?.de?.audioUrl || episode.value.audioUrl;

  await audioStore.playEpisode({
    id: episode.value.id,
    seriesId: episode.value.seriesId,
    title: formatEpisodeId(episode.value.id),
    audioUrl,
    description: episode.value.description,
    image: `/api/podcast/images/series/${episode.value.seriesId}`,
  } as PlayEpisodeParams);
};
</script>

<style scoped>
:deep(.overflow-y-auto::-webkit-scrollbar) {
  width: 6px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.2);
}

.dialogue-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}

.dialogue-row {
  display: contents;
}

.dialogue-cell {
  padding: 1rem;
  color: #e5e7eb; /* text-neutral-300 */
}

.speaker {
  font-weight: bold;
  color: white;
  margin-right: 0.25rem;
}

.text {
  white-space: pre-line;
}
</style>
