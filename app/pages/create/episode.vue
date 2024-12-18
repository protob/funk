<template lang="pug">
  .container.mx-auto.p-4
    h1.text-2xl.font-semibold.mb-6.text-white Create Episode
    form(@submit.prevent="handleSubmit")
      PrtFormGroup.mb-4(label="Audio")
        PrtUploader(
          id="audio"
          v-model="audioFiles"
          accept=".mp3,.flac,.wav,.ogg,.m4a"
          :max-size="25 * 1024 * 1024"
          @error="handleUploadError"
          :key="uploaderKey"
        )
        .text-sm.text-neutral-400.mt-2(v-if="audioFiles.length > 0")
          span Selected: {{ audioFiles[0].name }} ({{ formatFileSize(audioFiles[0].size) }})
        .text-sm.text-el-8.mt-2(v-if="audioError") {{ audioError }}
  
      //- Form fields grid
      .grid.grid-cols-1.gap-4.mb-6(class="sm:grid-cols-2 md:grid-cols-4")
        PrtFormGroup(label="Series ID" required)
          PrtFormField(
            id="seriesId"
            type="text"
            v-model="formData.seriesId"
            placeholder="Enter series ID"
          )
        PrtFormGroup(label="Episode ID" required)
          PrtFormField(
            id="id"
            type="text"
            v-model="formData.id"
            placeholder="Enter episode ID"
          )
        PrtFormGroup(label="Date")
          PrtFormField(
            id="date"
            type="text"
            v-model="formData.date"
          )
        PrtFormGroup(label="Provider")
          PrtComboBox(
            id="provider"
            :options="providers"
            v-model="formData.provider"
          )
  
      //- Transcription grid
      .grid.grid-cols-1.gap-4.mb-6(class="md:grid-cols-3")
        PrtFormGroup(label="German Transcription")
          PrtFormField(
            id="transcriptionDE"
            type="textarea"
            v-model="formData.transcription.de"
            placeholder="Enter German transcription"
          )
          PrtBtn(
            color="bg-blue-600"
            class="mt-2"
            size="sm"
            :disabled="isGeneratingDe || !hasAudioFile"
            @click.prevent="generateGermanTranscription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingDe" type="spinner" size="sm" color="gray")
        
        PrtFormGroup(label="German Transcription Timestamps")
          PrtFormField(
            id="transcriptionTimestampsDE"
            type="textarea"
            :model-value="JSON.stringify(formData.transcriptionTimestamps.de, null, 2)"
            placeholder="German Transcription Timestamps"
          )
        
        PrtFormGroup(label="English Transcription")
          PrtFormField(
            id="transcriptionEN"
            type="textarea"
            v-model="formData.transcription.en"
            placeholder="Enter English transcription"
          )
          PrtBtn(
            color="bg-blue-600"
            class="mt-2"
            size="sm"
            :disabled="isGeneratingEn || !formData.transcription.de"
            @click.prevent="generateEnglishTranscription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingEn" type="spinner" size="sm" color="gray")
  
      //- Text content grid
      .grid.grid-cols-1.gap-4.mb-6(class="md:grid-cols-3")
        PrtFormGroup(label="Title" required)
          PrtFormField.mb-2(
            id="title"
            type="textarea"
            v-model="formData.title"
            placeholder="Enter episode title"
          )
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingTitle"
            @click.prevent="generateTitle"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingTitle" type="spinner" size="sm" color="gray")
  
        PrtFormGroup(label="Description")
          PrtFormField.mb-2(
            id="description"
            type="textarea"
            v-model="formData.description"
            placeholder="Enter episode description"
          )
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingDescription"
            @click.prevent="generateDescription"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingDescription" type="spinner" size="sm" color="gray")
  
        PrtFormGroup(label="About")
          PrtFormField.mb-2(
            id="about"
            type="textarea"
            v-model="formData.about"
            placeholder="Enter episode about text"
          )
          PrtBtn.mb-2(
            color="bg-blue-600"
            size="sm"
            :disabled="!formData.transcription.de || isGeneratingAbout"
            @click.prevent="generateAbout"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingAbout" type="spinner" size="sm" color="gray")
  
      PrtFormGroup.mb-4(label="Metadata")
        .grid.grid-cols-1.gap-4.mb-2(class="sm:grid-cols-3")
          div(v-for="(value, key) in formData.metadata")
            label.block.text-white.mb-2 {{ key[0].toUpperCase() + key.slice(1).toLowerCase() }}
            PrtFormField(
              :id="key"
              type="text"
              v-model="formData.metadata[key]"
            )
        .flex.justify-between
          PrtBtn(
            color="bg-blue-600"
            size="sm"
            @click.prevent="generateMetadata"
            :disabled="(!formData.transcription.en && !formData.transcription.de) || isGeneratingMetadata"
          )
            span Generate
            PrtLoader.ml-2(v-if="isGeneratingMetadata" type="spinner" size="sm" color="gray")
  
      PrtBtn(
        color="bg-el-4"
        size="sm"
        type="submit"
        :disabled="isSubmitting"
      ) {{ isSubmitting ? 'Creating...' : 'Create Episode' }}
  </template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePodcastCrud } from '@/composables/usePodcastCrud'
