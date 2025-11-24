<script lang="ts">
	import AceCardIcon from '~icons/game-icons/card-ace-hearts'
	import JackCardIcon from '~icons/game-icons/card-jack-hearts'
	import QueenCardIcon from '~icons/game-icons/card-queen-hearts'
	import KingCardIcon from '~icons/game-icons/card-king-hearts'
	import Paragraph from '../typography/Paragraph.svelte'
	import SectionTitle from '../typography/SectionTitle.svelte'
</script>

<section class="max-w-prose">
	<SectionTitle>How to play</SectionTitle>

	<Paragraph>
		Min or Max is a <strong>card game</strong> you can play at home with a single,
		standard, deck of cards!
	</Paragraph>

	<Paragraph>
		The most important rule of all, is to have fun! So don’t sweat it too much,
		and let the heart of the cards guide you.
	</Paragraph>

	<Paragraph>
		Two or more players take turns trying to take the total score <strong
			class="uppercase">to the max</strong
		>! Watch out, if you go over the threshold, you <strong>bust</strong> and lose
		the round!
	</Paragraph>
	<Paragraph>
		The defining features of Min or Max are <strong>the wheel</strong> which you
		could replace with a coin flip, and <strong>the special rules</strong> for
		the face cards <JackCardIcon class="inline-block size-8" /><QueenCardIcon
			class="inline-block size-8"
		/><KingCardIcon class="inline-block size-8" />.
	</Paragraph>

	<ul class="my-6 ms-6 list-disc [&>li]:mt-2">
		<li>At the start of the game, each player draws 3 cards</li>
		<li>A threshold number, like <strong>42</strong> is set</li>
		<li>A card is dealt straight on the game board</li>
		<li>We keep track of the running <strong>tally</strong> for you!</li>
		<li>Whenever a card is dealt, its value gets added to the tally</li>
		<li>
			The value of number cards, is their number! For example, the 7 of hearts
			would add <strong>+7</strong> to the tally.
		</li>
		<li>
			The value of each face card <JackCardIcon
				class="inline-block size-8"
			/><QueenCardIcon class="inline-block size-8" /><KingCardIcon
				class="inline-block size-8"
			/> is <strong>10</strong>! Play a Queen of Diamonds would add
			<strong>+10</strong> to the tally.
		</li>
		<li>
			An Ace <AceCardIcon class="inline-block size-8" /> is
			<strong>flexible</strong>: It’s worth either +1 or +11 points!
		</li>
		<li>On your turn, you MUST draw one more card!</li>
		<li>On your turn, you MAY play a single card from your hand</li>
		<li>On your turn, you MAY <strong>spin the wheel</strong> once</li>
		<li>
			The wheel defines whether you are allowed to play an equal or higher card,
			or an equal or lower card!
		</li>
		<li>
			In other words, you have to <strong>beat</strong> the top card on the board
			according to the wheel.
		</li>
		<li>
			During <strong>mode max</strong>, you have to play an equal or higher
			card.
		</li>
		<li>
			If the card to beat is a <strong>5</strong>, you could play a 7 to beat
			it. You would not be able to play a 3.
		</li>
		<li>
			During <strong>mode min</strong>, you have to play an equal or lower card.
		</li>
		<li>
			If the card to beat is a <strong>4</strong>, you could play a
			<strong>2</strong> to beat it. You would not be able to play a 6.
		</li>
		<li>
			An Ace <AceCardIcon class="inline-block size-8" /> is
			<strong>flexible</strong>, so you can play it to
			<strong>beat any card</strong>, regardless if you decide to score it as a
			1 or 11!
		</li>
		<li>When you play a card, add it to the <strong>tally</strong>.</li>
		<li>
			If the tally has now matched the <strong>exact threshold</strong>,
			congrats, you win <strong class="uppercase">to the max</strong>!
		</li>
		<li>
			If the tally has now <strong>exceeded the threshold</strong>, you
			<strong>bust</strong> and lose the round! Oh no!
		</li>
		<li>If the tally is under the threshold, play continues as normal.</li>
		<li>You MUST end your turn to proceed to the next player</li>
	</ul>

	<SectionTitle>Special Cards</SectionTitle>

	<Paragraph>
		Some cards have special abilities! Besides adding their value to the tally,
		they also have a special effect requiring your choice...
	</Paragraph>
	<ul class="my-6 ms-6 list-disc [&>li]:mt-2">
		<li>
			Playing a <JackCardIcon class="inline-block size-8" /> has the
			<strong>courtship effect</strong>: Choose the type of face card you’d like
			to attempt to find, if it’s still on the draw pile, you draw it to your
			hand!
		</li>
		<li>
			Playing a <QueenCardIcon class="inline-block size-8" /> has the
			<strong>slay effect</strong>: See your opponents’ cards, and choose one to
			<strong>SLAY</strong>. It gets removed from play!
		</li>
		<li>
			Playing a <KingCardIcon class="inline-block size-8" /> has the
			<strong>enlist effect</strong>: Without seeing your opponents’ cards,
			choose one to
			<strong>ENLIST</strong>. It’s now yours!
		</li>
	</ul>
</section>
