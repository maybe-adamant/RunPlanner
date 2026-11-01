/** What an option buys or sells, named without its verb or its pending ellipsis. */
export function pickSubject(optionLabel: string): string {
  return optionLabel
    .replace(/^(Buy|Rush|Sell) /, '')
    .replace(/…$/, '')
    .replace(/ item$/, '');
}
