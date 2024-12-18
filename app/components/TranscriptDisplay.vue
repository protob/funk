<template lang="pug">
  .transcript-container(class="p-4 rounded-lg")
    template(v-for="(segment, segmentIndex) in timestamps" :key="`segment-${segmentIndex}`")
      .segment( :class="{  'active-segment': segmentIndex === activeSegmentIndex, 'bg-neutral-800/50': isSegmentActive(segment) }", class="mb-4 p-2 rounded transition-colors duration-200")
        span(class="inline-block font-bold text-neutral-100 mr-2") {{ segment.speaker }}:
        .words(class="inline")
          template(
            v-for="(word, wordIndex) in segment.words" 
            :key="`word-${segmentIndex}-${wordIndex}`"
          )
            span.word(:class="{'highlighted': isWordActive(word),'transition-colors': true,'text-neutral-300': true }") {{ word.text }}{{ ' ' }}
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import type { TranscriptSegment } from '@/composables/useTranscriptSync'
  
  const props = defineProps<{
    timestamps: TranscriptSegment[]
    activeSegmentIndex: number
    currentTime: number
  }>()

  const currentSegmentIndex = computed(() => {
    return props.timestamps.findIndex(segment => 
      props.currentTime >= segment.start && props.currentTime <= segment.end
    )
  })
  
  const isSegmentActive = (segment: TranscriptSegment) => {
    return props.currentTime >= segment.start && props.currentTime <= segment.end
  }
  
  const isWordActive = (word: { start: number; end: number }) => {
    const bufferedStart = Math.max(0, word.start - 50)
    const bufferedEnd = word.end + 50
    return props.currentTime >= bufferedStart && props.currentTime <= bufferedEnd
  }
  </script>
  
  <style scoped>
  .transcript-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }
  
  .active-segment {
    @apply bg-neutral-900;
  }
  
  .word {
    @apply inline-block px-0.5;
  }
  
  .highlighted {
    @apply text-orange-500 font-medium;
  }

  .segment {
    transition: background-color 0.2s ease;
  }
  
  .word {
    transition: color 0.15s ease;
  }
  </style>