<script lang="ts">
	import {Button} from '$lib/components/ui/button'
	import * as Field from '$lib/components/ui/field'
	import * as InputOTP from '$lib/components/ui/input-otp'
	import {joinRoom} from './join.remote'

	const PLAYING_CARDS_REGEX_STRING = '^[2-9jJqQkKaA]+$'

	const inputId = 'room-code'
</script>

<form {...joinRoom}>
	<Field.Field>
		<Field.Label for={inputId}>Room code</Field.Label>
		<div class="flex flex-wrap items-center gap-4">
			<InputOTP.Root
				{inputId}
				name="code"
				minlength={6}
				maxlength={6}
				pattern={PLAYING_CARDS_REGEX_STRING}
				required
			>
				{#snippet children({cells})}
					<InputOTP.Group>
						{#each cells as cell (cell)}
							<InputOTP.Slot {cell} class="size-12 text-2xl" />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<Button class="max-w-72 grow">Join!</Button>
		</div>

		<Field.Description>Enter a room code to join!</Field.Description>
	</Field.Field>
</form>
