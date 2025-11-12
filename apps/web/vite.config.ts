import {enhancedImages} from '@sveltejs/enhanced-img'
import {sveltekit} from '@sveltejs/kit/vite'
import {defineConfig} from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import Icons from 'unplugin-icons/vite'
import {FileSystemIconLoader} from 'unplugin-icons/loaders'

export default defineConfig({
	plugins: [
		tailwindcss(),
		enhancedImages(),
		sveltekit(),
		devtoolsJson(),
		Icons({
			compiler: 'svelte',
			customCollections: {
				brand: FileSystemIconLoader('./src/icons'),
			},
		}),
	],
	test: {
		include: ['src/**/*.test.ts'],
		mockReset: true,
	},
	preview: {
		port: 5173,
	},
})
