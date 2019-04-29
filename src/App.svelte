<script>
	import config from './config.js';

	import Map from './Map.svelte';


	let currentIndex = 0;
	let censusTracts = false;

	$: dp = config.data[parseInt(currentIndex)];
	$: downloadPath = 'data/' + dp.file;
	$: description = dp.description;
	$: time1 = dp.time1;
	$: time2 = dp.time2;

</script>

<div class="mw9 center ph3">
	<p class="f3 f2-ns mb0">{@html config.title}</p>
	<p class="f5 f3-ns mt1">{@html config.subtitle}</p>

	<select class="f6" bind:value={currentIndex}>
		{#each config.data as dp, i}
			<option value={i}>{dp.name}</option>
		{/each}
	</select>

	<p class="black-80 f6">
		Double-click on the map for zoom. <a href="{downloadPath}" class="link dim">Download dataset</a> powering this visualization.
	</p>

	<p>
		{@html description}
	</p>

</div>

<div class="mw9 center ph3" style="height: 600px;">
	<div class="fl w-50 h-100">
		<Map
			id="map-time1"
			time="{time1}"
			file="{downloadPath}"
			censusTracts="{censusTracts}"
		/>
	</div>
<!--
	<div class="fl w-50 h-100">
		<Map id="map-time2" time="{time2}" />
	</div> -->
</div>


<footer class="w-100 center tc ph3 f6 mt5 pv5 black-80 bg-lightest-blue">
	{@html config.footer}
</footer>
