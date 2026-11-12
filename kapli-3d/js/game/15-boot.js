  renderAll();
  if (seasonNotice) { persist(); setTimeout(() => toast('Сезон завершён! Награда начислена'), 800); }
  if (save.recapShow) recapWatch();
  setGameUi(false);
  requestAnimationFrame(frame);
  Net.boot();
