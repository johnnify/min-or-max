<script lang="ts">
	import type {AlertDialog as BitsUiDialog} from 'bits-ui'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'

	type Props = BitsUiDialog.RootProps

	let {open = $bindable(false), children, ...restProps}: Props = $props()
</script>

<AlertDialog.Root bind:open {...restProps}>
	<AlertDialog.Content escapeKeydownBehavior="ignore">
		<AlertDialog.Header>
			<AlertDialog.Title>Make your choice!</AlertDialog.Title>
		</AlertDialog.Header>
		{@render children?.()}
	</AlertDialog.Content>
</AlertDialog.Root>
