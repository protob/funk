import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface AudioState {
  currentEpisode: {
    id: string
    seriesId: string
    title: string
    audioUrl: string
    duration: number
    currentTime: number
    isPlaying: boolean
    image?: string
    description?: string
  } | null
  volume: number
  muted: boolean
  loading: boolean
  playbackSpeed: number
  currentTime: number
  isAudioPlaying: boolean
}

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  const currentEpisode = ref<AudioState['currentEpisode']>(null)
  const volume = ref(1)
  const muted = ref(false)
  const loading = ref(false)
  const playbackSpeed = ref(1)
  const currentTime = ref(0)
  const isAudioPlaying = ref(false)

  const progress = computed(() => {
    if (!currentEpisode.value?.duration) return 0
    return (currentEpisode.value.currentTime / currentEpisode.value.duration) * 100
  })

  const playEpisode = async (episode: {
    id: string,
    seriesId: string,
    title: string,
    audioUrl: string,
    description?: string
  }) => {
    if (currentEpisode.value?.id === episode.id) {
      togglePlay()
      return
    }

    if (currentEpisode.value) {
      stop()
    }
    loading.value = true
    currentEpisode.value = {
      ...episode,
      duration: 0,
      currentTime: 0,
      isPlaying: true,
      image: `/api/podcast/images/series/${episode.seriesId}`
    }
    isAudioPlaying.value = true
  }

  const togglePlay = () => {
    if (currentEpisode.value) {
      const newState = !currentEpisode.value.isPlaying
      currentEpisode.value.isPlaying = newState
      isAudioPlaying.value = newState
    }
  }

  const setPlayingState = (isPlaying: boolean) => {
    if (currentEpisode.value) {
      currentEpisode.value.isPlaying = isPlaying
      isAudioPlaying.value = isPlaying
    }
  }

  const updateProgress = (time: number, duration: number) => {
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
      currentEpisode.value.duration = duration
      loading.value = false
    }
  }

  const updateCurrentTime = (time: number) => {
    currentTime.value = time
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
    }
  }

  const setTime = (time: number) => {
    currentTime.value = time
    if (currentEpisode.value) {
      currentEpisode.value.currentTime = time
    }
  }

  const setVolume = (volume: number) => {
    volume.value = Math.max(0, Math.min(1, volume))
  }

  const toggleMute = () => {
    muted.value = !muted.value
  }

  const setPlaybackSpeed = (speed: number) => {
    playbackSpeed.value = speed
  }

  const stop = () => {
    if (currentEpisode.value) {
      currentEpisode.value.isPlaying = false
      currentEpisode.value.currentTime = 0
      currentTime.value = 0
      loading.value = false
      isAudioPlaying.value = false
    }
  }

  return {
    currentEpisode,
    volume,
    muted,
    loading,
    playbackSpeed,
    currentTime,
    isAudioPlaying,
    progress,
    playEpisode,
    togglePlay,
    setPlayingState,
    updateProgress,
    updateCurrentTime,
    setTime,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    stop
  }
}, {
  persist: {
    key: 'audio-player',
    // storage: localStorage,
    // Array of dot-notation paths to pick what should be persisted.
    pick: ['state.volume', 'state.muted', 'state.playbackSpeed']
  }
})