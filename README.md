# create-pykit

Interactive CLI to scaffold Python data science projects — powered by [`uv`](https://docs.astral.sh/uv/).

## Usage

```bash
npx create-pykit
npx create-pykit my-project
npx create-pykit my-project --data /path/to/data.csv
npx create-pykit my-project --url https://example.com/data.csv
```

## What it does

1. Asks a few questions (project name, template, database)
2. Scaffolds the project
3. Runs `uv sync` automatically
4. If `--data` is provided — executes `eda.ipynb` immediately so outputs are already saved when you open it

## Features

### Base dependencies (always included)

Every project ships with `pandas`, `numpy`, `matplotlib`, `seaborn`, `jupyterlab`, and `python-dotenv` out of the box.

### Templates

| Template | Additional deps |
|---|---|
| Data Analysis | *(base only)* |
| Machine Learning | scikit-learn, xgboost |
| Deep Learning | torch, torchvision |
| NLP | transformers, spaCy |
| Computer Vision | opencv-python, torchvision, Pillow |
| Custom | pick AI/ML deps yourself |

### CSV / Data analysis

| Flag | Description |
|---|---|
| `--data <path>` | Analyze a local CSV and pre-fill the notebook with real column names, types, and auto-generated EDA |
| `--url <url>` | Download a CSV from a URL then analyze it the same way |

When a CSV is detected, the notebook is generated with:
- Missing value heatmap
- Histogram + boxplot per numeric column (with IQR outlier table)
- Bar chart + pie chart per categorical column
- Monthly trend + row count for date columns
- Correlation matrix with high-correlation alerts (`|r| > 0.7`)
- Summary export → `data/eda_summary.txt`

### Database support

Selected database generates `db/connection.py` + `.env` boilerplate, and injects an **Export to CSV** cell at the top of the notebook that clones every table/collection into `data/db_export/*.csv`.

**Local**
| | Driver |
|---|---|
| SQLite | sqlalchemy |
| DuckDB | duckdb |

**Self-hosted**
| | Driver |
|---|---|
| PostgreSQL | sqlalchemy + psycopg2 |
| MySQL | sqlalchemy + pymysql |
| MongoDB | pymongo |

**Cloud**
| | Driver |
|---|---|
| MongoDB Atlas | pymongo |
| Supabase | supabase-py |
| Neon | sqlalchemy + psycopg2 |
| Firebase Firestore | firebase-admin |
| Redis | redis-py |
| Prisma ORM | prisma Python client |

### Project structure

```
my-project/
├── data/
│   ├── your-data.csv        # copied from --data / --url
│   └── db_export/           # tables exported from DB (if DB selected)
├── notebooks/
│   └── eda.ipynb            # auto-generated EDA, outputs pre-executed
├── db/
│   └── connection.py        # DB connection boilerplate (if DB selected)
├── pyproject.toml
├── Makefile
├── .env                     # credentials you entered (gitignored)
├── .env.example             # placeholder values (safe to commit)
└── .gitignore
```

### Makefile targets

```bash
make install      # uv sync
make run          # uv run jupyter lab notebooks/
make db-init      # uv run python db/connection.py
make db-generate  # uv run prisma generate  (Prisma only)
make clean        # remove .venv, __pycache__, .ruff_cache
```

## Requirements

- Node.js >= 18
- [uv](https://docs.astral.sh/uv/getting-started/installation/) installed

## Dev

```bash
pnpm install
pnpm dev my-project
pnpm dev my-project --data ./sample.csv
pnpm dev my-project --url https://example.com/data.csv
```

## Publish

```bash
pnpm build
npm publish
```
