<script>
  import { yuan } from '$lib/format.js';
  let { data, form } = $props();
</script>

<h1>配件库存</h1>

{#if form?.error}
  <div class="banner error">⛔ {form.error}</div>
{/if}

<div class="card" style="padding: 0;">
  <table>
    <thead>
      <tr><th>配件</th><th>单位</th><th class="num">现存</th><th class="num">单位成本(元)</th><th>入库</th></tr>
    </thead>
    <tbody>
      {#each data.items as item}
        <tr>
          <td>{item.name}</td>
          <td>{item.unit}</td>
          <td class="num">{item.stock}</td>
          <td class="num">{yuan(item.cost_cents)}</td>
          <td>
            <form method="POST" action="?/restock" class="inline-form">
              <input type="hidden" name="inventory_id" value={item.id} />
              <input type="number" name="qty" value="1" min="1" />
              <button class="btn small secondary" type="submit">入库</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<div class="card">
  <h2 style="margin-top:0;">新增配件</h2>
  <form method="POST" action="?/addItem" class="inline-form">
    <input type="text" name="name" placeholder="配件名称（必填）" required />
    <input type="text" name="unit" placeholder="单位" value="个" style="width:70px;" />
    <input type="number" name="stock" placeholder="初始库存" value="0" min="0" />
    <input type="text" name="cost" placeholder="单位成本(元)" inputmode="decimal" style="width:120px;" />
    <button class="btn small" type="submit">新增</button>
  </form>
  <p class="muted" style="font-size:13px;">工单上领用配件会自动扣减这里的库存，不够扣会被拦下，不会扣成负数。</p>
</div>
