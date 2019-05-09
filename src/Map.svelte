<script>
	export let id
	export let time
	export let col
	export let extraGeography
	export let positiveIncrease

	import {onMount} from 'svelte'
	import jenks from './helpers/jenks.js'
	import comma from './helpers/comma.js'
	import {colorsJenks, colorsChange} from './helpers/colors.js'
	import isNumeric from './helpers/isnumeric.js'
	import config from './config.js'

	import {showChange, data, ann, jenksBreaks, geo2data, geojsonPath} from './stores.js'

	let map
	let geojsonLayer

	let getColor = function(geo) {
		if (!geo) return '#cccccc'

		let val = geo[col]
		let colors = colorsJenks
		let breaks = $jenksBreaks

		if ($showChange && col == 'after') {
			let valBefore = geo['before']
			if (isNumeric(valBefore) && isNumeric(val)) {
				let change = (val - valBefore) / valBefore * 100
				val = change
				breaks = [-100, -10, -5, 0, 5, 10, 100]
				colors = colorsChange
			} else {
				return '#cccccc'
			}
		}

		if (val === '-') {
			return '#cccccc'
		}

		if (val[val.length - 1] === '+') {
			return colors[4]
		}

		for (let i in breaks) {
			if (i > 0) {
				if (val <= breaks[i]) {
					return colors[i-1]
				}
			}
		}

		return '#cccccc'
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
						ann.update(x => e.target.feature.properties[config.geojsonGeographyProperty])
					},
					mouseout: function(e) {
						ann.update(x => '')
					}
				})
			},
		}).addTo(map)

		resizeMaps()

		geo2data.subscribe(g2d => {

			if (id == 'map-after') {
				showChange.subscribe(val => {
					geojsonLayer.eachLayer(layer => {
						layer.setStyle({
							fillColor: getColor(g2d[layer.feature.properties[config.geojsonGeographyProperty]]),
							fillOpacity: 1,
							color: 'white',
							weight: 1
						})
					})
				})
			}

			geojsonLayer.eachLayer(layer => {
				layer.setStyle({
					fillColor: getColor(g2d[layer.feature.properties[config.geojsonGeographyProperty]]),
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

	window.addEventListener('resize', resizeMaps)

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
