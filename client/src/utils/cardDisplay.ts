import type { CardColor, CardValue, UnoCard as SharedUnoCard } from '@online-uno/shared';

/** Map shared card values to display-friendly labels. */
export function cardValueLabel(value: CardValue): string {
  switch (value) {
    case 'draw-two':
      return '+2';
    case 'wild-draw-four':
      return '+4';
    case 'wild':
      return 'WILD';
    case 'skip':
      return '⊘';
    case 'reverse':
      return '↺';
    default:
      return value;
  }
}

export function isWildCard(card: SharedUnoCard): boolean {
  return card.color === 'wild';
}

export function playableColor(color: CardColor): Exclude<CardColor, 'wild'> | 'wild' {
  return color;
}

export type DisplayCard = SharedUnoCard | { color: CardColor; value: CardValue | 'back'; id?: string };

export function isBackCard(card: DisplayCard): card is { color: CardColor; value: 'back' } {
  return card.value === 'back';
}
