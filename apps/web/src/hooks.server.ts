import type {Handle} from '@sveltejs/kit'
import {sequence} from '@sveltejs/kit/hooks'

import {preloadHandle} from './hooks/preloadHandle'
import {authHandle} from './hooks/authHandle'

export const handle: Handle = sequence(authHandle, preloadHandle)
