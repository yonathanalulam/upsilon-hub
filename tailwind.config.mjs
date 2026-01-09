/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class', // <--- This enables the manual toggle
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif'], // Premium font
				serif: ['Merriweather', 'serif'], // Editorial font
			},
		},
	},
	plugins: [],
}