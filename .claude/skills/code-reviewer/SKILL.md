---
name: code-reviewer
description: Reviews code changes, PRs, or diffs in the bookmark manager for bugs, security, URL validation, error handling, edge cases, tests, and style. Use when asked to review code, a PR, or a diff.
instructions: Use when asked to review code, PRs, or diffs
---

# Code Reviewer

Review the changes in this bookmark manager: an Express 5 server (`server.js`) that serves a plain-JavaScript browser app (`public/app.js`, `public/index.html`, `public/style.css`). Bookmarks live in the browser's `localStorage`. There is no database and no build step.

## How to review

- Run `git diff` (plus `git diff --staged`) to see what changed. For a PR, use `gh pr diff <number>`. If nothing has changed, review the files the user names.
- Read the whole function around each change, not just the changed lines.
- Report only real problems. Don't comment on code that didn't change unless the change breaks it.
- When asked to review the whole project instead of a change, read every file in `server.js` and `public/` and apply all the rules below to all of the code. The "changed code only" rule above doesn't apply.

## Security

- Flag any user-supplied text (title, URL, category, search query) written into the page with `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` (XSS). It must go through `textContent`, `value` or `setAttribute`. The only allowed `innerHTML` use is `= ''` to clear a container.
- Check that every URL put into an `href` has passed `normalizeUrl()`, so `javascript:`, `data:` and `file:` links can never be saved or clicked.
- Check that links opening in a new tab (`target="_blank"`) also set `rel="noopener noreferrer"`.
- Flag any data read from `localStorage` that's used without the checks `loadBookmarks()` does: `JSON.parse` inside `try`, an `Array.isArray` check and fallbacks for missing fields.
- In `server.js`, flag any new route that builds a file path from `req.params`, `req.query` or `req.body` (path traversal), and any route that sends back request data unescaped.
- SQL injection: the app has no database today. If a change adds one, flag any query built by joining strings with user input. Queries must use the driver's parameter placeholders: `?`, or a dollar sign followed by a number, depending on the driver.
- Command injection: flag `child_process.exec`/`execSync` or `spawn` with `shell: true` when any part of the command comes from a request or user input. Use `execFile`/`spawn` with an argument array instead.
- Hardcoded secrets: flag API keys, tokens, passwords or private URLs written into the code. Settings belong in environment variables, the way `PORT` is read from `process.env.PORT`. Also flag a `.env` file that isn't listed in `.gitignore`.
- Flag `eval`, `new Function`, or `setTimeout`/`setInterval` called with a string.

## URL validation

- All URL checks must go through validator.js's `validator.isURL` with the shared `URL_RULES` object. Flag hand-written URL regexes and new option objects that differ from `URL_RULES`.
- Flag changes that loosen `URL_RULES` (adding protocols, removing `require_tld` or `disallow_auth`) unless the change says why.
- Saved URLs must be the normalized `new URL(text).href` form, so duplicate checks in `findProblem()` keep working. Flag any path that saves a URL without normalizing it.

## Error handling

- Every `localStorage` read or write must be inside `try`/`catch`. Storage can be full, disabled or blocked in private browsing.
- Errors the user can fix must be shown to them: through `showError()` on the add form or `editDraft.error` on the edit form. Flag a `catch` that swallows an error the user needs to know about, like a failed save.
- A `catch` that returns a fallback (like `loadBookmarks()` returning `[]`) is fine when the fallback is safe. Flag one that could lose data, for example by saving an empty list over bookmarks that failed to load.
- In `server.js`, errors must be logged with `console.error` and must end the request with a proper status code. Flag Express handlers that can throw without a response being sent. Flag stack traces or internal paths sent back to the browser.
- Flag code that looks up a bookmark (`bookmarks.find(...)`) and uses the result without checking that it was found.

## Edge cases

- Empty input: check what happens with blank or whitespace-only titles, URLs, categories and search text. Everything typed must be trimmed before it's checked or saved.
- Missing or null values: bookmarks saved by earlier versions may be missing `category` or any newer field. Flag code that assumes every saved bookmark has every field, and new fields without a default in `loadBookmarks()`.
- Very large data:
  - `localStorage` holds only about 5 MB per site. Flag changes that store much more per bookmark, like page contents or images.
  - `render()` redraws the whole list on every keystroke in the search box. Flag changes that make each redraw slower, like nested loops over `bookmarks`, since the list could hold thousands of entries.
  - Check that very long titles, URLs and category names wrap or truncate in `style.css` instead of breaking the layout.
