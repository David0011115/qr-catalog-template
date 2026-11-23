  // ================= start-up after the network part (was the end of 14-net.js; the test panel sits between them in the test copy) =================
  fixModeForLeague(); mode = save.mode;
  applyPet();
  resetViruses();
  setHoliday(seasonStarted ? holidayOf(seasonNow) : null);
  applySettings();
