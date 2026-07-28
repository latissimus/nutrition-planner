// Bewusst kein Produktname: Die Namensentscheidung folgt nach dem funktionalen
// Fundament. So wird ein provisorischer Name nicht unbemerkt zur Marke.
export function brandMarkup() {
  return `
    <span class="produktmarke" aria-label="Nutrition Planner">
      <span class="produktmarke-pixel" aria-hidden="true">◆</span>
      <span><small>PROJECT</small>NUTRITION</span>
    </span>`;
}
