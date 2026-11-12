  renderAll();
  if (seasonNotice) { persist(); setTimeout(() => toast('Сезон завершён! Награда начислена'), 800); }
  setGameUi(false);
  requestAnimationFrame(frame);
  Net.boot();
