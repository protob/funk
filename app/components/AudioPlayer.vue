<template lang="pug">
  .flex.items-center.justify-between.h-24.bg-neutral-900(v-if="audioStore.currentEpisode" class="px-2 md:px-4")
    .items-center.gap-4.hidden(class="lg:flex sm:w-[300px] lg:w-[30%]")
      .flex.items-center.gap-3
        .w-14.h-14.bg-neutral-900.rounded.flex-shrink-0
          img.w-full.h-full.object-cover.rounded(:src="`/api/podcast/images/series/${audioStore.currentEpisode.seriesId}`" alt="Episode cover")
        .min-w-0.flex-1
          h6.text-sm.font-medium.text-neutral-200.truncate(class="max-w-[200px] xl:max-w-[300px]") {{ audioStore.currentEpisode.title }}
          p.text-xs.text-neutral-500.truncate(class="max-w-[200px]") {{ audioStore.currentEpisode.seriesId }}

    .flex.flex-col.items-center.gap-2(class="flex-1 sm:flex-none sm:w-[400px] lg:w-[500px]")
      .flex.items-center.justify-center.gap-4(class="sm:gap-6")
        .flex.items-center.gap-2(class="sm:hidden")
          button(class="text-neutral-400 hover:text-neutral-200 p-2" @click="toggleMute")
            Volume2(class="w-4 h-4" v-if="!mediaMuted && mediaVolume > 0.5")
            Volume1(class="w-4 h-4" v-else-if="!mediaMuted && mediaVolume > 0")
            VolumeX(class="w-4 h-4" v-else)
            
          button.p-2(class="text-neutral-400 hover:text-neutral-200" @click="isSpeedMenuOpen = !isSpeedMenuOpen")
            Gauge(class="w-4 h-4")
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="goToStart")
          SkipBack(class="w-4 h-4")
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="skipBackward")
          Undo(class="w-4 h-4")
        button.flex.items-center.justify-center.w-8.h-8.rounded-full.transition-colors(
          class="hover:bg-neutral-700"
          @click="togglePlay"
          :class="{'bg-neutral-800': !playing, 'bg-neutral-700': playing}"
        )
          Play(class="w-4 h-4 text-neutral-200 ml-0.5" v-if="!playing")
          Pause(class="w-4 h-4 text-neutral-200" v-else)
        button.text-neutral-400.transition-colors.p-2(class="hover:text-neutral-300" @click="skipForward")
          Redo(class="w-4 h-4")

      .flex.items-center.gap-2.w-full.px-2
        span(class="text-[11px] text-neutral-400 font-mono min-w-[48px] text-right") {{ formatTime(currentTime) }}
        .relative.flex-1.mx-2
          PrtSlider(
            ref="sliderRef"
            :model-value="sliderValue"
            :min="0"
            :max="100"
            :step="0.1"
            @change="handleSliderChange"
            @start="handleDragStart"
            @end="handleDragEnd"
            @click="handleSliderClick"
            bg-color="bg-neutral-700/50"
            range-color="bg-neutral-400"
            handle-color="bg-white"
          )
        span(class="text-[11px] text-neutral-400 font-mono min-w-[48px]") {{ formatTime(duration) }}

    //- left side speed menu
    .items-center.gap-4.hidden(class="sm:flex sm:w-[180px] lg:w-[30%] justify-end")
      .relative.group
        button.flex.items-center.gap-1.px-2.py-1.rounded(
          class="text-neutral-400 hover:text-neutral-200"
          @click="isSpeedMenuOpen = !isSpeedMenuOpen"
        )
          Gauge(class="w-4 h-4")
          span.text-xs {{ audioStore.playbackSpeed }}x


        //- Speed Menu
   
        .absolute.bottom-full.right-0.mb-2.rounded-lg.shadow-lg.overflow-hidden.z-50(
          class="bg-neutral-800"
          v-if="isSpeedMenuOpen"
          @mouseleave="isSpeedMenuOpen = false"
        )
          .py-1
            button.w-full.px-4.py-2.text-sm.text-left(
              v-for="speed in playbackSpeeds"
              :key="speed"
              @click="setSpeed(speed)"
              class="hover:bg-neutral-700 text-neutral-200"
              :class="{ 'bg-neutral-700': audioStore.playbackSpeed === speed }"
            ) {{ speed }}x

      button(class="text-neutral-400 hover:text-neutral-200" @click="toggleMute")
        Volume2(class="w-5 h-5" v-if="!mediaMuted && mediaVolume > 0.5")
        Volume1(class="w-5 h-5" v-else-if="!mediaMuted && mediaVolume > 0")
        VolumeX(class="w-5 h-5" v-else)
      .relative.w-24
        PrtSlider(
          v-model="volumeValue"
          :min="0"
          :max="100"
          :step="1"
          @change="handleVolumeSliderChange"
          bg-color="bg-neutral-700/50"
          range-color="bg-neutral-400"
          handle-color="bg-white"
        )

    //- Speed Menu dropdown for mobile
    .fixed.inset-x-0.bottom-24.mx-auto.w-48.rounded-lg.shadow-lg.overflow-hidden.z-50(
      class="bg-neutral-800 sm:hidden"
      v-if="isSpeedMenuOpen"
      @click.self="isSpeedMenuOpen = false"
    )
   
      .py-1
        button.w-full.px-4.py-2.text-sm.text-left(
          v-for="speed in playbackSpeeds"
          :key="speed"
          @click="setSpeed(speed)"
          class="hover:bg-neutral-700 text-neutral-200"
          :class="{ 'bg-neutral-700': audioStore.playbackSpeed === speed }"
        ) {{ speed }}x

    audio(ref="audioElement")
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useAudioPlayerStore } from '@/stores/audioPlayer'
import { useMediaControls, useDebounceFn } from '@vueuse/core'
import { SkipBack, Undo, Redo, Play, Pause, Volume1, Volume2, VolumeX, Gauge } from 'lucide-vue-next'


