<script lang="ts">
	import {Button} from '$lib/components/ui/button'
	import {quickplay} from './join.remote'
</script>

<form {...quickplay}>
	<Button class="w-full" size="lg">Quick Play</Button>
</form>
