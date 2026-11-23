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
  // 2.7: a new version is applied only in the main menu with no window open — never in a round, a pause, a death or the result screen
  window.kapliBusy = () => { try { return running || dying || paused || $('menuCard').hidden || !!document.querySelector('.modal:not([hidden])'); } catch (e) { return false; } };
  window.kapliSave = () => { try { persist(); } catch (e) {} };
