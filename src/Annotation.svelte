<script>
  import config from './config.js'
  import {ann, geo2data} from './stores.js';

  export let period;
  export let col;
  export let moe;
  export let prefix;
  export let suffix;

  import comma from './helpers/comma.js';
</script>

<div class="w-100 tc h5" style="margin-top: -150px">
  <p class="f6 black-80"> {period} </p>
  {#if $ann}
    <p class="f4 mt0 mb1"> {$ann} </p>
    <p class="f3 mv0">
      {prefix}{$geo2data[$ann] ? comma($geo2data[$ann][col]) : ''}{suffix}
      {#if moe !== "false"}
        <span class="black-50"> &pm; {comma($geo2data[$ann][moe])} </span>
      {/if}
    </p>
  {/if}
</div>
