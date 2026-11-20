  renderAll();
  if (seasonNotice) { persist(); setTimeout(() => toast('Сезон завершён! Награда начислена'), 800); }
  if (save.recapShow) recapWatch();
  setGameUi(false);
  requestAnimationFrame(frame);
  try { evoCheck(true); } catch (e) { KapliErr.log(e, "evo"); }
  Net.boot();
  window.kapliBusy = () => running && !dying;   // 2.6: app.js waits with a version reload until the round is over
