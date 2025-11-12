<script lang="ts" module>
	export type FileWithPreview = {
		file: File
		preview: string | null
		error: string | null
	}
</script>

<script lang="ts">
	import CsvIcon from '~icons/hugeicons/csv-01'
	import CrossIcon from '~icons/material-symbols/close'
	import DocumentIcon from '~icons/material-symbols/description'

	import {cn} from '$lib/utils'
	import Button from '$lib/components/ui/button/button.svelte'

	type Props = {
		class?: string
		accept?: string
		onFileChange?: (file: FileWithPreview | null) => void
	}

	let {class: className, accept, onFileChange}: Props = $props()

	let file = $state<FileWithPreview | null>(null)
	let isDragActive = $state(false)
	let isDragReject = $state(false)
	let inputRef: HTMLInputElement | null = $state(null)

	const validateFile = (selectedFile: File): string | null => {
		if (accept) {
			const acceptedTypes = accept.split(',').map((type) => type.trim())
			const fileType = selectedFile.type
			const fileName = selectedFile.name
			const fileExtension = `.${fileName.split('.').pop()}`

			const isAccepted = acceptedTypes.some((acceptedType) => {
				if (acceptedType.startsWith('.')) {
					return fileExtension === acceptedType
				}
				if (acceptedType.endsWith('/*')) {
					return fileType.startsWith(acceptedType.replace('/*', ''))
				}
				return fileType === acceptedType
			})

			if (!isAccepted) {
				return 'File type not accepted'
			}
		}

		return null
	}

	const createFileWithPreview = (selectedFile: File): FileWithPreview => {
		const error = validateFile(selectedFile)
		let preview: string | null = null

		if (selectedFile.type.startsWith('image/')) {
			preview = URL.createObjectURL(selectedFile)
		}

		return {file: selectedFile, preview, error}
	}

	const handleFile = (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return

		// Clean up previous preview if it exists
		if (file?.preview) {
			URL.revokeObjectURL(file.preview)
		}

		// Only take the first file
		const selectedFile = fileList[0]
		if (selectedFile) {
			file = createFileWithPreview(selectedFile)
			onFileChange?.(file)
		}
	}

	const handleRemoveFile = () => {
		if (file?.preview) {
			URL.revokeObjectURL(file.preview)
		}
		file = null

		if (inputRef) {
			inputRef.value = ''
		}

		onFileChange?.(null)
	}

	const handleDragEnter = (e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		isDragActive = true
	}

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		isDragActive = true

		// Check if dragged items are files
		if (e.dataTransfer) {
			const hasFiles = Array.from(e.dataTransfer.items).some(
				(item) => item.kind === 'file',
			)
			isDragReject = !hasFiles
		}
	}

	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()

		// Only reset if we're leaving the dropzone entirely
		const target = e.currentTarget as HTMLElement
		const relatedTarget = e.relatedTarget as HTMLElement

		if (!target.contains(relatedTarget)) {
			isDragActive = false
			isDragReject = false
		}
	}

	const handleDrop = (e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		isDragActive = false
		isDragReject = false

		const droppedFiles = e.dataTransfer?.files ?? null
		handleFile(droppedFiles)
	}

	const handleInputChange = (e: Event) => {
		const input = e.target as HTMLInputElement
		handleFile(input.files)
	}

	const handleClick = () => {
		inputRef?.click()
	}

	const isInvalid = $derived((isDragActive && isDragReject) || !!file?.error)
</script>

<div
	class={cn(
		'bg-card text-card-foreground border-border min-h-40 place-content-center rounded-lg border p-6',
		className,
		file ? 'border-solid' : 'border-2 border-dashed',
		isDragActive && 'border-primary bg-primary/10',
		isInvalid && 'border-destructive bg-destructive/10',
	)}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="region"
>
	<input
		bind:this={inputRef}
		type="file"
		{accept}
		onchange={handleInputChange}
		class="hidden"
		aria-label="CSV file input"
	/>

	{#if !file}
		<!-- Empty State -->
		<div class="flex flex-col items-center gap-y-2 py-1">
			<CsvIcon class="text-muted-foreground mb-1 size-5" />
			<p class="drop-file-copy font-mono text-lg">Drop CSV file</p>
			<p class="text-muted-foreground text-xs">
				Drag and drop or <Button
					onclick={handleClick}
					variant="link"
					size="inline"
					type="button">select file</Button
				> to process
			</p>
		</div>
	{:else}
		<!-- File Display -->
		<div class="flex flex-col">
			<div
				class="border-border flex items-center gap-x-4 border-b py-2 first:mt-4 last:mb-4"
			>
				{#if file.file.type.startsWith('image/') && file.preview}
					<div
						class="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border"
					>
						<img src={file.preview} alt={file.file.name} class="object-cover" />
					</div>
				{:else if file.file.type.includes('csv')}
					<div
						class="bg-muted border-border flex h-10 w-10 items-center justify-center rounded border"
					>
						<CsvIcon />
					</div>
				{:else}
					<div
						class="bg-muted border-border flex h-10 w-10 items-center justify-center rounded border"
					>
						<DocumentIcon />
					</div>
				{/if}

				<div class="flex shrink grow flex-col items-start truncate">
					<p title={file.file.name} class="max-w-full truncate text-sm">
						{file.file.name}
					</p>
					{#if file.error}
						<p class="text-destructive text-xs">
							{file.error}
						</p>
					{/if}
				</div>

				<Button
					size="icon"
					variant="link"
					class="text-muted-foreground hover:text-foreground shrink-0 justify-self-end"
					onclick={handleRemoveFile}
					type="button"
					aria-label="Remove file {file.file.name}"
				>
					<CrossIcon />
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.drop-file-copy {
		font-variation-settings: 'SCAN' -10;
	}
</style>
