<script>
	import config from './config.js'
	import {data, jenksBreaks, geo2data, showChange, geojsonPath} from './stores.js'

	import Map from './Map.svelte'
	import Legend from './Legend.svelte'
	import Annotation from './Annotation.svelte'
	import Papa from './helpers/papaparse.min.js'
	import jenks from './helpers/jenks.js'

	let currentIndex = 0
	let extraGeography = false
	
	geojsonPath.update(x => config.defaultGeographyPath)

	function handleExtraGeography() {
		geojsonPath.update(x => extraGeography ? config.extraGeographyPath : config.defaultGeographyPath)
	}

	function handleShowChange() {
		showChange.update(x => !x)
	}

	$: dp = config.data[parseInt(currentIndex)]
	$: description = dp.description
	$: before = dp.before
	$: after = dp.after
	$: beforemoe = dp.beforemoe
	$: aftermoe = dp.aftermoe
	$: prefix = dp.prefix
	$: suffix = dp.suffix
	$: positiveIncrease = dp.positiveIncrease

	$: {
		fetch(dp.file)
			.then(function(res) {
				return res.text();
			})
			.then(function(csv_str) {
				let parsed = Papa.parse(csv_str, {
					header: true,
					dynamicTyping: true
				}).data;

				let parsedAsObj = {}
				for (let i in parsed) {
					parsedAsObj[parsed[i].geography] = parsed[i];
				}

				let valuesBefore = parsed.map(x => parseFloat(x['before']) || 0);
				let valuesAfter = parsed.map(x => parseFloat(x['after']) || 0);

				jenksBreaks.update(x => jenks(valuesBefore.concat(valuesAfter), 5));
				geo2data.update(x => parsedAsObj);
				data.update(d => parsed);
			});
	}

</script>

<div class="mw9 center ph3">
	<p class="f3 f2-ns mb0">{@html config.title}</p>
	<p class="f5 f3-ns mt1">{@html config.subtitle}</p>

	<form class="boilerform pa3 bg-black-10">
		<select class="f6" bind:value={currentIndex}>
			{#each config.data as dp, i}
				<option value={i}>{dp.name}</option>
			{/each}
		</select>

		<label class="ml4">
			<input type="checkbox" name="checkbox1" bind:checked={extraGeography} on:change={handleExtraGeography}> {config.extraGeographyName}
		</label>

		<label class="ml4">
			<input type="checkbox" name="checkbox2" on:change={handleShowChange}> Show Change
		</label>
	</form>

	<p class="black-80 f6">
		<a href="{dp.file}" class="link dim">Download dataset</a> powering this visualization.
	</p>

	<p class="f6 lh-title">
		{@html description}
	</p>

	<div class="mw8 h3">
		<Legend
			prefix="{prefix}"
			suffix="{suffix}"
		/>
	</div>

</div>


<div class="mw9 center ph3 cf" style="height: 600px;">
	<div class="fl w-50 h-100">
		<Map
			id="map-before"
			time="{before}"
			col="before"
			extraGeography="{extraGeography}"
		/>
	</div>
	<div class="fl w-50 h-100">
		<Map
			id="map-after"
			time="{after}"
			col="after"
			positiveIncrease="{positiveIncrease}"
			extraGeography="{extraGeography}"
		/>
	</div>
</div>


<div class="mw9 center ph3 mb5 h3">
	<div class="fl w-50">
		<Annotation
			col="before"
			period="{before}"
			moe="{beforemoe}"
			prefix="{prefix}"
			suffix="{suffix}"
		/>
	</div>
	<div class="fl w-50">
		<Annotation
			col="after"
			period="{after}"
			moe="{aftermoe}"
			prefix="{prefix}"
			suffix="{suffix}"
			positiveIncrease="{positiveIncrease}"
		/>
	</div>
</div>


<footer class="w-100 center tc ph3 f6 mt5 pv5 black-80 bg-lightest-blue">
	{@html config.footer}
</footer>
