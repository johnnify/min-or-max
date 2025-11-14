# Min or Max Web

Web app for Min or Max, implemented with SvelteKit!

## Notable tech

- Meta framework: [SvelteKit](https://kit.svelte.dev/)
- Styling: [Tailwind](https://tailwindcss.com/) with [shadcn-svelte](https://github.com/huntabyte/shadcn-svelte) & [Unplugin Icons](https://github.com/unplugin/unplugin-icons) for the icons
- Browser tests: [Playwright](https://playwright.dev/)
- [TypeScript](https://www.typescriptlang.org/) for static type checking

## Local development

`cd` into the directory of this readme, and `pnpm i` & `pnpm dev` should get you there, so long as you've got Node setup!

### Install dependencies

```sh
pnpm i
```

Will install dependencies for everything in the monorepo!

### Environment variables

Only `.env.test` is committed to version control, so you should use that as a template to create your own `.env` & `.env.local`.

### Start dev server on watch mode

```sh
pnpm dev
```

Navigate to [localhost:5137](http://localhost:5173/) to see the web app.

## Automated tests

We have two categories of tests:

1. Browser tests with [Playwright](https://playwright.dev/)
2. Unit tests with [Vitest](https://vitest.dev/)

Playwright tests are in the e2e/integration level. Slower, but give us more confidence. Important spec should be covered there.

Vitest tests are on the integration/unit level. Faster, but do your best to avoid covering implementation details.

### Run e2e tests

With the dev servers running, OR with the `PUBLIC_ROOT_URL` environment variable set (to, for example, the production deployment), run:

```sh
pnpm run test
```

### Run unit tests

Anytime, run:

```sh
pnpm run test:unit
```
