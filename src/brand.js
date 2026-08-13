import headerLogoUrl from '../MUSCLEDEX Logo.svg?url';

export function brandMarkup() {
  return headerBrandMarkup();
}

export function headerBrandMarkup() {
  return `<img class="kopf-logo" src="${headerLogoUrl}" alt="MUSCLEDEX">`;
}
