// Editable campaign copy/settings. The tracker awaits approval.
// This file is copied unchanged into dist; no rebuild is needed for copy edits.
window.FAMILIES_CONFIG = {
  ctaUrl: 'https://www.mcdonalds.com/gb/en-gb.html', // "Find a restaurant" destination. Empty = button shows the pending message.
  trackingUrl: '', // Optional HTTPS event prefix. Empty = local events only.
  soundEnabled: true,
  // Share of trays that carry a favourite, 0.28–0.9. The original game used
  // 0.28; raise for more pickups, lower for fewer. Takes effect on reload.
  foodChance: 0.5,
  copy: {
    headline: 'Jump into\nfamily time.',
    subtitle: 'Collect favourites for the table.',
    instruction: 'Drag left or right. Jumping is automatic.',
    start: 'Let’s jump',
    progress: 'Favourites',
    drag: 'Drag to move',
    tutorial: 'Drag to move',
    distanceLabel: 'Height',
    distanceUnit: 'm',
    foodCount: '{food}: {count} collected',
    collectionEffect: '+1',
    completeHeadline: 'More favourites.\nMore family time.',
    partialHeadline: 'Family time\nstarts here.',
    result: '{count} favourites collected',
    endLine: 'Make time for your favourites.',
    cta: 'Find a restaurant',
    replay: 'Play again',
    ctaPending: 'Restaurant link coming soon.',
    foods: { obj4: 'Burger', obj2: 'Fries', obj3: 'Drink', obj1: 'Cone' },
  },
};
