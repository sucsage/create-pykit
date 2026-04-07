import fs from 'node:fs'
import path from 'node:path'
import type { CsvAnalysis } from './csv-analyzer.js'

interface GenerateOptions {
  projectName: string
  dependencies: string[]
  db: string
  csvAnalysis: CsvAnalysis | null
  csvSourcePath: string | null
  withNotebook: boolean
  outputDir: string
}

// ── pyproject.toml ────────────────────────────────────────────────────────────
function genPyproject(name: string, deps: string[], db: string): string {
  const dbDeps: Record<string, string[]> = {
    sqlite:     ['sqlalchemy'],
    postgresql: ['sqlalchemy', 'psycopg2-binary'],
    mysql:      ['sqlalchemy', 'pymysql'],
    mongodb:    ['pymongo'],
    duckdb:     ['duckdb'],
  }
  const allDeps = [...new Set([...deps, ...(dbDeps[db] ?? []), 'python-dotenv'])]

  return `[project]
name = "${name}"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
${allDeps.map(d => `  "${d}",`).join('\n')}
]

[tool.uv]
dev-dependencies = [
  "pytest",
  "ruff",
]
`
}

// ── .env.example ─────────────────────────────────────────────────────────────
function genEnvExample(db: string): string {
  const envMap: Record<string, string> = {
    postgresql: `DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=mydb\nDB_USER=postgres\nDB_PASSWORD=password`,
    mysql:      `DB_HOST=localhost\nDB_PORT=3306\nDB_NAME=mydb\nDB_USER=root\nDB_PASSWORD=password`,
    mongodb:    `MONGO_URI=mongodb://localhost:27017\nMONGO_DB=mydb`,
    sqlite:     `DB_PATH=./data/db.sqlite`,
    duckdb:     `DUCKDB_PATH=./data/db.duckdb`,
  }
  return envMap[db] ?? '# No database configured\n'
}

// ── db/connection.py ──────────────────────────────────────────────────────────
function genDbConnection(db: string): string | null {
  if (db === 'none') return null

  const templates: Record<string, string> = {
    sqlite: `from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DB_PATH = os.getenv("DB_PATH", "./data/db.sqlite")
engine = create_engine(f"sqlite:///{DB_PATH}")

def get_connection():
    return engine.connect()

if __name__ == "__main__":
    with get_connection() as conn:
        result = conn.execute(text("SELECT sqlite_version()"))
        print("SQLite version:", result.fetchone()[0])
`,
    postgresql: `from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DB_URL = (
    f"postgresql+psycopg2://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', 5432)}/{os.getenv('DB_NAME')}"
)
engine = create_engine(DB_URL)

def get_connection():
    return engine.connect()

if __name__ == "__main__":
    with get_connection() as conn:
        result = conn.execute(text("SELECT version()"))
        print("PostgreSQL:", result.fetchone()[0])
`,
    mysql: `from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DB_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', 3306)}/{os.getenv('DB_NAME')}"
)
engine = create_engine(DB_URL)

def get_connection():
    return engine.connect()

if __name__ == "__main__":
    with get_connection() as conn:
        result = conn.execute(text("SELECT VERSION()"))
        print("MySQL:", result.fetchone()[0])
`,
    mongodb: `from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client[os.getenv("MONGO_DB", "mydb")]

def get_db():
    return db

if __name__ == "__main__":
    print("MongoDB collections:", db.list_collection_names())
`,
    duckdb: `import duckdb
from dotenv import load_dotenv
import os

load_dotenv()

DB_PATH = os.getenv("DUCKDB_PATH", "./data/db.duckdb")
conn = duckdb.connect(DB_PATH)

def get_connection():
    return conn

if __name__ == "__main__":
    # DuckDB can query CSV directly
    result = conn.execute("SELECT version()").fetchone()
    print("DuckDB version:", result[0])

    # Example: query CSV directly
    # conn.execute("SELECT * FROM read_csv_auto('./data/data.csv') LIMIT 5").df()
`,
  }
  return templates[db] ?? null
}

// ── src/analysis.py ───────────────────────────────────────────────────────────
function genAnalysis(analysis: CsvAnalysis | null, hasData: boolean): string {
  if (!analysis || !hasData) {
    return `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Load your data
df = pd.read_csv("data/data.csv")

print(df.shape)
print(df.dtypes)
print(df.describe())
`
  }

  const numericCols = analysis.columns.filter(c => c.type === 'numeric').map(c => c.name)
  const catCols = analysis.columns.filter(c => c.type === 'categorical').map(c => c.name)
  const dateCols = analysis.columns.filter(c => c.type === 'date').map(c => c.name)

  let code = `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# ── Load data ─────────────────────────────────────────────────────────────────
df = pd.read_csv("data/data.csv")
print(f"Shape: {df.shape}")
print(df.head())

# ── Basic info ────────────────────────────────────────────────────────────────
print("\\nData types:")
print(df.dtypes)
print("\\nMissing values:")
print(df.isnull().sum())

`

  if (numericCols.length > 0) {
    code += `# ── Numeric columns: ${numericCols.join(', ')} ─────────────────────────────────
print("\\nDescriptive stats:")
print(df[${JSON.stringify(numericCols)}].describe())

`
    if (numericCols.length > 1) {
      code += `# Correlation heatmap
plt.figure(figsize=(10, 6))
sns.heatmap(df[${JSON.stringify(numericCols)}].corr(), annot=True, fmt=".2f", cmap="coolwarm")
plt.title("Correlation Matrix")
plt.tight_layout()
plt.savefig("data/correlation.png")
plt.show()

`
    }
  }

  if (catCols.length > 0) {
    code += `# ── Categorical columns: ${catCols.join(', ')} ────────────────────────────────
`
    catCols.slice(0, 2).forEach(col => {
      code += `print("\\n${col} value counts:")
print(df["${col}"].value_counts())

`
    })
  }

  if (dateCols.length > 0) {
    const dateCol = dateCols[0]
    code += `# ── Time series: ${dateCol} ─────────────────────────────────────────────────
df["${dateCol}"] = pd.to_datetime(df["${dateCol}"])
df = df.sort_values("${dateCol}")
print("\\nDate range:", df["${dateCol}"].min(), "to", df["${dateCol}"].max())

`
  }

  return code
}

