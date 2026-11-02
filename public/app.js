// Bookmark manager: runs in the browser, loaded by index.html.
const STORAGE_KEY = 'bookmarks';
const DEFAULT_CATEGORY = 'Uncategorized';

const form = document.getElementById('bookmark-form');
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const categoryInput = document.getElementById('category');
const formError = document.getElementById('form-error');
const groupsContainer = document.getElementById('bookmark-groups');
const categoryOptions = document.getElementById('category-options');
const emptyState = document.getElementById('empty-state');
const noResults = document.getElementById('no-results');
const totalBadge = document.getElementById('count');
const searchInput = document.getElementById('search');

// Set when the saved data couldn't be read, so it is never overwritten (and lost) by a save
let storageUnreadable = false;

let bookmarks = loadBookmarks();

// The bookmark currently being edited (null when none), and what has been typed into its
// edit form so far. Keeping the typed values here means they survive the list being redrawn.
let editingId = null;
let editDraft = null;

// Read saved bookmarks from localStorage (empty list if none, or if storage is unavailable).
// Damaged entries (not an object, or missing a title or URL) are skipped instead of
// failing the whole load. Bookmarks saved before categories existed get the default category.
function loadBookmarks() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    storageUnreadable = true;
    return [];
  }
  if (saved === null) return [];
  if (!Array.isArray(saved)) {
    storageUnreadable = true;
    return [];
  }
  return saved
    .filter((bookmark) => bookmark && typeof bookmark === 'object'
      && typeof bookmark.title === 'string' && typeof bookmark.url === 'string')
    .map((bookmark) => ({
      ...bookmark,
      id: typeof bookmark.id === 'string' && bookmark.id ? bookmark.id : newId(),
      category: typeof bookmark.category === 'string' && bookmark.category.trim()
        ? bookmark.category.trim()
        : DEFAULT_CATEGORY,
    }));
}

// Write the bookmarks to localStorage. Returns an error message if that failed, or null.
function saveBookmarks() {
  if (storageUnreadable) {
    return 'Could not save: your saved bookmarks could not be read, so saving now would erase them.';
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    return null;
  } catch (e) {
    return 'Could not save. Your browser may be blocking storage for this page.';
  }
}

// A unique ID for a new bookmark
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// How validator.js (the open-source library loaded before this file) checks web addresses:
// http or https only, a real-looking domain ending (like .com), and no username/password inside.
const URL_RULES = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
  require_tld: true,
  disallow_auth: true,
};

// Turn what the user typed into a full web address, or return null if it isn't a valid one.
// "example.com" becomes "https://example.com/".
function normalizeUrl(input) {
  let text = input.trim();
  if (!text) return null;
  // Only text starting with "scheme://" already has one; "example.com:8080" is a host and port
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text;
  if (!validator.isURL(text, URL_RULES)) return null;
  // Write the address in the browser's standard form, so the same link is always stored the same way
  try {
    return new URL(text).href;
  } catch (e) {
    return null;
  }
}

// Tidy a typed category and match it to an existing one regardless of case, so "work" and
// "Work" end up in the same group (the spelling already in use wins). Blank means the default.
// ignoreId leaves out the bookmark being edited, so its own category's spelling can be changed.
function resolveCategory(input, ignoreId) {
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name || name.toLowerCase() === DEFAULT_CATEGORY.toLowerCase()) return DEFAULT_CATEGORY;
  const existing = bookmarks.find(
    (bookmark) => bookmark.id !== ignoreId && bookmark.category.toLowerCase() === name.toLowerCase()
  );
  return existing ? existing.category : name;
}