const audioStore = useAudioPlayerStore()
const audioElement = ref<HTMLMediaElement | null>(null)
const sliderRef = ref<HTMLElement | null>(null);


const {
  playing,
  currentTime,
  duration,
  volume: mediaVolume,
  muted: mediaMuted,
  playbackRate,
} = useMediaControls(audioElement, {
  src: computed(() => audioStore.currentEpisode?.audioUrl || ''),
})

const isInternalChange = ref(false)
const isDragging = ref(false)
const isSpeedMenuOpen = ref(false)
const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5] as const

const sliderValue = ref(0)
const volumeValue = ref(mediaVolume.value * 100)

const updateVolume = useDebounceFn((newVolume: number) => {
  mediaVolume.value = newVolume
}, 50)

const seekTo = (time: number) => {
  if (!audioElement.value) return
  currentTime.value = time
  audioStore.setTime(time)
}

const handleSliderChange = (value: number) => {
  sliderValue.value = value
  if (!isDragging.value) {
    seekTo((value / 100) * duration.value)
  }
}

const handleDragStart = () => {
  isDragging.value = true
  if (audioElement.value && playing.value) {
    playing.value = false
  }
}

const handleDragEnd = async () => {
  if (!isDragging.value) return
  
  seekTo((sliderValue.value / 100) * duration.value)
  isDragging.value = false
  
  if (audioElement.value && audioStore.currentEpisode?.isPlaying) {
    await nextTick()
    playing.value = true
  }
}

const handleSliderClick = (event: MouseEvent) => {
  if (!sliderRef.value || !audioElement.value) return
  if (isDragging.value) return
  
  const sliderRect = sliderRef.value.$el.getBoundingClientRect()
  const clickPosition = event.clientX - sliderRect.left
  const sliderWidth = sliderRect.width
  const seekPercentage = (clickPosition / sliderWidth) * 100
  
  sliderValue.value = seekPercentage
  seekTo((seekPercentage / 100) * duration.value)
}

const togglePlay = async () => {
  if (!audioElement.value) return
  try {
    isInternalChange.value = true
    playing.value = !playing.value
    audioStore.setPlayingState(playing.value)
  } catch (error) {
    console.error('Playback error:', error)
  } finally {
    isInternalChange.value = false
  }
}

const toggleMute = () => {
  mediaMuted.value = !mediaMuted.value
  audioStore.toggleMute()
}

const handleVolumeSliderChange = (value: number) => {
    volumeValue.value = value
    const newVolume = value / 100
    updateVolume(newVolume)
    // TODO: Set volume in store
   // audioStore.setVolume(newVolume)
}


const setSpeed = (speed: number) => {
  if (audioElement.value) {
    audioElement.value.playbackRate = speed
    audioStore.setPlaybackSpeed(speed)
    isSpeedMenuOpen.value = false
  }
}


const SKIP_SECONDS = 15
const skipForward = () => {
  if (!audioElement.value) return
  seekTo(Math.min(currentTime.value + SKIP_SECONDS, duration.value))
}

const skipBackward = () => {
  if (!audioElement.value) return
  seekTo(Math.max(currentTime.value - SKIP_SECONDS, 0))
}

const goToStart = () => {
  if (!audioElement.value) return
  seekTo(0)
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const [mins, secs] = [Math.floor(seconds / 60), Math.floor(seconds % 60)]
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

watch(() => audioStore.currentEpisode?.audioUrl, async (newUrl) => {
  if (newUrl && audioStore.currentEpisode?.isPlaying) {
    await nextTick()
    playing.value = true
  }
}, { immediate: true })

watch(() => audioStore.currentEpisode?.isPlaying, async (newVal) => {
  if (!audioElement.value || isInternalChange.value) return
  try {
    playing.value = newVal
  } catch (error) {
    console.error('Error syncing playback state:', error)
  }
}, { immediate: true })

onMounted(() => {
  if (audioElement.value) {
    volumeValue.value = mediaVolume.value * 100
    playbackRate.value = audioStore.playbackSpeed
  }
})
</script>