import { useEpisodeCreation } from '@/composables/useEpisodeCreation'
import { useTextGeneration } from '@/composables/useTextGeneration'
import { useDiarization } from '@/composables/useDiarization'
import { useTranscription } from '@/composables/useTranscription'
import { useMetadata } from '@/composables/useMetadata'
import type { TextGenerationType } from '~/types/podcast'

interface TranscriptionWord { text: string; start: number; end: number }
interface TranscriptionSpeakerSegment { speaker: string; text: string; start: number; end: number; words: TranscriptionWord[] }
interface Metadata { categories: string; tags: string; keyTopics: string }
interface FormData {
  provider: string; seriesId: string; id: string; title: string; description: string; about: string; date: string;
  metadata: Metadata; transcriptionTimestamps: { de: TranscriptionSpeakerSegment[] }; transcription: { de: string; en: string }
}

const { getSingleSeries } = usePodcastCrud()
const { createEpisode } = useEpisodeCreation()
const { generateText, isGenerating } = useTextGeneration()
const { processAudio, isDiarizing } = useDiarization()
const { transcribeAudio, translateTranscription, isTranscribing } = useTranscription()
const { generateMetadataFromText } = useMetadata()

const providers = ['notebooklm', 'elevanlabs', 'openai', 'mixed']
const formData = ref<FormData>({
  provider: 'notebooklm', seriesId: 'forsche', id: '', title: '', description: '', about: '',
  date: new Date().toISOString().slice(0, 10),
  metadata: { categories: '', tags: '', keyTopics: '' },
  transcriptionTimestamps: { de: [] },
  transcription: { de: '', en: '' }
})

const audioFiles = ref([])
const audioError = ref('')
const isSubmitting = ref(false)
const isGeneratingDe = ref(false)
const isGeneratingEn = ref(false)
const isGeneratingTitle = ref(false)
const isGeneratingDescription = ref(false)
const isGeneratingAbout = ref(false)
const isGeneratingMetadata = ref(false)
const hasAudioFile = computed(() => audioFiles.value.length > 0 && audioFiles.value[0])
const uploaderKey = ref(0);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024, sizes = ["Bytes", "KB", "MB", "GB"], i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}


const getEpisodeNumber = (episodeId: string): number => parseInt(episodeId.match(/ep(\d+)/)?.[1] ?? '0')

await useAsyncData('initEpisodeId', async () => {
  try {
    const series = await getSingleSeries('forsche')
    if (series?.episodes?.length) {
      const nextNumber = Math.max(...series.episodes.map(ep => getEpisodeNumber(ep.id))) + 1
      formData.value.id = `ep${nextNumber}`
    }
  } catch (error) {
    console.error('Failed to fetch series episodes:', error)
  }
})