- Odd input: check URLs with spaces, unicode domains, ports, query strings and `#` fragments, and categories that differ only by case or extra spaces.
- Flag bookmark ID generation that could produce the same ID twice, like two bookmarks added in the same millisecond.

## Correctness

- The add form and the edit form must use the same validation: `findProblem()`, `normalizeUrl()` and `resolveCategory()`. Flag logic that's copied into one form instead of shared.
- When editing, `findProblem()` and `resolveCategory()` must get `editingId`, or a bookmark gets flagged as a duplicate of itself.
- Category comparisons must ignore case, and `Uncategorized` must stay last in the sort (see `compareCategories()`).
- Every change to `bookmarks` must call `saveBookmarks()` and then `render()`. Flag mutations that skip either one.
- Check that `editingId` and `editDraft` are reset together on save, cancel and delete. Flag deleting the bookmark that's being edited if it leaves `editingId` pointing at a missing bookmark.

## Tests

- The project has no tests yet and `package.json` has no `test` script. If a `test` script exists, run `npm test` and report any failures as high severity.
- When a change touches logic that's easy to test, like `normalizeUrl()`, `resolveCategory()`, `findProblem()` or `compareCategories()`, and there's no test for it, note it as a suggestion (not a blocker). Recommend Node's built-in `node:test` runner and `node:assert` rather than a hand-written test harness.
- If tests are added, check that they cover the edge cases above: blank input, missing fields and duplicates. Tests must not depend on a real browser's `localStorage`.

## Accessibility

- Every new `<input>` needs a `<label for>` or an `aria-label`.
- Buttons that act on one bookmark need an `aria-label` that includes the bookmark's title, like the existing Edit and Delete buttons.
- After saving, cancelling, deleting or failing validation, keyboard focus must land somewhere sensible: the invalid field, the bookmark's Edit button, or after a delete, the next bookmark (or the search box if the list is empty). Flag any action that removes the focused element and leaves focus on the page itself.
- Error messages must be in an element with `role="alert"`.

## Naming

- Names must say what a value holds or what a function does: `bookmark`, `editingId` and `resolveCategory` are good. Flag vague names like `data`, `temp`, `obj`, `x` or `handle` unless the scope is a single short line.
- Functions are verbs (`saveBookmarks`, `renderEditForm`). Booleans read as yes/no questions (`isEditing`, `hasResults`).
- Constants that never change use `UPPER_SNAKE_CASE` (`STORAGE_KEY`, `URL_RULES`). Everything else uses `camelCase`. Element IDs and CSS classes use `kebab-case`.
- Flag a name that no longer matches what the code does after the change.

## Dependencies and style

- Prefer well-known open-source libraries (like validator.js) over hand-written code for solved problems such as parsing, validation or escaping. Flag reinventions.
- Flag new dependencies that are unmaintained, very large for what they do, or already covered by something in `package.json`.
- Browser libraries must be served from `node_modules` through an Express route, like `/vendor/validator.min.js`, not copied into `public/`.
- Match the existing style: `const`/`let` (no `var`), single quotes, two-space indentation, and a short plain-English comment above any function whose purpose or side effects aren't obvious from its name. Short functions like `saveBookmarks()` or `deleteBookmark()` don't need one.
- Flag leftover debugging `console.log` calls in `public/` code, commented-out code, and unused variables or functions. The startup messages in `server.js` are intentional.

## Output format

Structure the review as:

1. **Summary**: one sentence on what the change does and whether it's ready to merge.
2. **Issues**: a bullet list, most severe first. Start each bullet with its severity, then give `file:line`, a one-sentence description of the problem, a concrete example of how it goes wrong, and a suggested fix.
   - **High**: security holes, data loss, crashes or broken core features (adding, editing, deleting, saving).
   - **Medium**: wrong behavior in edge cases, missing error handling, accessibility blockers, failing tests.
   - **Low**: naming, style, and minor duplication.
   - If there are no issues, write "None."
3. **Suggestions**: optional improvements that aren't blockers, like missing tests, simplifications or a better library. Leave this section out if there's nothing worth saying.

Don't pad the review with praise or a restatement of the diff.
