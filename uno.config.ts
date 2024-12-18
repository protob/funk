import {
    defineConfig,
    presetAttributify,
    presetIcons,
    presetUno,
    transformerCompileClass,
    transformerDirectives,
  } from 'unocss';
  
  import extractorPug from '@unocss/extractor-pug'


  // Utility function for rule generation
  type Rule = [RegExp, (m: [string, string, 'px' | 'rem' | '%']) => { [k: string]: string }]
  const generateRules = (map: Record<string, string>): Rule[] =>
    Object.entries(map).map(([prefix, prop]) => [
      new RegExp(`^${prefix}-\\[(\\d+)(px|rem|%)\\]$`),
      ([_, n, u]) => ({ [prop]: `${n}${u}` })
    ]);
  
  // Types for safelist
  type Suffix = number | string;
  interface ClassMap {
    [key: string]: Suffix[];
  }
  
  // Safelist classes definition
  const safelistClasses: ClassMap = {
    "bg-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "border-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "text-el": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "border": ["green-500", "blue-500"],
    "h": [6],
    "min-h": [6],
    "p": ["0.5"],
  
  };
  
  // Timeline extra classes
  const extraClasses = Array.from({ length: 21 }, (_, i) => `left-${i * 5}%`);
  

  // Main configuration
  export default defineConfig({

    extractors: [
        extractorPug(),
    ],


    // Important: Load presets first
    presets: [
      presetUno(),

    ],
  
    // Transformers
    transformers: [

      transformerCompileClass(),
      transformerDirectives({ enforce: 'pre' }),
    ],
  

  
    // Theme configuration
    theme: {

        breakpoints: {
            '2xs': '320px',
            xs: "480px",
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },

      colors: {
        active: { 100: '#ffffff', 400: '#3b82f6' },
        blk: {
          1: '#111827',
          2: '#1F2937',
          3: '#374151',
        },
        el: {
          1: '#334155',
          2: '#1E293B',
          3: '#064E3B',
          4: '#7C3AED',
          5: '#DB2777',
          6: '#059669',
          7: '#0284C7',
          8: '#DC2626',
          9: '#D97706',
          10: '#0EA5E9',
        },
        accent: {
          1: '#6B7280',
          2: '#FBBF24',
        },
        state: {
          success: '#4ADE80',
          error: '#EF4444',
          warning: '#F59E0B',
          disabled: '#A1A1AA',
        },
        brand: {
          primary: 'hsla(var(--hue, 217), 78%, 51%)',
        },
      },
    },
  
    // Custom rules
    rules: [
      ['px-100', { 'padding-left': '100px', 'padding-right': '100px' }],
      [/^left-(\d+)%$/, ([_, n]) => ({ left: `${n}%` })],
    ],
  
    // Shortcuts
    shortcuts: [
      {
        'custom-shortcut': 'text-lg text-orange hover:text-teal',
        'custom-btn': 'py-2 px-4 font-semibold rounded-lg shadow-md',
      },
      [/^btn-(.*)$/, ([, c]) => `bg-${c}-400 text-${c}-100 py-2 px-4 rounded-lg`],
    ],
  
    // Content pipeline
    content: {
      pipeline: {
        include: [
          '**/*.{vue,js,ts,jsx,tsx,html}',
        ],
      },
    },
  });