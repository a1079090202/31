<script>
  import { yuan, shortTime } from '$lib/format.js';
  let { data } = $props();
  const s = data.summary;
</script>

<h1>月度维修汇总</h1>

<div class="card">
  <form method="GET" class="inline-form">
    <label for="month">月份：</label>
    <input type="month" id="month" name="month" value={data.month} />
    <button class="btn small" type="submit">查询</button>
    <a class="btn secondary small" href="/reports/summary.csv?month={data.month}" download>导出 CSV</a>
  </form>
  {#if data.months.length > 0}
    <p class="muted" style="font-size:13px; margin-bottom:0;">
      有交车记录的月份：{#each data.months as m, i}<a href="/reports?month={m}">{m}</a>{i < data.months.length - 1 ? '、' : ''}{/each}
    </p>
  {/if}
</div>

<div class="card" style="padding: 0;">
  <table>
    <thead>
      <tr>
        <th>单号</th><th>车架号后六位</th><th>品牌</th><th>故障描述</th>
        <th class="num">工费(元)</th><th class="num">配件成本(元)</th><th class="num">毛利(元)</th><th>交车时间</th>
      </tr>
    </thead>
    <tbody>
      {#each s.rows as r}
        <tr>
          <td><a href="/orders/{r.id}">{r.order_no}</a></td>
          <td>{r.frame_tail}</td>
          <td>{r.brand}</td>
          <td>{r.fault_desc}</td>
          <td class="num">{yuan(r.labor_cents)}</td>
          <td class="num">{yuan(r.parts_cost_cents)}</td>
          <td class="num">{yuan(r.gross_cents)}</td>
          <td class="muted">{shortTime(r.delivered_at)}</td>
        </tr>
      {:else}
        <tr><td colspan="8" class="muted" style="text-align:center; padding: 24px;">{data.month} 没有已交车的工单</td></tr>
      {/each}
    </tbody>
    {#if s.count > 0}
      <tfoot>
        <tr style="font-weight:700;">
          <td colspan="4">合计（{s.count} 台）</td>
          <td class="num">{yuan(s.totals.labor_cents)}</td>
          <td class="num">{yuan(s.totals.parts_cost_cents)}</td>
          <td class="num">{yuan(s.totals.gross_cents)}</td>
          <td></td>
        </tr>
      </tfoot>
    {/if}
  </table>
</div>

<p class="muted" style="font-size:13px;">
  口径：按交车时间归集已交车的工单；毛利 = 工费 − 配件成本；配件成本只算店里库存领用的（客户自带件成本为 0）。金额全程以分计算，可拿计算器逐笔核对。
</p>
