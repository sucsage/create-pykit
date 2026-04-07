# create-pykit

Interactive CLI to scaffold Python data science projects — powered by [`uv`](https://docs.astral.sh/uv/).

## Usage

```bash
npx create-pykit
npx create-pykit my-project
npx create-pykit my-project --data /path/to/data.csv
npx create-pykit my-project --url https://example.com/data.csv
```

## Features

### Templates
| Template | Dependencies |
|---|---|
| Data Analysis | pandas, numpy, matplotlib, seaborn |
| Machine Learning | scikit-learn, xgboost, pandas, numpy |
| Deep Learning | torch, torchvision, pandas, numpy |
| NLP | transformers, spaCy, pandas |
| Computer Vision | opencv-python, torchvision, Pillow |
| Custom | เลือก dependencies เอง |

### Database support

**Local**
| | Driver |
|---|---|
| SQLite | sqlalchemy |
| DuckDB | duckdb (query CSV directly) |

**Self-hosted**
| | Driver |
|---|---|
| PostgreSQL | sqlalchemy + psycopg2 |
| MySQL | sqlalchemy + pymysql |
| MongoDB | pymongo |

**Cloud / Online**
| | Driver |
|---|---|
| MongoDB Atlas | pymongo + Atlas connection string |
| Supabase | supabase-py |
| Neon | sqlalchemy + psycopg2 (serverless Postgres) |
| Firebase Firestore | firebase-admin |
| Redis | redis-py |
| Prisma ORM | prisma Python client |

### CSV / Data
- `--data <path>` — copy a local CSV into `data/` and auto-generate `analysis.py` from real column names and types
- `--url <url>` — download a CSV from a URL (e.g. public dataset links), then analyze it the same way

### Project structure generated

```
my-project/
├── data/               # datasets (CSV copied here)
├── src/
│   └── analysis.py     # auto-generated from CSV columns
├── notebooks/
│   └── eda.ipynb       # optional Jupyter notebook
├── db/
│   └── connection.py   # database connection boilerplate
├── pyproject.toml
├── Makefile
├── .env                # filled with credentials you entered (or placeholders)
├── .env.example        # always uses placeholders (safe to commit)
└── .gitignore
```

### Makefile targets

```bash
make install      # uv sync
make run          # uv run python src/analysis.py
make notebook     # uv run jupyter lab notebooks/
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
