  renderAll();
  if (save.notice27 && save.notice27.length) setTimeout(() => {   // 2.7: what changed in your collection
    tutModal('Коллекция обновлена', `<p>Скины, рамки и титулы переработаны. Что изменилось у тебя:</p><ul>${save.notice27.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>`, [['n27Ok', 'Понятно', 'btn']]);
    document.addEventListener('click', function f(e) { if (e.target.id === 'n27Ok') { $('tutModal').hidden = true; document.removeEventListener('click', f); } });
    delete save.notice27; persist();
  }, 1400);
  try { hcRewardCheck(false); } catch (e) {}   // 2.7.5: rewards earned before this version had their own windows (none after the reset)
  if (save.noticeHc && save.noticeHc.length) setTimeout(() => {   // 2.7.5: what the new «Хардкор» took back
    tutModal('«Хардкор» стал сложнее', `<p>Планка режима выросла до 250 000: капля делится на 100 000, победа — обе половины по 125 000. Рост медленнее, вех больше, боты сильнее.</p><p>Награды «Хардкора» из 2.7 сброшены без возмещения — их можно получить заново: ${save.noticeHc.map(escHtml).join(', ')}. Каждая награда теперь приходит отдельным окном.</p>`, [['nHcOk', 'Понятно', 'btn']]);
    document.addEventListener('click', function f(e) { if (e.target.id === 'nHcOk') { $('tutModal').hidden = true; document.removeEventListener('click', f); } });
    delete save.noticeHc; persist();
  }, 2600);
  if (seasonNotice) { persist(); setTimeout(() => toast('Сезон завершён! Награда начислена'), 800); }
  if (save.recapShow) recapWatch();
  setGameUi(false);
  requestAnimationFrame(frame);
  try { evoCheck(true); } catch (e) { KapliErr.log(e, "evo"); }
  Net.boot();
  // 2.7: a new version is applied only in the main menu with no window open — never in a round, a pause, a death or the result screen
  window.kapliBusy = () => { try { return running || dying || paused || $('menuCard').hidden || !!document.querySelector('.modal:not([hidden])'); } catch (e) { return false; } };
  window.kapliSave = () => { try { persist(); } catch (e) {} };
