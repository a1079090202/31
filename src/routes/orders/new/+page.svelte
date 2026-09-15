<script>
  let { form } = $props();
  const v = (key, fallback = '') => form?.values?.[key] ?? fallback;
</script>

<h1>接车建单</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}

<div class="card">
  <form method="POST">
    <div class="form-grid">
      <label class="field">
        <span>车架号后六位 *</span>
        <input name="frame_tail" value={v('frame_tail')} maxlength="6" placeholder="如 8A3F21" required />
      </label>
      <label class="field">
        <span>品牌 / 车型 *</span>
        <input name="brand" value={v('brand')} placeholder="如 捷安特 ATX660" required />
      </label>
      <label class="field">
        <span>预估工费（元）*</span>
        <input name="labor" value={v('labor')} placeholder="如 50 或 50.00" inputmode="decimal" required />
      </label>
      <label class="field">
        <span>预计完工时间 *</span>
        <input name="expect_done_at" type="datetime-local" value={v('expect_done_at')} required />
      </label>
    </div>
    <label class="field">
      <span>故障描述 *</span>
      <textarea name="fault_desc" placeholder="客户怎么说的就怎么记">{v('fault_desc')}</textarea>
    </label>
    <button class="btn" type="submit">建单（状态：待修）</button>
  </form>
</div>
