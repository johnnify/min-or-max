<script lang="ts">
	import {Button} from '$lib/components/ui/button'
	import * as Field from '$lib/components/ui/field'
	import * as InputOTP from '$lib/components/ui/input-otp'
	import {joinRoom} from './join.remote'

	const PLAYING_CARDS_REGEX_STRING = '^[2-9jJqQkKaA]+$'

	const inputId = 'room-code'
</script>

<form {...joinRoom} class="max-w-prose">
	<Field.Field>
		<Field.Label for={inputId}>Room code</Field.Label>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputOTP.Root
				{inputId}
				name="code"
				maxlength={6}
				pattern={PLAYING_CARDS_REGEX_STRING}
				required
			>
				{#snippet children({cells})}
					<InputOTP.Group>
						{#each cells as cell (cell)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<Button class="grow">Join!</Button>
		</div>

		<Field.Description>Enter a room code to join!</Field.Description>
	</Field.Field>
</form>
