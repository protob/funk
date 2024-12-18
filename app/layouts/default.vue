<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-24">
    <!-- Header -->
    <PrtAppHeader
      :pages="['forsche', 'characters', 'series', 'episodes', 'create']"
      @navigate="handleNavigation"
    >
      <template #logo>
        <nuxt-link to="/">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900">
              <PrtIcon size="base" iconComponent="home" />
            </div>
          </div>
        </nuxt-link>

      </template>
    </PrtAppHeader>

    <!-- Main Content -->
    <div :class="['container mx-auto px-4 py-8', maxWidthClass]">
      <main>
        <slot />
      </main>
    </div>

    <!-- Audio Player Footer -->
    <PlayerFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Type-safe route pattern matching
const isFullWidthRoute = (route: ReturnType<typeof useRoute>) => {
  // Check if we're on an episode detail page
  const isEpisodeDetail = /^\/series\/[\w-]+\/episodes\/[\w-_]+$/.test(route.path)
  
  // Check if we're on an album page
  const isAlbumPage = route.name === 'albums-id'
  
  return isEpisodeDetail || isAlbumPage
}

const maxWidthClass = computed(() => {
  return isFullWidthRoute(route) ? 'max-w-full' : 'max-w-6xl'
})

// Type-safe navigation handler
type NavigationPage = 'forsche' | 'characters' | 'series' | 'episodes' | 'create'

const handleNavigation = (page: NavigationPage) => {
  const routeMap: Record<NavigationPage, string> = {
    forsche: '/series/forsche',
    characters: '/characters',
    series: '/series',
    episodes: '/series/forsche/episodes',
    create: '/create/episode'
  }

  const targetRoute = routeMap[page]
  
  router.push(targetRoute).catch(err => {
    if (err.name !== 'NavigationDuplicated') {
      console.error('Navigation error:', err)
    }
  })
}


</script>

<style scoped>
:deep(.p-5.flex-grow) {
  display: none;
}
/* :deep(.container.max-w-full .container) {
  max-width: 100%!important;
} */
</style>