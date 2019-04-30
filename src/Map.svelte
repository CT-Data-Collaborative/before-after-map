<script>
	export let time;
	export let id;
	export let censusTracts;
	export let col;

	import {onMount} from 'svelte';
	import jenks from './helpers/jenks.js';
	import tract2town from './helpers/tract2town.js';
	import comma from './helpers/comma.js';
	import colors from './helpers/colors.js';

	import {data, ann, jenksBreaks, geo2data} from './stores.js';

	let map;
	let geojsonLayer;

	let getColor = function(val) {
		for (let i in $jenksBreaks) {
			if (val <= $jenksBreaks[i]) {
				return colors[i];
			}
		}
		return false;
	}

	const resizeMaps = function() {
		map.fitBounds(geojsonLayer.getBounds());
	}

	onMount(async () => {
		map = L.map(id, {
			center: [41.33, -72.65],
			zoom: 9,
			zoomControl: false,
			scrollWheelZoom: false,
			attributionControl: false,
		});
		map.keyboard.disable();
		map.doubleClickZoom.disable();
		map.dragging.disable();

		fetch('./geo/towns.geojson').then(response => {
		  response.json().then(json => {
		    let geojson = json;

				geojsonLayer = L.geoJson(geojson, {
					onEachFeature: function(f, l) {
						l.on({
							mouseover: function(e) {
								ann.update(x => e.target.feature.properties.name)

							},
							mouseout: function(e) {
								ann.update(x => '')
							}
						})
					},
				}).addTo(map);

				resizeMaps();

				geo2data.subscribe(g2d => {
					geojsonLayer.eachLayer(layer => {
						layer.setStyle({
							fillColor: getColor(g2d[layer.feature.properties.name][col]),
							fillOpacity: 1,
							color: 'white',
							weight: 1
						})
					});
				});

		  });
		});

	});

	window.addEventListener('resize', resizeMaps);

</script>


<style>
	:global(.leaflet-container) {
		background-color: white !important;
	}

	:global(.leaflet-interactive:hover) {
		fill-opacity: 0.5;
		color: green;
	}
</style>


<div id="{id}" class="w-100 h-100"></div>
