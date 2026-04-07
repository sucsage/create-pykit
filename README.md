# create-pykit

Interactive CLI to scaffold Python data science projects — powered by `uv`.

## Usage

```bash
npx create-pykit
npx create-pykit my-project
npx create-pykit my-project --data /path/to/data.csv
```

## Features

- 🐍 Python project powered by `uv`
- 📊 Templates: Data Analysis, ML, Deep Learning, NLP, Computer Vision
- 🗄️ DB support: SQLite, PostgreSQL, MySQL, MongoDB, DuckDB
- 📁 Auto-copies CSV → `data/` and generates `analysis.py` from real columns
- 📓 Optional Jupyter notebook
- 🛠️ Makefile with `make install`, `make run`, `make notebook`, `make db-init`

## Requirements

- Node.js >= 18
- [uv](https://docs.astral.sh/uv/getting-started/installation/) installed

## Dev

```bash
pnpm install
pnpm dev my-project --data ./sample.csv
```

## Publish

```bash
pnpm build
npm publish
```
