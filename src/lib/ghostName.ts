const ADJECTIVES = [
  'Swift',
  'Brave',
  'Lucky',
  'Cosmic',
  'Zippy',
  'Fuzzy',
  'Neon',
  'Jolly',
  'Sneaky',
  'Turbo',
  'Sunny',
  'Wobbly',
  'Mighty',
  'Chill',
  'Sparkly',
  'Dizzy',
  'Pepper',
  'Giga',
  'Pixel',
  'Bubbly',
];

const NOUNS = [
  'Fox',
  'Panda',
  'Otter',
  'Koala',
  'Llama',
  'Gecko',
  'Tiger',
  'Penguin',
  'Falcon',
  'Whale',
  'Bean',
  'Noodle',
  'Potato',
  'Mango',
  'Comet',
  'Waffle',
  'Cactus',
  'Dragon',
  'Robot',
  'Muffin',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Kahoot-style nickname, e.g. "ZippyOtter27". */
export function randomGhostName(): string {
  const n = Math.floor(Math.random() * 90) + 10;
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${n}`;
}
