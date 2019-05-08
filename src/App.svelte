<script>
	import config from './config.js'
	import {data, jenksBreaks, geo2data, showChange, geojsonPath} from './stores.js'

	import Map from './Map.svelte'
	import Legend from './Legend.svelte'
	import Annotation from './Annotation.svelte'
	import Papa from './helpers/papaparse.min.js'
	import jenks from './helpers/jenks.js'

	let currentIndex = 0
	let censusTracts = false
	
	geojsonPath.update(x => './geo/towns.geojson')

	function handleCensusTracts() {
		geojsonPath.update(x => censusTracts ? './geo/tracts.geojson' : './geo/towns.geojson')
	}

	function handleShowChange() {
		showChange.update(x => !x)
	}

	$: dp = config.data[parseInt(currentIndex)]
	$: downloadPath = 'data/' + dp.file
	$: description = dp.description
	$: col1 = dp.col1
	$: col2 = dp.col2
	$: time1 = dp.time1
	$: time2 = dp.time2
	$: moe1 = dp.moe1
	$: moe2 = dp.moe2
	$: prefix = dp.prefix
	$: suffix = dp.suffix
	$: posChange = dp.change == 'positive' ? true : false

	$: {
		fetch(downloadPath)
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
					parsedAsObj[parsed[i].Geography] = parsed[i];
				}

				let values1 = parsed.map(x => parseFloat(x[col1]) || 0);
				let values2 = parsed.map(x => parseFloat(x[col2]) || 0);

				jenksBreaks.update(x => jenks(values1.concat(values2), 5));
				geo2data.update(x => parsedAsObj);
				data.update(d => parsed);
			});
	}

</script>

<div class="mw9 center ph3">
	<p class="f3 f2-ns mb0">{@html config.title}</p>
	<p class="f5 f3-ns mt1">{@html config.subtitle}</p>

	<div class="pa3 bg-black-10">
		<select class="f6" bind:value={currentIndex}>
			{#each config.data as dp, i}
				<option value={i}>{dp.name}</option>
			{/each}
		</select>

		<label class="ml4">
			<input type="checkbox" name="checkbox1" bind:checked={censusTracts} on:change={handleCensusTracts}> Census Tracts
		</label>

		<label class="ml4">
			<input type="checkbox" name="checkbox2" on:change={handleShowChange}> Show Change
		</label>
	</div>

	<p class="black-80 f6">
		Double-click on the map for zoom. <a href="{downloadPath}" class="link dim">Download dataset</a> powering this visualization.
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


<div class="mw9 center ph3" style="height: 600px;">
	<div class="fl w-50 h-100">
		<Map
			id="map-time1"
			time="{time1}"
			col="{col1}"
			censusTracts="{censusTracts}"
		/>
	</div>
	<div class="fl w-50 h-100">
		<Map
			id="map-time2"
			time="{time2}"
			col="{col2}"
			prevCol="{col1}"
			posChange="{posChange}"
			censusTracts="{censusTracts}"
		/>
	</div>
</div>


<div class="mw9 center ph3 mb5 h3">
	<div class="fl w-50">
		<Annotation
			period="{time1}"
			col="{col1}"
			moe="{moe1}"
			prefix="{prefix}"
			suffix="{suffix}"
		/>
	</div>
	<div class="fl w-50">
		<Annotation
			period="{time2}"
			col="{col2}"
			moe="{moe2}"
			prefix="{prefix}"
			suffix="{suffix}"
			posChange="{posChange}"
			colPrev="{col1}"
		/>
	</div>
</div>


<footer class="w-100 center tc ph3 f6 mt5 pv5 black-80 bg-lightest-blue">
	{@html config.footer}
</footer>
