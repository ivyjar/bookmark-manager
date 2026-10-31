// Bookmark manager: runs in the browser, loaded by index.html.
const STORAGE_KEY = 'bookmarks';

const form = document.getElementById('bookmark-form');
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const formError = document.getElementById('form-error');
const list = document.getElementById('bookmark-list');
const emptyState = document.getElementById('empty-state');
const count = document.getElementById('count');

let bookmarks = loadBookmarks();

// Read saved bookmarks from localStorage (empty list if none, or if storage is unavailable)
function loadBookmarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

function saveBookmarks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (e) {
    showError('Could not save. Your browser may be blocking storage for this page.');
  }
}

// Turn what the user typed into a full web address, or return null if it isn't one.
// "example.com" becomes "https://example.com"; only http and https links are allowed.
function normalizeUrl(input) {
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = 'https://' + text;

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.href;
  } catch (e) {
    return null;
  }
}

function showError(message) {
  formError.textContent = message;
}

// Redraw the whole list from the bookmarks array
function render() {
  list.innerHTML = '';

  for (const bookmark of bookmarks) {
    const item = document.createElement('li');
    item.className = 'bookmark card';

    const info = document.createElement('div');
    info.className = 'bookmark-info';

    const link = document.createElement('a');
    link.className = 'bookmark-title';
    link.href = bookmark.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = bookmark.title;

    const url = document.createElement('span');
    url.className = 'bookmark-url';
    url.textContent = bookmark.url;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${bookmark.title}`);
    deleteButton.addEventListener('click', () => deleteBookmark(bookmark.id));

    info.append(link, url);
    item.append(info, deleteButton);
    list.append(item);
  }

  count.textContent = bookmarks.length;
  emptyState.hidden = bookmarks.length > 0;
}

function addBookmark(title, url) {
  // Newest first
  bookmarks.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), title, url });
  saveBookmarks();
  render();
}

function deleteBookmark(id) {
  bookmarks = bookmarks.filter((bookmark) => bookmark.id !== id);
  saveBookmarks();
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  showError('');

  const title = titleInput.value.trim();
  const url = normalizeUrl(urlInput.value);

  if (!title) {
    showError('Please enter a title.');
    titleInput.focus();
    return;
  }
  if (!url) {
    showError('Please enter a valid web address, like example.com.');
    urlInput.focus();
    return;
  }
  if (bookmarks.some((bookmark) => bookmark.url === url)) {
    showError('That link is already saved.');
    urlInput.focus();
    return;
  }

  addBookmark(title, url);
  form.reset();
  titleInput.focus();
});

render();
