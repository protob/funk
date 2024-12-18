import { ref, watch, computed, type Ref } from 'vue'

export interface TranscriptWord {
  text: string
  start: number
  end: number
}

export interface TranscriptSegment {
  speaker: string
  text: string
  start: number
  end: number
  words: TranscriptWord[]
}

export function useTranscriptSync(
  timestamps: Ref<TranscriptSegment[]>,
  currentTimeMs: Ref<number>
) {
  const activeSegmentIndex = ref(-1)
  const activeWordIndex = ref(-1)
  const lastProcessedTime = ref(0)

  //  flattened words with their segment indices
  const flatWordsWithIndices = computed(() => {
    let wordIndex = 0
    return timestamps.value.flatMap((segment, segmentIndex) => 
      segment.words.map(word => ({
        ...word,
        speaker: segment.speaker,
        globalIndex: wordIndex++,
        segmentIndex,

        bufferedStart: Math.max(0, word.start - 50),
        bufferedEnd: word.end + 50
      }))
    )
  })

  // active word
  const findActiveWordIndex = (time: number, words: ReturnType<typeof flatWordsWithIndices>['value']) => {
    let start = 0
    let end = words.length - 1

    while (start <= end) {
      const mid = Math.floor((start + end) / 2)
      const word = words[mid]

      if (time >= word.bufferedStart && time <= word.bufferedEnd) {
        return mid
      }

      if (time < word.bufferedStart) {
        end = mid - 1
      } else {
        start = mid + 1
      }
    }

    //  closest word if exact match not found
    const closestWord = words.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.start - time)
      const currDiff = Math.abs(curr.start - time)
      return currDiff < prevDiff ? curr : prev
    })

    return closestWord.globalIndex
  }


  let rafId: number | null = null
  
  watch(currentTimeMs, (time) => {
    // Skip if time difference is too small
    if (Math.abs(time - lastProcessedTime.value) < 16) return
    
    if (rafId) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      const words = flatWordsWithIndices.value
      if (!words.length) return

      const foundWordIndex = findActiveWordIndex(time, words)
      if (foundWordIndex !== activeWordIndex.value) {
        activeWordIndex.value = foundWordIndex
        const word = words[foundWordIndex]
        if (word && word.segmentIndex !== activeSegmentIndex.value) {
          activeSegmentIndex.value = word.segmentIndex
        }
      }

      lastProcessedTime.value = time
      rafId = null
    })
  }, { immediate: true })

  return {
    activeWordIndex,
    activeSegmentIndex
  }
}