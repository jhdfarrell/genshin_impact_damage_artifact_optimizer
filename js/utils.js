function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * 组合数 C(n, m)：从 n 个里选 m 个的种数。
 * - 返回 Number，超大时会溢出为 Infinity，请在可接受范围内使用。
 * - 对非法输入（m<0、m>n）返回 0。
 * - 对边界情况（m=0 或 m=n）返回 1。
 *
 * 用法示例：
 *   const ways = comb(5, 2); // 10
 */
function comb(n, m) {
  n = Number(n);
  m = Number(m);
  if (!Number.isFinite(n) || !Number.isFinite(m)) return 0;
  n = Math.floor(n);
  m = Math.floor(m);
  if (m < 0 || n < 0 || m > n) return 0;
  if (m === 0 || m === n) return 1;
  m = Math.min(m, n - m); // 利用对称性 C(n,m) = C(n,n-m)
  let res = 1;
  for (let i = 1; i <= m; i++) {
    res = res * (n - m + i) / i;
  }
  return res;
}

