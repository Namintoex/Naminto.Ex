/**
 * Utilitaire partagé entre les moteurs de règles configurables du
 * domaine Payments (Fee Engine, Prompt 10 ; Limit Engine, Prompt 11) :
 * parmi les règles qui correspondent à une requête, retient la plus
 * spécifique (celle qui contraint le plus de dimensions). Ne pas
 * dupliquer cette logique dans chaque moteur.
 */
export function pickMostSpecific<T>(
  rules: T[],
  isMatch: (rule: T) => boolean,
  specificity: (rule: T) => number
): T | null {
  const matching = rules.filter(isMatch);
  if (matching.length === 0) return null;

  return matching.reduce((best, current) => (specificity(current) > specificity(best) ? current : best));
}
