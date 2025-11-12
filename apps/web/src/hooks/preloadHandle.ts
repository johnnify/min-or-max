import type {Handle} from '@sveltejs/kit'

const preloadTypes = ['js', 'css', 'font']

export const preloadHandle: Handle = async ({event, resolve}) =>
	resolve(event, {
		preload: ({type}) => preloadTypes.includes(type),
	})
