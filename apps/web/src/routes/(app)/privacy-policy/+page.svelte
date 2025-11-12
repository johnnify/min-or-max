<script lang="ts">
	import OutboundLink from '$lib/components/OutboundLink.svelte'
	import Heading3 from '$lib/components/typography/Heading3.svelte'
	import PageTitle from '$lib/components/typography/PageTitle.svelte'
	import Paragraph from '$lib/components/typography/Paragraph.svelte'
	import SectionTitle from '$lib/components/typography/SectionTitle.svelte'
</script>

<main class="container grow">
	<PageTitle class="mb-6 lg:mb-12 lg:text-6xl">Privacy Policy</PageTitle>

	<section class="prose prose-lg dark:prose-invert sm:prose-xl md:prose-2xl">
		<SectionTitle>Introduction</SectionTitle>

		<Paragraph>
			Your privacy is paramount to us here at <strong>Min or Max</strong>, and
			we are committed to protecting your personal data. This policy outlines
			how we collect and use information in connection with your use of the Min
			or Max app, including but not limited to anonymous website performance
			information.
		</Paragraph>

		<SectionTitle>Information We Collect</SectionTitle>

		<Paragraph>
			We do <strong>not</strong> collect any information! This is a free service,
			with no account creation and no personalised features.
		</Paragraph>

		<Heading3>Analytics and Performance Data</Heading3>

		<Paragraph>
			We may use Cloudflare Web Analytics to understand how visitors use our
			site and improve performance. This service collects anonymous performance
			metrics such as page load times and page views.
		</Paragraph>

		<Paragraph>
			Cloudflare Web Analytics does <strong>not</strong> use cookies or tracking
			technologies and does <strong>not</strong> collect personal information.
		</Paragraph>

		<SectionTitle>How We Use Your Information</SectionTitle>

		<Paragraph>
			Analytics data is processed based on our <strong
				>legitimate interest</strong
			>
			in understanding site performance and improving user experience. Since this
			data is anonymous and privacy-preserving, no additional consent is required.
		</Paragraph>

		<SectionTitle>Data Retention</SectionTitle>

		<Paragraph>
			Anonymous analytics data may be retained indefinitely for statistical
			purposes.
		</Paragraph>

		<SectionTitle>International Data Transfers</SectionTitle>

		<Paragraph>
			Min or Max uses Cloudflare's infrastructure, which may involve
			transferring your anonymous data to servers located outside your country,
			including the United States. Cloudflare implements appropriate safeguards
			such as Standard Contractual Clauses to protect your data during
			international transfers.
		</Paragraph>

		<SectionTitle>Cookies and Storage</SectionTitle>

		<Paragraph>
			We do not use tracking cookies or third-party advertising cookies.
		</Paragraph>

		<SectionTitle>Amendments to This Policy</SectionTitle>

		<Paragraph>
			We may update this privacy policy to reflect changes to our information
			practices. Refer to this page for its latest version.
		</Paragraph>

		<SectionTitle>Contact Information</SectionTitle>

		<Paragraph>
			For questions regarding these terms, please contact us at <OutboundLink
				href="https://discord.gg/sUpvwSdgjh"
				size="inline">Johnny’s Discord Community</OutboundLink
			>.
		</Paragraph>
	</section>
</main>
