# Min or Max

![e2e](https://github.com/johnnify/min-or-max/actions/workflows/e2e.yaml/badge.svg)
![qa-web](https://github.com/johnnify/min-or-max/actions/workflows/qa-web.yaml/badge.svg)

Monorepo for Min or Max, a multiplayer card game where you lay low or play it **to the max**!

## Notable tech

- [pnpm](https://pnpm.io/) as the package manager
- [Mise](https://mise.jdx.dev/) for managing [Node](https://nodejs.org/en) versions
- [Turborepo](https://turborepo.com/) for efficient monorepo management

## Apps

- **Web App** ([apps/web/README.md](./apps/web/README.md)) - The core SvelteKit application

## Local development

`pnpm i` & `pnpm dev` will get you there,!

Make sure you have [pnpm](https://pnpm.io/) installed, and an appropriate version of Node. We recommend [Mise](https://mise.jdx.dev/), which will automatically switch to the Node version specified for this project and enable corepack to also bring in the appropriate version of pnpm, once you `cd` into the root directory.

### Run all dev servers on watch mode

```sh
pnpm dev
```

Navigate to [localhost:5137](http://localhost:5173/) to see the core web app.

Everything should **just work**!

... If not, make sure you've created your own `.env` / `.env.local` files, as described elsewhere in this README.

### Run all tests

**With the dev servers running**, run:

```sh
pnpm test
```

### Update all dependencies in all apps

To update all dependencies, including the `package.json` to point to their latest versions, run:

```sh
pnpm up -r --latest
```

This uses [native pnpm functionality](https://pnpm.io/cli/update)

### Other handy scripts

Refer to the [package.json](./package.json) for more scripts, namely linting & formatting.
