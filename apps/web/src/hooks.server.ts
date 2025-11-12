import type {Handle} from '@sveltejs/kit'
import {sequence} from '@sveltejs/kit/hooks'

import {preloadHandle} from './hooks/preloadHandle'

export const handle: Handle = sequence(preloadHandle)
