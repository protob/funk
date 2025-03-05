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
import { computed } from "vue";
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

const parseDialogueLines = (text: string): DialogueLine[] => {
  if (!text) return [];

  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");

  const initialAcc = { result: [] as DialogueLine[], speaker: "", text: "" };

  const { result, speaker, text: currentText } = lines.reduce(
    (acc, line) => {
      const trimmed = line.trim();
      if (!trimmed) return acc;

      const match = trimmed.match(/^(?:\[([A-Za-z0-9]+)\]:|\b([A-Za-z]+):)(.+)$/);
      if (match) {
        const updatedResult =
          acc.speaker && acc.text
            ? [...acc.result, { speaker: acc.speaker, text: acc.text.trim() }]
            : acc.result;
        return {
          result: updatedResult,
          speaker: (match[1] ?? match[2] ?? "").trim(),
          text: (match[3] ?? "").trim(),
        };
      }
      return acc.speaker
        ? { ...acc, text: acc.text + "\n" + trimmed }
        : { ...acc, result: [...acc.result, { speaker: "", text: trimmed }] };
    },
    initialAcc
  );

  return speaker && currentText
    ? [...result, { speaker, text: currentText.trim() }]
    : result;
};

const alignDialoguesBySpeaker = (
  deLines: DialogueLine[],
  enLines: DialogueLine[]
): { de: DialogueLine[]; en: DialogueLine[] } => {
  const maxLength = Math.max(deLines.length, enLines.length);
  const de = [...deLines];
  const en = [...enLines];

  while (de.length < maxLength) {
    de.push({ speaker: "", text: "" });
  }
  while (en.length < maxLength) {
    en.push({ speaker: "", text: "" });
  }

  return { de, en };
};

const processedDialogues = computed(() => {
  const de = episode.value?.languageContent?.de?.dialogue
    ? parseDialogueLines(episode.value.languageContent.de.dialogue)
    : [];
  const en = episode.value?.languageContent?.en?.dialogue
    ? parseDialogueLines(episode.value.languageContent.en.dialogue)
    : [];
  return alignDialoguesBySpeaker(de, en);
});

const formatTags = (tags?: string[]): string =>
  tags ? tags.map((tag) => `#${tag.trim().replace(/\s+/g, "-")}`).join(", ") : "";

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
  return match?.[1] ? match[1].toUpperCase() : id.toUpperCase();
};

const handlePlayClick = async (): Promise<void> => {
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
