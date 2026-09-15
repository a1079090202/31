<script>
  import { STATUS_LABELS, SOURCE_LABELS, DISPOSITION_LABELS, OLD_PART_STATUS_LABELS } from '$lib/labels.js';
  import { yuan, shortTime } from '$lib/format.js';

  let { data, form } = $props();
  const o = data.order;
  const dtLocal = (s) => s.replace(' ', 'T').slice(0, 16);
</script>

<h1>
  工单 {o.order_no}
  <span class="tag {o.status}">{STATUS_LABELS[o.status]}</span>
</h1>

{#if form?.error}
  <div class="banner error">⛔ {form.error}</div>
{/if}

{#if o.status === 'delivered'}
  <div class="banner info">本单已于 {shortTime(o.delivered_at)} 交车，内容已锁定，不能再修改。</div>
{:else if o.status === 'void'}
  <div class="banner error">
    本单已作废 — 原因：{o.void_reason}；经手人：{o.void_operator}；时间：{shortTime(o.voided_at)}
  </div>
{/if}

<div class="card">
  <div class="row-actions" style="justify-content: space-between;">
    <div class="row-actions">
      {#if data.next}
        <form method="POST" action="?/advance">
          <button class="btn" type="submit">推进到「{STATUS_LABELS[data.next]}」</button>
        </form>
      {/if}
      <a class="btn secondary" href="/">返回列表</a>
    </div>
    {#if data.editable}
      <form method="POST" action="?/void" class="inline-form">
        <input type="text" name="reason" placeholder="作废原因（必填）" required />
        <input type="text" name="operator" placeholder="经手人（必填）" required />
        <button class="btn danger small" type="submit">作废本单</button>
      </form>
    {/if}
  </div>
</div>

<div class="card">
  <h2 style="margin-top:0;">工单信息{data.editable ? '（可修改）' : ''}</h2>
  {#if data.editable}
    <form method="POST" action="?/update">
      <div class="form-grid">
        <label class="field"><span>车架号后六位</span>
          <input name="frame_tail" value={o.frame_tail} maxlength="6" required /></label>
        <label class="field"><span>品牌 / 车型</span>
          <input name="brand" value={o.brand} required /></label>
        <label class="field"><span>预估工费（元）</span>
          <input name="labor" value={yuan(o.labor_cents)} inputmode="decimal" required /></label>
        <label class="field"><span>预计完工时间</span>
          <input name="expect_done_at" type="datetime-local" value={dtLocal(o.expect_done_at)} required /></label>
      </div>
      <label class="field"><span>故障描述</span>
        <textarea name="fault_desc">{o.fault_desc}</textarea></label>
      <button class="btn" type="submit">保存修改</button>
    </form>
  {:else}
    <table>
      <tbody>
        <tr><th style="width:120px;">车架号后六位</th><td>{o.frame_tail}</td></tr>
        <tr><th>品牌 / 车型</th><td>{o.brand}</td></tr>
        <tr><th>故障描述</th><td>{o.fault_desc}</td></tr>
        <tr><th>预估工费</th><td>{yuan(o.labor_cents)} 元</td></tr>
        <tr><th>预计完工</th><td>{shortTime(o.expect_done_at)}</td></tr>
        <tr><th>接车时间</th><td>{shortTime(o.created_at)}</td></tr>
      </tbody>
    </table>
  {/if}
</div>

<div class="card">
  <h2 style="margin-top:0;">换件记录</h2>
  <table>
    <thead>
      <tr><th>配件</th><th>来源</th><th class="num">数量</th><th class="num">单位成本(元)</th><th class="num">成本小计(元)</th><th>登记时间</th></tr>
    </thead>
    <tbody>
      {#each data.parts as p}
        <tr>
          <td>{p.name}</td>
          <td>{SOURCE_LABELS[p.source]}</td>
          <td class="num">{p.qty}</td>
          <td class="num">{yuan(p.unit_cost_cents)}</td>
          <td class="num">{yuan(p.qty * p.unit_cost_cents)}</td>
          <td class="muted">{shortTime(p.created_at)}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="muted">还没有换件记录</td></tr>
      {/each}
    </tbody>
  </table>

  {#if data.editable}
    <h2>登记换件</h2>
    <form method="POST" action="?/addPart" class="inline-form">
      <select name="source">
        <option value="inventory">店里库存领用</option>
        <option value="customer">客户自带配件</option>
      </select>
      <select name="inventory_id">
        {#each data.inventory as item}
          <option value={item.id}>{item.name}（存 {item.stock} {item.unit}）</option>
        {/each}
      </select>
      <input type="text" name="part_name" placeholder="自带件填名称" />
      <input type="number" name="qty" value="1" min="1" />
      <button class="btn small" type="submit">登记</button>
    </form>
    <p class="muted" style="font-size:13px;">库存领用会立刻扣减库存，库存不够会被拦下；客户自带件不计成本。</p>
  {/if}
</div>

<div class="card">
  <h2 style="margin-top:0;">拆下的旧件（待鉴定 → 保管区）</h2>
  <table>
    <thead>
      <tr><th>旧件</th><th>备注</th><th>进区时间</th><th>保管期满</th><th>状态 / 去向</th><th>经手</th></tr>
    </thead>
    <tbody>
      {#each data.oldParts as p}
        <tr>
          <td>{p.name}</td>
          <td class="muted">{p.note ?? ''}</td>
          <td>{shortTime(p.kept_at)}</td>
          <td>{shortTime(p.due_at)}</td>
          <td>
            {OLD_PART_STATUS_LABELS[p.status]}
            {#if p.disposition}（{DISPOSITION_LABELS[p.disposition]}）{/if}
            {#if p.qc_note}<br /><span class="muted">质检：{p.qc_note}</span>{/if}
          </td>
          <td class="muted">{p.operator ?? ''}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="muted">没有拆下的旧件</td></tr>
      {/each}
    </tbody>
  </table>

  {#if data.editable}
    <h2>登记拆下旧件</h2>
    <form method="POST" action="?/addOldPart" class="inline-form">
      <input type="text" name="old_name" placeholder="旧件名称（必填）" required />
      <input type="text" name="old_note" placeholder="备注（磨损情况等）" />
      <button class="btn small" type="submit">登记进保管区</button>
    </form>
    <p class="muted" style="font-size:13px;">旧件默认进保管区，超过 14 天未处理会进「待处置」提醒；处理去向在<a href="/storage">旧件保管区</a>操作。</p>
  {/if}
</div>
