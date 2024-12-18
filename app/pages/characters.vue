<template lang="pug">
  .app-wrap.flex.justify-center.items-top.min-h-screen
    .container.p-8.w-full(class="max-w-xs sm:max-w-full")
      .grid.grid-cols-1.gap-6(class="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3")
        PrtCard.h-full(
          variant="elevated"
          v-for="character in characters"
          :key="character.characterId"
        )
          template(#image)
            img.w-full.object-cover(
              :src="character.imgPath"
              :alt="character.name"
              @load="(event) => handleImageLoad(event.target)"
            )
          
          template(#header)
            h3.text-xl.font-semibold.text-white {{ character.name }}
          
          template(#content)
            p.text-gray-300.mb-4 {{ character.about }}
            .flex.flex-wrap.gap-2.justify-start
              span.inline-block.bg-gray-700.px-3.py-1.text-sm.font-semibold.text-gray-300(
                v-for="tag in character.tags"
                :key="tag"
              ) {{ tag }}
          
          template(#footer)
            .flex.justify-between.items-center
              span.text-sm.text-gray-400 Character
              PrtBtn(color="bg-neutral-900" size="sm") View Details
  </template>
  
  <script setup lang="ts">
  import { usePodcastCrud } from '@/composables/usePodcastCrud'
  import type { Character } from '@/types/podcast'
  
  const { data: characters } = await useAsyncData<Character[]>('characters', () => 
    usePodcastCrud().getCharacters()
  )
  
  const handleImageLoad = (target: EventTarget | null) => {
    (target as HTMLElement)?.parentElement?.classList.remove('opacity-0')
  }
  </script>
  