const generateTextContent = async (type: TextGenerationType) => {
  const stateMap = { title: isGeneratingTitle, description: isGeneratingDescription, about: isGeneratingAbout }
  try {
    stateMap[type].value = true
    const result = await generateText({ text: formData.value.transcription.de, type, language: 'de' })
    if (result) formData.value[type] = result
  } catch (error) {
    console.error(`Failed to generate ${type}:`, error)
  } finally {
    stateMap[type].value = false
  }
}

const generateTitle = () => generateTextContent('title')
const generateDescription = () => generateTextContent('description')
const generateAbout = () => generateTextContent('about')

const generateGermanTranscription = async () => {
  try {
    isGeneratingDe.value = true
    if (!audioFiles.value[0]) throw new Error('Please upload an audio file first')

    const diarization = await processAudio(audioFiles.value[0].file)
    formData.value.transcription.de = diarization.map(segment => `[${segment.speaker}]: ${segment.text}`).join('\n')
    formData.value.transcriptionTimestamps.de = diarization.map(segment => ({
      speaker: segment.speaker,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      words: segment.words.map(word => ({ text: word.text, start: word.start, end: word.end }))
    }))
  } catch (error: any) {
    console.error('Failed to generate transcription:', error)
    audioError.value = error.message || 'Failed to process audio'
  } finally {
    isGeneratingDe.value = false
  }
}

const generateEnglishTranscription = async () => {
  try {
    isGeneratingEn.value = true
    if (!formData.value.transcription.de) throw new Error('Please generate German transcription first')
    formData.value.transcription.en = await translateTranscription(formData.value.transcription.de, 'en')
  } catch (error: any) {
    console.error('Failed to generate English transcription:', error)
  } finally {
    isGeneratingEn.value = false
  }
}

const generateMetadata = async () => {
  try {
    isGeneratingMetadata.value = true
    const text = formData.value.transcription.en || formData.value.transcription.de
    if (!text) return
    const metadata = await generateMetadataFromText(text)
    formData.value.metadata = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value])
    ) as Metadata
  } catch (error) {
    console.error('Failed to generate metadata:', error)
  } finally {
    isGeneratingMetadata.value = false
  }
}

const handleUploadError = (error: string) => { audioError.value = error }


const resetForm = () => {
  formData.value = {
    ...formData.value,
    title: '',
    description: '',
    about: '',
    metadata: {
      categories: '',
      tags: '',
      keyTopics: ''
    },
    transcriptionTimestamps: { de: [] },
    transcription: { de: '', en: '' }
  }
  audioFiles.value = [];
  audioError.value = '';
  uploaderKey.value += 1;
}

const handleSubmit = async () => {
  try {
    isSubmitting.value = true
    audioError.value = ''
    
    const storageId = `${formData.value.id}_${formData.value.date}`
    const audioFile = audioFiles.value[0]?.file
    
    const processedMetadata = {
      categories: formData.value.metadata.categories.split(',').filter(Boolean),
      tags: formData.value.metadata.tags.split(',').filter(Boolean),
      keyTopics: formData.value.metadata.keyTopics.split(',').filter(Boolean)
    }

    await createEpisode({
      seriesId: formData.value.seriesId,
      episodeId: storageId,
      title: formData.value.title,
      about: formData.value.about,
      date: formData.value.date,
      description: formData.value.description,
      provider: formData.value.provider,
      audioFile,
      transcriptionDE: formData.value.transcription.de,
      transcriptionEN: formData.value.transcription.en, 
      transcriptionTimestampsDE: formData.value.transcriptionTimestamps.de,
      metadata: processedMetadata
    })

    resetForm()
    
  } catch (error) {
    console.error('Failed to create episode:', error)
  } finally {
    isSubmitting.value = false
  }
}
</script>