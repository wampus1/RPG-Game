// (Round 127) Books as things to hold, buy and sell: "book~<id>", the id
// one of the library's ("annals:3:0", "novel:nv1k2:1": see game/books).
// What each one is called, who wrote it and how well it's selling are kept
// here (filled in by sim/publishing.js), so an item can say its own name.
export const BOOKS = new Map();

// Asked when a book isn't known yet (a save just loaded): set by the game.
export const BOOK_HOOKS = { resolve: null, sold: null };

// The books most read just now (their item keys, best first): what the
// readers of a town go to the shops for.
export const TOP_BOOKS = [];

export const bookKey = (id) => `book~${id}`;
export const bookIdOf = (key) => (typeof key === 'string' && key.startsWith('book~') ? key.slice(5) : null);

export function bookInfo(id) {
  let b = BOOKS.get(id);
  if (!b && BOOK_HOOKS.resolve) {
    try {
      b = BOOK_HOOKS.resolve(id) || null;
    } catch {
      b = null;
    }
    if (b) BOOKS.set(id, b);
  }
  return b || null;
}

// How a book is talked of, by how well it's read.
export function fameWord(pop) {
  return pop >= 75 ? 'Everyone is reading it.' : pop >= 50 ? 'It is selling well.' : pop >= 25 ? 'It has its readers.' : 'Few read it now.';
}
