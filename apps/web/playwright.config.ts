import {defineConfig, devices, type Project} from '@playwright/test'

/* Configure projects for major browsers */
const projects: Project[] = [
	{
		name: 'chromium',
		use: {...devices['Desktop Chrome']},
		testIgnore: /.*mobile.spec.ts/,
	},

	{
		name: 'firefox',
		use: {...devices['Desktop Firefox']},
		testIgnore: /.*mobile.spec.ts/,
	},

	{
		name: 'Mobile Safari',
		use: {
			...devices['iPhone 15 Pro'],
			contextOptions: {reducedMotion: 'reduce'},
		},
		testIgnore: /.*desktop.spec.ts/,
	},
	// {
	// 	name: 'webkit',
	// 	use: {...devices['Desktop Safari']},
	// },

	/* Test against mobile viewports. */
	// {
	//   name: 'Mobile Chrome',
	//   use: { ...devices['Pixel 5'] },
	// },

	/* Test against branded browsers. */
	// {
	//   name: 'Microsoft Edge',
	//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
	// },
	// {
	//   name: 'Google Chrome',
	//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
	// },
]

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests',
	/* Lower timeout for BDD */
	timeout: process.env.CI ? 60_000 : 10_000,
	/* Do not fully parallelise tests in CI */
	fullyParallel: !process.env.CI,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry more on CI */
	retries: process.env.CI ? 4 : 1,
	/* Limit the number of workers on CI, use default locally */
	workers: process.env.CI ? 3 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	// reporter: 'html',
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		/* Point it to a deployment, to run tests against it! */
		baseURL: process.env.PUBLIC_ROOT_URL || 'http://localhost:5173',

		launchOptions: {
			slowMo: parseInt(process.env.SLOW_MO || '0'),
		},

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		video: process.env.VIDEO ? 'on' : 'retain-on-failure',
	},

	projects,

	/* Run your local dev server before starting the tests */
	webServer: !process.env.PUBLIC_ROOT_URL
		? {
				command: 'pnpm preview',
				port: 5173,
				reuseExistingServer: true,
			}
		: undefined,
})