// ── notebooks/eda.ipynb ───────────────────────────────────────────────────────
function genNotebook(analysis: CsvAnalysis | null): string {
  const cells = [
    {
      cell_type: 'markdown',
      source: ['# EDA Notebook\n', 'Exploratory Data Analysis'],
    },
    {
      cell_type: 'code',
      source: [
        'import pandas as pd\n',
        'import numpy as np\n',
        'import matplotlib.pyplot as plt\n',
        'import seaborn as sns\n',
        '\n',
        'df = pd.read_csv("../data/data.csv")\n',
        'df.head()',
      ],
    },
    {
      cell_type: 'code',
      source: ['df.info()\n', 'df.describe()'],
    },
    {
      cell_type: 'code',
      source: [
        '# Missing values\n',
        'df.isnull().sum().plot(kind="bar")\n',
        'plt.title("Missing Values")\n',
        'plt.show()',
      ],
    },
  ]

  if (analysis?.hasNumeric) {
    const numCols = analysis.columns.filter(c => c.type === 'numeric').map(c => c.name)
    cells.push({
      cell_type: 'code',
      source: [
        `# Correlation\n`,
        `sns.heatmap(df[${JSON.stringify(numCols)}].corr(), annot=True, cmap="coolwarm")\n`,
        `plt.show()`,
      ],
    })
  }

  return JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.11.0' },
    },
    cells: cells.map((c, i) => ({
      ...c,
      metadata: {},
      id: `cell-${i}`,
      ...(c.cell_type === 'code' ? { outputs: [], execution_count: null } : {}),
    })),
  }, null, 2)
}

// ── Makefile ──────────────────────────────────────────────────────────────────
function genMakefile(db: string, withNotebook: boolean): string {
  let content = `.PHONY: install run notebook db-init clean

install:
\tuv sync

run:
\tuv run python src/analysis.py

`
  if (withNotebook) {
    content += `notebook:
\tuv run jupyter lab notebooks/

`
  }
  if (db !== 'none') {
    content += `db-init:
\tuv run python db/connection.py

`
  }
  content += `clean:
\trm -rf .venv __pycache__ .ruff_cache
`
  return content
}

// ── README.md ─────────────────────────────────────────────────────────────────
function genReadme(name: string, db: string, withNotebook: boolean): string {
  return `# ${name}

Generated by [create-pykit](https://npmjs.com/package/create-pykit)

## Setup

\`\`\`bash
make install
\`\`\`

## Run

\`\`\`bash
make run
${withNotebook ? 'make notebook' : ''}
${db !== 'none' ? 'make db-init' : ''}
\`\`\`

## Structure

\`\`\`
${name}/
├── data/           # datasets
├── src/            # analysis scripts
├── notebooks/      # Jupyter notebooks
${db !== 'none' ? '├── db/             # database connection\n' : ''}├── pyproject.toml
├── Makefile
└── .env.example
\`\`\`
`
}

// ── Main generate ─────────────────────────────────────────────────────────────
export function generate(opts: GenerateOptions) {
  const { projectName, dependencies, db, csvAnalysis, csvSourcePath, withNotebook, outputDir } = opts

  fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(outputDir, 'src'), { recursive: true })
  if (withNotebook) fs.mkdirSync(path.join(outputDir, 'notebooks'), { recursive: true })
  if (db !== 'none') fs.mkdirSync(path.join(outputDir, 'db'), { recursive: true })

  // Copy CSV
  if (csvSourcePath && fs.existsSync(csvSourcePath)) {
    fs.copyFileSync(csvSourcePath, path.join(outputDir, 'data', path.basename(csvSourcePath)))
  }

  // pyproject.toml
  fs.writeFileSync(path.join(outputDir, 'pyproject.toml'), genPyproject(projectName, dependencies, db))

  // .env + .env.example
  fs.writeFileSync(path.join(outputDir, '.env.example'), genEnvExample(db))
  fs.writeFileSync(path.join(outputDir, '.env'), genEnvExample(db))

  // db/connection.py
  const dbCode = genDbConnection(db)
  if (dbCode) fs.writeFileSync(path.join(outputDir, 'db', 'connection.py'), dbCode)

  // src/analysis.py
  fs.writeFileSync(
    path.join(outputDir, 'src', 'analysis.py'),
    genAnalysis(csvAnalysis, !!csvSourcePath)
  )

  // notebooks/eda.ipynb
  if (withNotebook) {
    fs.writeFileSync(
      path.join(outputDir, 'notebooks', 'eda.ipynb'),
      genNotebook(csvAnalysis)
    )
  }

  // Makefile
  fs.writeFileSync(path.join(outputDir, 'Makefile'), genMakefile(db, withNotebook))

  // README.md
  fs.writeFileSync(path.join(outputDir, 'README.md'), genReadme(projectName, db, withNotebook))

  // .gitignore
  fs.writeFileSync(path.join(outputDir, '.gitignore'), `.venv\n.env\n__pycache__\n*.pyc\n.ruff_cache\ndata/*.duckdb\n`)
}
