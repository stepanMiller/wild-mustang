const paths = {
  btnMap: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15"/>',
  btnLog: '<path d="M12 5C9 3 5 3 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0zm0 0v15"/>',
  btnPause: '<path d="M8 4v16m8-16v16" stroke-width="4"/>',
  btnGallop: '<path d="M5 13l3-5 5 1 2-5 4 2 2 4-4 1-2 4H7l-2 5m8-5 2 5M8 9 4 7l-2 3M6 14l-2 3"/>',
  btnJump: '<path d="M4 18V9m0 0 5 5m-5-5 5-5m-5 5h6c6 0 9 3 10 9"/>',
};
export function applyIcons() {
  for (const [id, path] of Object.entries(paths)) {
    const button = document.getElementById(id);
    const icon = button?.querySelector('.ic');
    if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }
  const labels={btnMap:'Карта',btnLog:'Журнал заданий',btnPause:'Пауза',btnGallop:'Галоп, держи кнопку',btnJump:'Прыжок'};
  for(const [id,label] of Object.entries(labels)) document.getElementById(id)?.setAttribute('aria-label',label);
}