// Alphabetical, ignoring case, with the default category always last
function compareCategories(a, b) {
  if (a === DEFAULT_CATEGORY) return 1;
  if (b === DEFAULT_CATEGORY) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

// Check a bookmark's title and (already normalized) URL. Returns null if they're fine,
// otherwise the problem and which field it's in. ignoreId lets an edited bookmark keep its own URL.
function findProblem(title, url, ignoreId) {
  if (!title) return { message: 'Please enter a title.', field: 'title' };
  if (!url) return { message: 'Please enter a valid web address, like example.com.', field: 'url' };
  if (bookmarks.some((bookmark) => bookmark.url === url && bookmark.id !== ignoreId)) {
    return { message: 'That link is already saved.', field: 'url' };
  }
  return null;
}

function showError(message) {
  formError.textContent = message;
}

// Redraw the list: bookmarks whose title matches the search box, grouped by category
function render() {
  groupsContainer.innerHTML = '';

  // The bookmark being edited always stays visible, even if it doesn't match the search
  const query = searchInput.value.trim().toLowerCase();
  const visible = bookmarks.filter((bookmark) =>
    bookmark.id === editingId || !query || bookmark.title.toLowerCase().includes(query)
  );

  // Group by category, ignoring case; bookmarks keep their newest-first order inside each group
  const groups = new Map();
  for (const bookmark of visible) {
    const key = bookmark.category.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: bookmark.category, items: [] });
    groups.get(key).items.push(bookmark);
  }
  const sortedGroups = [...groups.values()].sort((a, b) => compareCategories(a.name, b.name));

  for (const group of sortedGroups) {
    const section = document.createElement('section');
    section.className = 'category-group';

    const header = document.createElement('div');
    header.className = 'category-header';
    const heading = document.createElement('h3');
    heading.textContent = group.name;
    const groupCount = document.createElement('span');
    groupCount.className = 'count';
    groupCount.textContent = group.items.length;
    header.append(heading, groupCount);

    const list = document.createElement('ul');
    list.className = 'bookmark-list';
    for (const bookmark of group.items) {
      list.append(bookmark.id === editingId ? renderEditForm() : renderBookmark(bookmark));
    }

    section.append(header, list);
    groupsContainer.append(section);
  }

  totalBadge.textContent = bookmarks.length;
  emptyState.hidden = bookmarks.length > 0;
  noResults.hidden = bookmarks.length === 0 || visible.length > 0;

  // Suggest the categories already in use when typing in a category field
  const names = [...new Set(bookmarks.map((bookmark) => bookmark.category))].sort(compareCategories);
  categoryOptions.innerHTML = '';
  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    categoryOptions.append(option);
  }
}

// One bookmark in the list: its title, URL, and Edit and Delete buttons
function renderBookmark(bookmark) {
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

  const urlText = document.createElement('span');
  urlText.className = 'bookmark-url';
  urlText.textContent = bookmark.url;

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  const editButton = document.createElement('button');
  editButton.className = 'edit-button';
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.dataset.id = bookmark.id;
  editButton.setAttribute('aria-label', `Edit ${bookmark.title}`);
  editButton.addEventListener('click', () => startEdit(bookmark.id));

  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-button';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', `Delete ${bookmark.title}`);
  deleteButton.addEventListener('click', () => deleteBookmark(bookmark.id));

  info.append(link, urlText);
  actions.append(editButton, deleteButton);
  item.append(info, actions);
  return item;
}

// The bookmark being edited: a small form filled in from editDraft, with Save and Cancel
function renderEditForm() {
  const item = document.createElement('li');
  item.className = 'bookmark card editing';

  const editForm = document.createElement('form');
  editForm.className = 'edit-form';
  editForm.noValidate = true;

  const fields = [
    { key: 'title', label: 'Title' },
    { key: 'url', label: 'URL' },
    { key: 'category', label: 'Category' },
  ];
  for (const { key, label } of fields) {
    const field = document.createElement('div');
    field.className = 'field';

    const labelElement = document.createElement('label');
    labelElement.htmlFor = 'edit-' + key;
    labelElement.textContent = label;

    const input = document.createElement('input');
    input.id = 'edit-' + key;
    input.type = 'text';
    input.autocomplete = 'off';
    input.value = editDraft[key];
    if (key === 'url') input.inputMode = 'url';
    if (key === 'category') {
      input.setAttribute('list', 'category-options');
      input.placeholder = DEFAULT_CATEGORY;
    }
    input.addEventListener('input', () => { editDraft[key] = input.value; });

    field.append(labelElement, input);
    editForm.append(field);
  }

  const error = document.createElement('p');
  error.className = 'form-error';
  error.setAttribute('role', 'alert');
  error.textContent = editDraft.error;

  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'cancel-button';
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', cancelEdit);

  const saveButton = document.createElement('button');
  saveButton.className = 'add-button';
  saveButton.type = 'submit';
  saveButton.textContent = 'Save';

  actions.append(cancelButton, saveButton);
  editForm.append(error, actions);

  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEdit();
  });
  editForm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  });

  item.append(editForm);
  return item;
}

