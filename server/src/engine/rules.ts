import type { CardColor, CardValue, UnoCard } from '@online-uno/shared';

export function canPlayCard(card: UnoCard, topDiscard: UnoCard, currentColor: CardColor): boolean {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topDiscard.value) return true;
  return false;
}

export function hasPlayableCard(hand: UnoCard[], topDiscard: UnoCard, currentColor: CardColor): boolean {
  return hand.some((c) => canPlayCard(c, topDiscard, currentColor));
}

export function isWildDrawFourLegal(hand: UnoCard[], currentColor: CardColor): boolean {
  return !hand.some((c) => c.color !== 'wild' && c.color === currentColor);
}

export function cardPoints(card: UnoCard): number {
  if (card.value >= '0' && card.value <= '9') return Number(card.value);
  switch (card.value) {
    case 'skip':
    case 'reverse':
    case 'draw-two':
      return 20;
    case 'wild':
    case 'wild-draw-four':
      return 50;
    default:
      return 0;
  }
}

export function isNumberValue(value: CardValue): value is '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' {
  return value >= '0' && value <= '9';
}
