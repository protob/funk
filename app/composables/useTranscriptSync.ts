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

export interface FlattenedWord extends TranscriptWord {
  speaker: string
  globalIndex: number
  segmentIndex: number
  bufferedStart: number
  bufferedEnd: number
}

export function useTranscriptSync(
  timestamps: Ref<TranscriptSegment[]>,
  currentTimeMs: Ref<number>
) {
  const activeSegmentIndex = ref(-1)
  const activeWordIndex = ref(-1)
  const lastProcessedTime = ref(0)


  const flatWordsWithIndices = computed<FlattenedWord[]>(() => {
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


  const findActiveWordIndex = (time: number, words: FlattenedWord[]): number => {
    if (!words.length) return -1

    const firstWord = words[0]
    const lastWord = words[words.length - 1]


    if (!firstWord || !lastWord) return -1


    if (time < firstWord.bufferedStart) return 0
    if (time > lastWord.bufferedEnd) return words.length - 1


    let start = 0
    let end = words.length - 1
    let bestMatchIndex = 0
    let bestMatchDistance = Infinity

    while (start <= end) {
      const mid = Math.floor((start + end) / 2)
      const word = words[mid]


      if (!word) continue

      if (time >= word.bufferedStart && time <= word.bufferedEnd) {
        return mid
      }

      const distance = Math.min(
        Math.abs(time - word.bufferedStart),
        Math.abs(time - word.bufferedEnd)
      )

      if (distance < bestMatchDistance) {
        bestMatchDistance = distance
        bestMatchIndex = mid
      }

      if (time < word.bufferedStart) {
        end = mid - 1
      } else {
        start = mid + 1
      }
    }

    return bestMatchIndex
  }

  let rafId: number | null = null

  watch(currentTimeMs, (time) => {

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

        if (foundWordIndex >= 0 && foundWordIndex < words.length) {
          const word = words[foundWordIndex]
          if (word && word.segmentIndex !== activeSegmentIndex.value) {
            activeSegmentIndex.value = word.segmentIndex
          }
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