// Put the keyboard focus back on a bookmark's Edit button (after saving or cancelling)
function focusEditButton(id) {
  const button = [...groupsContainer.querySelectorAll('.edit-button')].find((b) => b.dataset.id === id);
  if (button) button.focus();
}

function startEdit(id) {
  const bookmark = bookmarks.find((b) => b.id === id);
  if (!bookmark) return;
  editingId = id;
  editDraft = { title: bookmark.title, url: bookmark.url, category: bookmark.category, error: '' };
  render();
  document.getElementById('edit-title').focus();
}

function cancelEdit() {
  const id = editingId;
  editingId = null;
  editDraft = null;
  render();
  focusEditButton(id);
}

function saveEdit() {
  const title = editDraft.title.trim();
  const url = normalizeUrl(editDraft.url);
  const problem = findProblem(title, url, editingId);
  if (problem) {
    editDraft.error = problem.message;
    render();
    document.getElementById('edit-' + problem.field).focus();
    return;
  }

  const bookmark = bookmarks.find((b) => b.id === editingId);
  if (!bookmark) {
    cancelEdit();
    return;
  }
  const before = { title: bookmark.title, url: bookmark.url, category: bookmark.category };
  bookmark.title = title;
  bookmark.url = url;
  bookmark.category = resolveCategory(editDraft.category, editingId);

  // If it couldn't be saved, undo the change and keep the form open with the reason
  const saveError = saveBookmarks();
  if (saveError) {
    Object.assign(bookmark, before);
    editDraft.error = saveError;
    render();
    document.getElementById('edit-title').focus();
    return;
  }

  const id = editingId;
  editingId = null;
  editDraft = null;
  render();
  focusEditButton(id);
}

// Add a bookmark to the top of the list. Returns an error message if it couldn't be saved
// (the bookmark is then left out, so the page never shows something that isn't stored), or null.
function addBookmark(title, url, category) {
  const bookmark = { id: newId(), title, url, category };
  bookmarks.unshift(bookmark);
  const saveError = saveBookmarks();
  if (saveError) bookmarks = bookmarks.filter((b) => b !== bookmark);
  render();
  return saveError;
}

// Delete a bookmark, then move keyboard focus to the bookmark that took its place (or the
// one above it, or the search box if none are left), so keyboard users keep their place.
function deleteBookmark(id) {
  const editButtons = [...groupsContainer.querySelectorAll('.edit-button')];
  const index = editButtons.findIndex((button) => button.dataset.id === id);
  const neighbour = editButtons[index + 1] || editButtons[index - 1];
  const nextId = neighbour ? neighbour.dataset.id : null;

  const before = bookmarks;
  bookmarks = bookmarks.filter((bookmark) => bookmark.id !== id);
  const saveError = saveBookmarks();
  if (saveError) {
    bookmarks = before;
    showError(saveError);
    render();
    focusEditButton(id);
    return;
  }

  render();
  if (nextId) focusEditButton(nextId);
  else searchInput.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  showError('');

  const title = titleInput.value.trim();
  const url = normalizeUrl(urlInput.value);
  const problem = findProblem(title, url);
  if (problem) {
    showError(problem.message);
    (problem.field === 'title' ? titleInput : urlInput).focus();
    return;
  }

  const saveError = addBookmark(title, url, resolveCategory(categoryInput.value));
  if (saveError) {
    showError(saveError);
    return;
  }
  form.reset();
  titleInput.focus();
});

// Filter the list on every keystroke in the search box
searchInput.addEventListener('input', render);

render();
if (storageUnreadable) {
  showError('Your saved bookmarks could not be read, so changes won\'t be saved until that is fixed.');
}
