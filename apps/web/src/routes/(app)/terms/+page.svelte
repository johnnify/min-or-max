<script lang="ts">
	import OutboundLink from '$lib/components/OutboundLink.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import Paragraph from '$lib/components/typography/Paragraph.svelte'
	import SectionTitle from '$lib/components/typography/SectionTitle.svelte'
</script>

<main class="container grow">
	<PageTitle class="mb-6 lg:mb-12 lg:text-6xl">Terms of Service</PageTitle>

	<section class="prose prose-lg dark:prose-invert sm:prose-xl md:prose-2xl">
		<SectionTitle>Introduction</SectionTitle>

		<Paragraph>
			Thank you for browsing <strong>Min or Max</strong>! These terms govern
			your access to and use of our content and functionality.
		</Paragraph>

		<SectionTitle>Prohibited Conduct</SectionTitle>

		<Paragraph>
			You agree not to misuse the Min or Max app or assist others in doing so.
			This includes avoiding any attempts to compromise the app's security or
			integrity.
		</Paragraph>

		<SectionTitle>Amendments to These Terms</SectionTitle>

		<Paragraph>
			We may update these terms to reflect changes in our services or legal
			obligations. Refer to this page for the latest version of these terms.
		</Paragraph>

		<SectionTitle>Contact Information</SectionTitle>

		<Paragraph>
			For questions regarding these terms, please contact us at <OutboundLink
				href="https://discord.gg/sUpvwSdgjh"
				>Johnny’s Discord Community</OutboundLink
			>.
		</Paragraph>
	</section>
</main>
