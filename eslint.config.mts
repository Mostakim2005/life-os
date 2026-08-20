import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'tests',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
);

// Life OS uses asynchronous side effects from Obsidian UI callbacks; these callbacks are
// deliberately fire-and-forget and are wrapped with explicit `void`/error handling.
// The template's no-misused-promises rule cannot express that API pattern precisely.
{
	files: ['src/main.ts', 'src/habit-builder.ts', 'src/editor-modals.ts'],
	rules: {
		'@typescript-eslint/no-misused-promises': 'off',
	},
},
