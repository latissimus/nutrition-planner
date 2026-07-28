let timer = null;

export function toast(text) {
  let node = document.querySelector('#app-toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'app-toast';
    node.className = 'app-toast';
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.classList.add('sichtbar');
  clearTimeout(timer);
  timer = setTimeout(() => node.classList.remove('sichtbar'), 2400);
}
