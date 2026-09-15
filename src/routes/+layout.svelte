<script>
  import '../app.css';
  let { data, children } = $props();
</script>

<nav class="topnav">
  <span class="brand">🚲 修车铺台账</span>
  <a href="/">工单</a>
  <a href="/orders/new">接车建单</a>
  <a href="/inventory">配件库存</a>
  <a href="/storage">
    旧件保管区{#if data.overdueCount > 0}<span class="badge">{data.overdueCount} 待处置</span>{/if}
  </a>
  <a href="/reports">月度汇总</a>
</nav>

<main>
  {@render children()}
</main>
