/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				'background-light': '#fff5d7', // Ragin Beige
				'surface-light': '#ffffff',
				'primary-light': '#ff5e6c', // Coral Pink
				'secondary-light': '#feb300', // Sleuthe Yellow
				'accent-light': '#ffaaab', // Pink Leaf
				'text-light': '#4a4a4a',

				'background-dark': '#121212', // Pure Dark Gray
				'surface-dark': '#1e1e1e', // Slightly lighter dark
				'primary-dark': '#ff5e6c', // Coral Pink
				'secondary-dark': '#feb300', // Sleuthe Yellow
				'accent-dark': '#ffaaab', // Pink Leaf
				'text-dark': '#fff5d7', // Ragin Beige text
			},
			fontFamily: {
				sans: [
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'sans-serif',
				],
				serif: ['Georgia', 'serif'],
			},
		},
	},
	plugins: [],
};