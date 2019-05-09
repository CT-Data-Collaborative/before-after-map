<script>
  import {jenksBreaks} from './stores.js'
  import {colorsJenks} from './helpers/colors.js'
  import comma from './helpers/comma.js'

  export let prefix
  export let suffix
</script>

<div class="w-100">
  {#each colorsJenks as color, i}
    <div class="fl {i < 4 ? 'tr' : 'tl white'} w-20 pv1 ph2 f6" style="background-color:{color}">
      {@html i == 0 ? '&leq;' : ''}
      {i != 4 ? prefix + ($jenksBreaks[i + 1] ? comma($jenksBreaks[i + 1]) : '') + suffix : ''}
      {i == 4 ? prefix + comma($jenksBreaks[i] + 1) + suffix + '+' : ''}
    </div>
  {/each}
</div>
