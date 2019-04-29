<script>
	export let time;
	export let id;
	export let censusTracts;
	export let file;

	import {onMount} from 'svelte';
	import jenks from './helpers/jenks.js';
	import tract2town from './helpers/tract2town.js';
	import comma from './helpers/comma.js';
	import Papa from './helpers/papaparse.min.js';

	let data;

	Papa.parse(file, {
		download: true,
		complete: function(d) {
			data = d;
		}
	});

	let style = function() {
		
	}

	style()

	onMount(async () => {
		var map = L.map(id, {
			center: [41.33, -72.65],
			zoom: 8,
			zoomControl: false,
			scrollWheelZoom: false,
			attributionControl: false,
		});
		map.keyboard.disable();
		map.doubleClickZoom.disable();

		fetch('./geo/towns.geojson').then(response => {
		  response.json().then(json => {
		    let geojson = json;

				let geojsonLayer = L.geoJson(geojson, {
					//style: geojsonVisible,
					//onEachFeature: onEachFeature,
				}).addTo(map);

		  });
		});

	});


</script>

<style>
	:global(.leaflet-container) {
		background-color: white !important;
	}
</style>

<p class="f5 tc">{time}</p>

<div id="{id}" class="w-100 h-100"></div>
