<script>
	export let time;
	export let id;
	export let censusTracts;
	export let col;

	import {onMount} from 'svelte'
	import jenks from './helpers/jenks.js'
	import tract2town from './helpers/tract2town.js'
	import comma from './helpers/comma.js'
	import colors from './helpers/colors.js'

	import {data, ann, jenksBreaks, geo2data, geojsonPath} from './stores.js'

	let map;
	let geojsonLayer;

	let getColor = function(val) {
		if (val === '-') {
			return '#cccccc'
		}

		if (val[val.length - 1] === '+') {
			return colors[4]
		}

		for (let i in $jenksBreaks) {
			if (i > 0) {
				if (val <= $jenksBreaks[i]) {
					return colors[i-1]
				}
			}
		}

		return '#cccccc';
	}

	const resizeMaps = function() {
		map.fitBounds(geojsonLayer.getBounds())
	}

	let initMap = async function() {
		map = L.map(id, {
			center: [41.33, -72.65],
			zoom: 9,
			zoomControl: false,
			scrollWheelZoom: false,
			attributionControl: false,
		});
		map.keyboard.disable()
		map.doubleClickZoom.disable()
		map.dragging.disable()
	}

	var reloadGeojson = async function() {
		const res = await fetch($geojsonPath)
		const json = await res.json()

		if (geojsonLayer) {
			map.removeLayer(geojsonLayer)
		}

		geojsonLayer = L.geoJson(json, {
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
		}).addTo(map)

		resizeMaps()

		geo2data.subscribe(g2d => {
			geojsonLayer.eachLayer(layer => {
				layer.setStyle({
					fillColor: getColor(g2d[layer.feature.properties.name][col]),
					fillOpacity: 1,
					color: 'white',
					weight: 1
				})
			})
		})

	}

	$: if ($geojsonPath && map) {
		reloadGeojson()
	}

	onMount(initMap)

	window.addEventListener('resize', resizeMaps);

</script>


<style>
	:global(.leaflet-container) {
		background-color: rgba(0,0,0,0) !important;
	}

	:global(.leaflet-interactive:hover) {
		fill-opacity: 0.5;
		color: green;
	}
</style>


<div id="{id}" class="w-100 h-100"></div>
