import 'unplugin-icons/types/svelte'

import type {CloudflareUsersRepo} from '$lib/repos/users/CloudflareUsersRepo'
import type {Session, UserRole} from '$lib/repos/users/UsersRepoInterface'
import type {Rng} from '$lib/Rng'

declare global {
	// fresh API just dropped, let's extend Document
	interface Document {
		startViewTransition?(callback: () => Promise<void>): void
	}

	interface Window {
		toggleTheme?(): void
	}

	// for enhanced images with query params such as w=64
	// https://kit.svelte.dev/docs/images#sveltejs-enhanced-img
	declare module '*&enhanced'

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
