<script>
import {jenksBreaks} from './stores.js';
import comma from './helpers/comma.js';
import colors from './helpers/colors.js';
</script>

<div class="w-100">
  {#each colors as color, i}
    <div class="fl {i < 4 ? 'tr' : 'tl white'} w-20 pv1 ph2 f6" style="background-color:{color}"> {comma($jenksBreaks[i+1])} </div>
  {/each}
</div>
