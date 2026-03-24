document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pageId = btn.dataset.page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(pageId).classList.add('active');
    if (pageId === 'cycle') window.renderCycleFlow();
    if (pageId === 'artifacts') renderArtifacts();
    if (pageId === 'dust' && typeof window.renderDustArtifactOptions === 'function') window.renderDustArtifactOptions();
    if (pageId === 'frost' && typeof window.renderFrostArtifactOptions === 'function') window.renderFrostArtifactOptions();
  });
});

document.getElementById('cycle-calc-btn')?.addEventListener('click', () => {
  if (typeof window.renderCycleFlow === 'function') window.renderCycleFlow();
});

syncDataToBasePanel();
if (typeof populateBuffContent === 'function') populateBuffContent(0);
