**禁止事項：**
> 注意：本專案禁止使用任何 git 指令；VS Code 於執行/偵錯前會自動顯示警告（任務：no-git-guard）。  

# AI 回答品質要求

## 回答原則
- **不知道就說不知道**，不要猜測或給出不確定的建議
- **避免列舉不可行方案**，不要為了顯示思考而羅列明顯困難或不可能的選項
- **深入思考後再回答**，確保建議具有實際可行性
- **承認限制**，如果問題超出能力範圍，直接說明而非強行給答案

## 禁止行為
- 列出一堆「可能的方案」但實際上都不可行
- 為了顯示全面思考而給出明顯錯誤的建議  
- 用冗長的分析掩蓋缺乏實質內容
- 不經深入思考就給出技術建議

## 期望行為
- 簡潔直接的回答
- 確實可行的建議
- 承認不知道的部分
- 避免浪費時間的無效分析

# Repository Guidelines

- 嚴禁使用任何 `git` 指令（包含但不限於 `git checkout`、`git reset`、`git restore`、`git clean`、`git commit`、`git pull` 等）。  
- 只能直接編輯檔案內容，任何版本還原或其他 git 操作一律不得執行。

# Repository Guidelines

## Project Structure & Module Organization
- `index.html` – base markup; wire global layout and cards here.
- `style.css` – shared styles; group new sections under a banner comment and favor utility classes over inline styles.
- `script.js` – interactive logic; keep feature code grouped, with top‑level wiring near the bottom.
- `assistant.html` – standalone assistant UI.
- `waa.py` – Python helpers/utilities; add reusable routines here instead of embedding Python in HTML.
- `assets/` – store images/media; create the folder if needed.
- `tests/` – JS specs as `*.spec.js`, Python tests as `test_*.py`.

## Build, Test, and Development Commands
- `python -m http.server 8000` – serve the site locally (root is document root).
- `python waa.py` – run Python helpers; add `--help` when introducing new entry points.
- `npx prettier@latest --check index.html script.js style.css` – verify formatting; use `--write` to fix.
- `npx vitest run` – run browser‑focused DOM unit tests (if present).
- `pytest --maxfail=1 --disable-warnings` – run Python tests.

## Coding Style & Naming Conventions
- JavaScript: 2‑space indent; camelCase for vars/functions; PascalCase for factory wrappers; suffix async methods with `Async`.
- CSS: kebab‑case selectors; limit nesting to two levels; group variables under `:root`.
- Python: 4‑space indent; snake_case functions; CapWords classes; add short docstrings for non‑obvious routines.
- Filenames: descriptive and consistent (e.g., `feature-name.component.js`).

## Testing Guidelines
- Put automated tests in `tests/`.
- JS: prefer `vitest` + `@testing-library/dom` for lightweight DOM tests; aim for ~80% coverage on touched code.
- Python: `pytest` with meaningful assertions.
- Document manual QA scenarios that aren’t easily automated.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat: add data importer`, `fix: guard null state`.
- Reference issues when available: `feat: add map overlay (#42)`.
- PRs should include: concise summary, testing notes (commands + results), and screenshots/screencasts for UI changes.

## Encoding & Editor Settings
- Save all source files as UTF‑8 without BOM.
- Recommended safeguards:
  - `.gitattributes`: `*.html text working-tree-encoding=UTF-8`, same for `*.css` and `*.js`.
  - Editor: `files.encoding = "utf8"`, `files.autoGuessEncoding = false`.
