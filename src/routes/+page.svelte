<script>
  import { STATUS_LABELS } from '$lib/labels.js';
  import { yuan, shortTime } from '$lib/format.js';

  let { data } = $props();

  const chips = [
    ['all', '全部'],
    ['pending', '待修'],
    ['repairing', '在修'],
    ['ready', '待取件'],
    ['delivered', '已交车'],
    ['void', '已作废']
  ];
</script>

<h1>维修工单</h1>

{#if data.overdueCount > 0}
  <div class="banner warn">
    ⚠️ 保管区有 <strong>{data.overdueCount}</strong> 件旧件超过 14 天未处理，进待处置了 —
    <a href="/storage">去旧件保管区处理</a>
  </div>
{/if}

<div class="filter-chips">
  {#each chips as [key, label]}
    <a href="/?status={key}" class:active={data.filter === key}>
      {label}{#if key !== 'all'}（{data.counts[key]}）{/if}
    </a>
  {/each}
  <a href="/orders/new" style="margin-left:auto; border-color: var(--accent); color: var(--accent);">＋ 接车建单</a>
</div>

<div class="card" style="padding: 0;">
  <table>
    <thead>
      <tr>
        <th>单号</th><th>车架号后六位</th><th>品牌</th><th>故障描述</th>
        <th class="num">预估工费(元)</th><th>状态</th><th>预计完工</th><th>接车时间</th>
      </tr>
    </thead>
    <tbody>
      {#each data.orders as o}
        <tr>
          <td><a href="/orders/{o.id}">{o.order_no}</a></td>
          <td>{o.frame_tail}</td>
          <td>{o.brand}</td>
          <td>{o.fault_desc}</td>
          <td class="num">{yuan(o.labor_cents)}</td>
          <td><span class="tag {o.status}">{STATUS_LABELS[o.status]}</span></td>
          <td>{shortTime(o.expect_done_at)}</td>
          <td class="muted">{shortTime(o.created_at)}</td>
        </tr>
      {:else}
        <tr><td colspan="8" class="muted" style="text-align:center; padding: 24px;">这个状态下没有工单</td></tr>
      {/each}
    </tbody>
  </table>
</div>
