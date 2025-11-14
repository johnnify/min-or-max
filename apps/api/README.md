# Min or Max API

Cloudflare Workers for multiplayer game management.

## Notable tech

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Scheduling**: [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- **Type checking**: [TypeScript](https://www.typescriptlang.org/)

## Local development

`cd` into the directory of this readme, and `pnpm dev` will start the Wrangler dev server.

### Install dependencies

```sh
pnpm i
```

Will install dependencies for everything in the monorepo!

### Environment variables

Only `.env.test` is committed to version control, so you should use that as a template to create your own `.env` & `.env.local`.

### Start dev server

```sh
pnpm dev
```
