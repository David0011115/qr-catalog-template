  renderAll();
  if (save.notice27 && save.notice27.length) setTimeout(() => {   // 2.7: what changed in your collection
    tutModal('Коллекция обновлена', `<p>Скины, рамки и титулы переработаны. Что изменилось у тебя:</p><ul>${save.notice27.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>`, [['n27Ok', 'Понятно', 'btn']]);
    document.addEventListener('click', function f(e) { if (e.target.id === 'n27Ok') { $('tutModal').hidden = true; document.removeEventListener('click', f); } });
    delete save.notice27; persist();
  }, 1400);
  if (seasonNotice) { persist(); setTimeout(() => toast('Сезон завершён! Награда начислена'), 800); }
  if (save.recapShow) recapWatch();
  setGameUi(false);
  requestAnimationFrame(frame);
  try { evoCheck(true); } catch (e) { KapliErr.log(e, "evo"); }
  Net.boot();
  window.kapliBusy = () => running && !dying;   // 2.6: app.js waits with a version reload until the round is over
