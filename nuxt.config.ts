// https://nuxt.com/docs/api/configuration/nuxt-config

import { defineNuxtConfig } from 'nuxt/config';
import type { NuxtConfig } from '@nuxt/schema';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const AGENIX_BASE_PATH = '/run/agenix/';

// Load config: 1. Agenix (if specified), 2. ENV. Warns if expected & missing.
async function loadConfigValue(
  configKeyName: string,
  agenixFileName: string | null,
  envVarName: string,
  expected: boolean = true
): Promise<string | undefined> {
  const agenixPath = agenixFileName ? AGENIX_BASE_PATH + agenixFileName : null;

  // Agenix value loading and error handling
  const agenixValue = agenixPath ? await readFile(agenixPath, 'utf-8').then(content => content?.trim() || undefined).catch(e => (e.code !== 'ENOENT' && console.warn(`[CL] Err '${configKeyName}' Agx ${agenixPath}: ${e.message?.split('\n')[0]}`), undefined)) : undefined;
  const value = agenixValue ?? (process.env[envVarName]?.trim() || undefined);

  if (!value && expected) {
    console.warn(`WARN: Expected '${configKeyName}' (Agenix: ${agenixFileName ? 'yes' : 'no'}, ENV: '${envVarName}') missing. Some features affected.`);
  }
  
  return value;
}

export default async (): Promise<NuxtConfig> => {
  const appDataPath = await loadConfigValue('appDataPath', null, 'APP_DATA_PATH', true);
  const assemblyaiApiKey = await loadConfigValue('assemblyaiApiKey', 'assemblyai-api-key', 'ASSEMBLYAI_API_KEY', true);
  const openaiApiKey = await loadConfigValue('openaiApiKey', 'openai-api-key', 'OPENAI_API_KEY', true);
  
  return defineNuxtConfig({
    compatibilityDate: '2025-05-09',
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
      // 'nuxt-lucide-icons', 
      '@nuxt/icon',
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
        appDataPath,
        assemblyaiApiKey,
        openaiApiKey,
        // public: {} // Define public runtime config here if needed
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
  });
}