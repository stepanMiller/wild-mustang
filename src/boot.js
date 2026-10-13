const report = () => {
  document.querySelector('#loading')?.remove();
  document.querySelector('#error')?.classList.add('on');
};
import('./game.js').catch(report);
