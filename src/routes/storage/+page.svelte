<script>
  import { DISPOSITION_LABELS, OLD_PART_STATUS_LABELS } from '$lib/labels.js';
  import { shortTime } from '$lib/format.js';

  let { data, form } = $props();
  const overdue = data.keeping.filter((p) => p.overdue);
  const inKeep = data.keeping.filter((p) => !p.overdue);
</script>

<h1>旧件保管区</h1>

{#if form?.error}
  <div class="banner error">⛔ {form.error}</div>
{/if}

{#if overdue.length > 0}
  <div class="banner warn">
    ⚠️ 以下 {overdue.length} 件旧件已超过 14 天保管期未处理，请尽快处置（退还客户 / 报废 / 转可用库存）。
  </div>
{/if}

{#snippet partTable(rows)}
  <div class="card" style="padding: 0;">
    <table>
      <thead>
        <tr>
          <th>旧件</th><th>来自工单</th><th>进区时间</th><th>保管期满</th><th>处理去向</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as p}
          <tr class:overdue-row={p.overdue}>
            <td>{p.name}{#if p.note}<br /><span class="muted">{p.note}</span>{/if}</td>
            <td><a href="/orders/{p.order_id}">{p.order_no}</a><br /><span class="muted">{p.brand} · {p.frame_tail}</span></td>
            <td>{shortTime(p.kept_at)}</td>
            <td>{shortTime(p.due_at)}{#if p.overdue} <span class="tag void">已超期</span>{/if}</td>
            <td>
              <form method="POST" action="?/dispose" class="inline-form">
                <input type="hidden" name="old_part_id" value={p.id} />
                <select name="disposition">
                  <option value="return_customer">退还客户</option>
                  <option value="scrap">报废</option>
                  <option value="to_inventory">转可用库存</option>
                </select>
                <input type="text" name="qc_note" placeholder="转可用必填质检备注" />
                <input type="text" name="operator" placeholder="经手人" required />
                <button class="btn small" type="submit">处理</button>
              </form>
            </td>
          </tr>
        {:else}
          <tr><td colspan="5" class="muted" style="text-align:center; padding: 18px;">没有旧件</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

<h2>待处置（超 14 天）</h2>
{@render partTable(overdue)}

<h2>保管中（14 天保管期内）</h2>
{@render partTable(inKeep)}

<h2>处理记录</h2>
<div class="card" style="padding: 0;">
  <table>
    <thead>
      <tr><th>旧件</th><th>来自工单</th><th>去向</th><th>质检备注</th><th>经手人</th><th>处理时间</th></tr>
    </thead>
    <tbody>
      {#each data.disposed as p}
        <tr>
          <td>{p.name}</td>
          <td><a href="/orders/{p.order_id}">{p.order_no}</a></td>
          <td>{DISPOSITION_LABELS[p.disposition] ?? OLD_PART_STATUS_LABELS[p.status]}</td>
          <td class="muted">{p.qc_note ?? ''}</td>
          <td>{p.operator}</td>
          <td class="muted">{shortTime(p.disposed_at)}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="muted" style="text-align:center; padding: 18px;">还没有处理记录</td></tr>
      {/each}
    </tbody>
  </table>
</div>
