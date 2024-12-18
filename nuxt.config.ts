// https://nuxt.com/docs/api/configuration/nuxt-config

import { resolve } from 'path'
export default defineNuxtConfig({
  compatibilityDate: '2024-12-09',
  devtools: { enabled: true },
  devServer: {
    port: 3001,
  },
  app: {
    head: {
      charset: 'utf-8',
      title: 'Funk',
      viewport: 'width=device-width, initial-scale=1',
    },
  },
  alias: {
    '~': './server',
    '@': './app'
  },
  future: {compatibilityVersion: 4},
  extends: [
    'github:monoprotium/protobiont-ui-layer'
  ],
  modules: [
    '@unocss/nuxt',
    "@vueuse/nuxt",
    '@pinia/nuxt',
    '@nuxt/image',
    'nuxt-lucide-icons', 
    'pinia-plugin-persistedstate/nuxt',
  ],

  css: [
    // '@unocss/reset/tailwind-compat.css',
    '@/assets/style.css',
  ],

  build: {

    transpile: [
        'class-variance-authority',
        /\.vue$/,
    ]
},

  ssr: false,
  unocss: {
    preflight: true,
  },
  runtimeConfig: {
      appDataPath: process.env.APP_DATA_PATH,
      assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
  },

  vite: {
    resolve: {
      extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
      alias: {
        '@': resolve(__dirname, './app'),
        '~': resolve(__dirname, './server')
      }
    }
  }
})
