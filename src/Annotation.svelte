<script>
  import config from './config.js'
  import {ann, geo2data} from './stores.js'
  import isNumeric from './helpers/isnumeric.js'

  export let period
  export let col
  export let moe
  export let prefix
  export let suffix

  // For the map on the right
  //export let colPrev
  export let positiveIncrease

  let color = 'black'
  let value = ''

  $: if ($geo2data[$ann]) {
    value = $geo2data[$ann][col]

    if (col == 'after') {
      let valueBefore = $geo2data[$ann]['before']
      if (isNumeric(valueBefore) && isNumeric(value)) {
        let change = value - valueBefore
        color = (change > 0 && positiveIncrease) || (change < 0 && !positiveIncrease) ? 'green' : 'red'
      } else {
        color = 'black'
      }
    }
    
  }
</script>

<div class="w-100 tc h5" style="margin-top: -150px">
  <p class="f6 black-80"> {period} </p>
  {#if $ann}
    <p class="f4 mt0 mb1"> {$ann} </p>
    <p class="f3 mv0">
      <span class="{color}">{prefix}{value.toLocaleString()}</span>{suffix}
      {#if moe}
        <span class="black-50"> &pm; {$geo2data[$ann][col + 'moe'].toLocaleString()} </span>
      {/if}
    </p>
  {/if}
</div>
