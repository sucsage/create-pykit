import fs from 'node:fs'
import path from 'node:path'
import type { CsvAnalysis } from './csv-analyzer.js'
import { BASE_DEPS } from './templates.js'

interface GenerateOptions {
  projectName: string
  dependencies: string[]
  db: string
  dbCredentials: Record<string, string>
  csvAnalysis: CsvAnalysis | null
  csvSourcePath: string | null
  outputDir: string
}

// ── pyproject.toml ────────────────────────────────────────────────────────────
function genPyproject(name: string, deps: string[], db: string): string {
  const dbDeps: Record<string, string[]> = {
    sqlite:          ['sqlalchemy'],
    postgresql:      ['sqlalchemy', 'psycopg2-binary'],
    mysql:           ['sqlalchemy', 'pymysql'],
    mongodb:         ['pymongo'],
    duckdb:          ['duckdb'],
    'mongodb-atlas': ['pymongo'],
    supabase:        ['supabase'],
    neon:            ['sqlalchemy', 'psycopg2-binary'],
    firebase:        ['firebase-admin'],
    redis:           ['redis'],
    prisma:          ['prisma'],
  }
  const allDeps = [...new Set([...BASE_DEPS, ...deps, ...(dbDeps[db] ?? [])])]

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

// ── .env / .env.example ───────────────────────────────────────────────────────
const ENV_DEFAULTS: Record<string, Record<string, string>> = {
  sqlite:          { DB_PATH: './data/db.sqlite' },
  duckdb:          { DUCKDB_PATH: './data/db.duckdb' },
  postgresql:      { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'mydb', DB_USER: 'postgres', DB_PASSWORD: 'password' },
  mysql:           { DB_HOST: 'localhost', DB_PORT: '3306', DB_NAME: 'mydb', DB_USER: 'root', DB_PASSWORD: 'password' },
  mongodb:         { MONGO_URI: 'mongodb://localhost:27017', MONGO_DB: 'mydb' },
  'mongodb-atlas': { MONGO_URI: 'mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net', MONGO_DB: 'mydb' },
  supabase:        { SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co', SUPABASE_KEY: 'your-anon-key' },
  neon:            { DATABASE_URL: 'postgresql://<user>:<password>@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require' },
  firebase:        { FIREBASE_CREDENTIALS: 'firebase-credentials.json' },
  redis:           { REDIS_URL: 'redis://localhost:6379' },
  prisma:          { DATABASE_URL: 'postgresql://<user>:<password>@host:5432/dbname' },
}

function genEnvContent(db: string, credentials: Record<string, string>, forExample: boolean): string {
  const defaults = ENV_DEFAULTS[db]
  if (!defaults) return '# No database configured\n'
  return Object.entries(defaults)
    .map(([key, fallback]) => {
      const val = credentials[key] ?? fallback
      return forExample ? `${key}=${fallback}` : `${key}=${val}`
    })
    .join('\n') + '\n'
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
    result = conn.execute("SELECT version()").fetchone()
    print("DuckDB version:", result[0])
`,
    'mongodb-atlas': `from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("MONGO_DB", "mydb")]

def get_db():
    return db

if __name__ == "__main__":
    print("MongoDB Atlas collections:", db.list_collection_names())
`,
    supabase: `from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def get_client() -> Client:
    return supabase
`,
    neon: `from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(
    os.getenv("DATABASE_URL"),
    connect_args={"sslmode": "require"},
)

def get_connection():
    return engine.connect()

if __name__ == "__main__":
    with get_connection() as conn:
        result = conn.execute(text("SELECT version()"))
        print("Neon PostgreSQL:", result.fetchone()[0])
`,
    firebase: `import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os

load_dotenv()

cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS", "firebase-credentials.json"))
firebase_admin.initialize_app(cred)
db = firestore.client()

def get_db():
    return db
`,
    redis: `import redis
from dotenv import load_dotenv
import os

load_dotenv()

r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)

def get_client() -> redis.Redis:
    return r
`,
    prisma: `from prisma import Prisma
import asyncio

db = Prisma()

async def connect():
    await db.connect()

async def disconnect():
    await db.disconnect()
`,
  }
  return templates[db] ?? null
}

// ── DB → CSV export notebook cells ───────────────────────────────────────────
function genDbExportCells(db: string): NotebookCell[] {
  if (db === 'none') return []

  const mdCell = (source: string[]): NotebookCell => ({ cell_type: 'markdown', source })
  const codeCell = (source: string[]): NotebookCell => ({ cell_type: 'code', source })

  const cells: NotebookCell[] = [
    mdCell([`## Export from ${dbLabel(db)}\n`, 'Connect to the database and export tables to CSV files in `../data/db_export/`.']),
  ]

  if (db === 'sqlite') {
    cells.push(codeCell([
      'import os, pandas as pd\n',
      'from sqlalchemy import create_engine, inspect, text\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'engine = create_engine(f"sqlite:///{os.getenv(\'DB_PATH\', \'../data/db.sqlite\')}")\n',
      'inspector = inspect(engine)\n',
      'tables = inspector.get_table_names()\n',
      'print("Tables found:", tables)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for table in tables:\n',
      '    df_t = pd.read_sql(f"SELECT * FROM {table}", engine)\n',
      '    df_t.to_csv(f"../data/db_export/{table}.csv", index=False)\n',
      '    print(f"  ✓ {table}: {len(df_t):,} rows → data/db_export/{table}.csv")\n',
    ]))
  } else if (db === 'duckdb') {
    cells.push(codeCell([
      'import os, pandas as pd, duckdb\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'conn = duckdb.connect(os.getenv("DUCKDB_PATH", "../data/db.duckdb"))\n',
      'tables = conn.execute("SHOW TABLES").fetchdf()["name"].tolist()\n',
      'print("Tables found:", tables)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for table in tables:\n',
      '    df_t = conn.execute(f"SELECT * FROM {table}").fetchdf()\n',
      '    df_t.to_csv(f"../data/db_export/{table}.csv", index=False)\n',
      '    print(f"  ✓ {table}: {len(df_t):,} rows → data/db_export/{table}.csv")\n',
    ]))
  } else if (db === 'postgresql' || db === 'mysql' || db === 'neon') {
    const urlExpr = db === 'neon'
      ? 'os.getenv("DATABASE_URL")'
      : db === 'postgresql'
        ? '"postgresql+psycopg2://" + os.getenv("DB_USER","") + ":" + os.getenv("DB_PASSWORD","") + "@" + os.getenv("DB_HOST","localhost") + ":" + os.getenv("DB_PORT","5432") + "/" + os.getenv("DB_NAME","")'
        : '"mysql+pymysql://" + os.getenv("DB_USER","") + ":" + os.getenv("DB_PASSWORD","") + "@" + os.getenv("DB_HOST","localhost") + ":" + os.getenv("DB_PORT","3306") + "/" + os.getenv("DB_NAME","")'
    const schema = db === 'mysql' ? '"TABLE_SCHEMA = DATABASE()"' : '"schemaname = \'public\'"'
    const tableQuery = db === 'mysql'
      ? '"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"'
      : '"SELECT tablename FROM pg_tables WHERE schemaname = \'public\'"'
    cells.push(codeCell([
      'import os, pandas as pd\n',
      'from sqlalchemy import create_engine, text\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      `engine = create_engine(${urlExpr})\n`,
      '\n',
      `with engine.connect() as conn:\n`,
      `    rows = conn.execute(text(${tableQuery})).fetchall()\n`,
      '    tables = [r[0] for r in rows]\n',
      'print("Tables found:", tables)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for table in tables:\n',
      '    df_t = pd.read_sql(f"SELECT * FROM {table}", engine)\n',
      '    df_t.to_csv(f"../data/db_export/{table}.csv", index=False)\n',
      '    print(f"  ✓ {table}: {len(df_t):,} rows → data/db_export/{table}.csv")\n',
    ]))
  } else if (db === 'mongodb' || db === 'mongodb-atlas') {
    cells.push(codeCell([
      'import os, pandas as pd\n',
      'from pymongo import MongoClient\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))\n',
      'database = client[os.getenv("MONGO_DB", "mydb")]\n',
      'collections = database.list_collection_names()\n',
      'print("Collections found:", collections)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for col_name in collections:\n',
      '    docs = list(database[col_name].find({}, {"_id": 0}))\n',
      '    df_t = pd.DataFrame(docs)\n',
      '    df_t.to_csv(f"../data/db_export/{col_name}.csv", index=False)\n',
      '    print(f"  ✓ {col_name}: {len(df_t):,} docs → data/db_export/{col_name}.csv")\n',
    ]))
  } else if (db === 'supabase') {
    cells.push(codeCell([
      'import os, pandas as pd\n',
      'from supabase import create_client\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))\n',
      '\n',
      '# List tables via information_schema\n',
      'res = supabase.rpc("pg_tables_public").execute()  # or set table_name manually\n',
      '# ---- Manual approach: set your table names below ----\n',
      'table_names = ["your_table"]  # replace with actual table names\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for table in table_names:\n',
      '    res = supabase.table(table).select("*").execute()\n',
      '    df_t = pd.DataFrame(res.data)\n',
      '    df_t.to_csv(f"../data/db_export/{table}.csv", index=False)\n',
      '    print(f"  ✓ {table}: {len(df_t):,} rows → data/db_export/{table}.csv")\n',
    ]))
  } else if (db === 'firebase') {
    cells.push(codeCell([
      'import os, pandas as pd, firebase_admin\n',
      'from firebase_admin import credentials, firestore\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'if not firebase_admin._apps:\n',
      '    cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS", "firebase-credentials.json"))\n',
      '    firebase_admin.initialize_app(cred)\n',
      'db_fs = firestore.client()\n',
      '\n',
      'collections = [c.id for c in db_fs.collections()]\n',
      'print("Collections found:", collections)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for col_name in collections:\n',
      '    docs = [doc.to_dict() for doc in db_fs.collection(col_name).stream()]\n',
      '    df_t = pd.DataFrame(docs)\n',
      '    df_t.to_csv(f"../data/db_export/{col_name}.csv", index=False)\n',
      '    print(f"  ✓ {col_name}: {len(df_t):,} docs → data/db_export/{col_name}.csv")\n',
    ]))
  } else if (db === 'prisma') {
    cells.push(codeCell([
      '# Prisma: run prisma generate first, then use prisma client\n',
      '# Or export via raw SQL using DATABASE_URL directly\n',
      'import os, pandas as pd\n',
      'from sqlalchemy import create_engine, inspect\n',
      'from dotenv import load_dotenv\n',
      'load_dotenv("../.env")\n',
      '\n',
      'engine = create_engine(os.getenv("DATABASE_URL"))\n',
      'inspector = inspect(engine)\n',
      'tables = inspector.get_table_names()\n',
      'print("Tables found:", tables)\n',
      '\n',
      'os.makedirs("../data/db_export", exist_ok=True)\n',
      'for table in tables:\n',
      '    df_t = pd.read_sql(f"SELECT * FROM {table}", engine)\n',
      '    df_t.to_csv(f"../data/db_export/{table}.csv", index=False)\n',
      '    print(f"  ✓ {table}: {len(df_t):,} rows → data/db_export/{table}.csv")\n',
    ]))
  }

  cells.push(codeCell([
    '# Load exported CSV for EDA (change filename to the table you want to analyze)\n',
    'import os\n',
    'exported = [f for f in os.listdir("../data/db_export") if f.endswith(".csv")]\n',
    'print("Exported files:", exported)\n',
    '# df = pd.read_csv(f"../data/db_export/{exported[0]}")  # uncomment to load first table\n',
  ]))

  return cells
}

function dbLabel(db: string): string {
  const labels: Record<string, string> = {
    sqlite: 'SQLite', postgresql: 'PostgreSQL', mysql: 'MySQL', duckdb: 'DuckDB',
    mongodb: 'MongoDB', 'mongodb-atlas': 'MongoDB Atlas', supabase: 'Supabase',
    neon: 'Neon', firebase: 'Firebase Firestore', redis: 'Redis', prisma: 'Prisma',
  }
  return labels[db] ?? db
}

// ── Notebook helpers ──────────────────────────────────────────────────────────
interface NotebookCell {
  cell_type: 'markdown' | 'code'
  source: string[]
}

function md(source: string[]): NotebookCell { return { cell_type: 'markdown', source } }
function code(source: string[]): NotebookCell { return { cell_type: 'code', source } }

// ── notebooks/eda.ipynb ───────────────────────────────────────────────────────
function genNotebook(analysis: CsvAnalysis | null, db: string): string {
  const cells: NotebookCell[] = []

  // ── Title ──────────────────────────────────────────────────────────────────
  cells.push(md([
    '# Exploratory Data Analysis\n',
    analysis
      ? `**Dataset:** \`${analysis.fileName}\` — ${analysis.rowCount.toLocaleString()} rows × ${analysis.columns.length} columns`
      : '**Dataset:** *(place your CSV in `../data/` and update the path below)*',
  ]))

  // ── Imports ────────────────────────────────────────────────────────────────
  cells.push(code([
    'import pandas as pd\n',
    'import numpy as np\n',
    'import matplotlib.pyplot as plt\n',
    'import matplotlib.ticker as mticker\n',
    'import seaborn as sns\n',
    'import warnings\n',
    'warnings.filterwarnings("ignore")\n',
    '\n',
    'sns.set_theme(style="whitegrid", palette="muted")\n',
    'plt.rcParams["figure.dpi"] = 120\n',
    '%matplotlib inline\n',
  ]))

  // ── DB export section ──────────────────────────────────────────────────────
  const dbCells = genDbExportCells(db)
  cells.push(...dbCells)

  // ── Load data ──────────────────────────────────────────────────────────────
  cells.push(md(['## Load Data']))

  const csvFile = analysis?.fileName ?? 'data.csv'
  const loadPath = db !== 'none'
    ? `../data/db_export/<your_table>.csv`
    : `../data/${csvFile}`

  cells.push(code([
    `df = pd.read_csv("${loadPath}")\n`,
    'print(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")\n',
    'df.head()',
  ]))

  // ── Overview ───────────────────────────────────────────────────────────────
  cells.push(md(['## Overview']))
  cells.push(code([
    'display(df.dtypes.rename("dtype").to_frame())\n',
  ]))
  cells.push(code([
    'df.describe(include="all").T\n',
  ]))

  // ── Missing values ─────────────────────────────────────────────────────────
  cells.push(md(['## Missing Values']))

  const hasKnownNulls = analysis?.columns.some(c => c.nullCount > 0) ?? true

  if (!hasKnownNulls && analysis) {
    cells.push(code([
      'missing = df.isnull().sum()\n',
      'print("✓ No missing values detected")\n',
      'missing[missing > 0]\n',
    ]))
  } else {
    cells.push(code([
      'missing = df.isnull().sum().sort_values(ascending=False)\n',
      'missing_pct = (missing / len(df) * 100).round(2)\n',
      'missing_df = pd.DataFrame({"count": missing, "percent (%)": missing_pct})\n',
      'missing_df = missing_df[missing_df["count"] > 0]\n',
      '\n',
      'if missing_df.empty:\n',
      '    print("✓ No missing values")\n',
      'else:\n',
      '    display(missing_df)\n',
      '    fig, ax = plt.subplots(figsize=(9, max(3, len(missing_df) * 0.5)))\n',
      '    missing_df["count"].sort_values().plot(kind="barh", ax=ax, color="salmon")\n',
      '    ax.set_title("Missing Values per Column")\n',
      '    ax.set_xlabel("Count")\n',
      '    plt.tight_layout()\n',
      '    plt.show()\n',
    ]))
  }

  // ── Numeric columns ────────────────────────────────────────────────────────
  const numericCols = analysis?.columns.filter(c => c.type === 'numeric').map(c => c.name) ?? []

  if (numericCols.length > 0) {
    cells.push(md([
      `## Numeric Columns\n`,
      `Detected: \`${numericCols.join('`, `')}\``,
    ]))

    cells.push(code([
      `num_cols = ${JSON.stringify(numericCols)}\n`,
      'df[num_cols].describe().T.round(2)\n',
    ]))

    // Histograms + boxplots
    cells.push(code([
      `num_cols = ${JSON.stringify(numericCols)}\n`,
      'n = len(num_cols)\n',
      'fig, axes = plt.subplots(n, 2, figsize=(12, 4 * n))\n',
      'if n == 1: axes = [axes]\n',
      'for i, col in enumerate(num_cols):\n',
      '    axes[i][0].hist(df[col].dropna(), bins=30, color="steelblue", edgecolor="white")\n',
      '    axes[i][0].set_title(f"{col} — Distribution")\n',
      '    axes[i][0].set_xlabel(col)\n',
      '    axes[i][1].boxplot(df[col].dropna(), vert=False, patch_artist=True,\n',
      '                       boxprops=dict(facecolor="steelblue", alpha=0.6))\n',
      '    axes[i][1].set_title(f"{col} — Boxplot (outliers)")\n',
      '    axes[i][1].set_xlabel(col)\n',
      'plt.tight_layout()\n',
      'plt.show()\n',
    ]))

    // Outlier summary per column
    cells.push(code([
      `num_cols = ${JSON.stringify(numericCols)}\n`,
      'records = []\n',
      'for col in num_cols:\n',
      '    Q1, Q3 = df[col].quantile([0.25, 0.75])\n',
      '    IQR = Q3 - Q1\n',
      '    outliers = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)]\n',
      '    records.append({"column": col, "outliers": len(outliers),\n',
      '                     "outlier_%": round(len(outliers)/len(df)*100, 2),\n',
      '                     "min": df[col].min(), "max": df[col].max(),\n',
      '                     "mean": round(df[col].mean(), 2)})\n',
      'pd.DataFrame(records).set_index("column")\n',
    ]))
  } else {
    cells.push(md(['## Numeric Columns']))
    cells.push(code([
      'num_cols = df.select_dtypes(include="number").columns.tolist()\n',
      'print("Numeric columns:", num_cols)\n',
      'df[num_cols].describe().T.round(2) if num_cols else print("No numeric columns found")\n',
    ]))
  }

  // ── Categorical columns ────────────────────────────────────────────────────
  const catCols = analysis?.columns.filter(c => c.type === 'categorical').map(c => c.name) ?? []

  if (catCols.length > 0) {
    cells.push(md([
      `## Categorical Columns\n`,
      `Detected: \`${catCols.join('`, `')}\``,
    ]))

    catCols.forEach(col => {
      cells.push(md([`### \`${col}\``]))
      cells.push(code([
        `vc = df["${col}"].value_counts()\n`,
        `display(vc.to_frame("count").assign(percent=lambda x: (x["count"]/len(df)*100).round(2)))\n`,
        '\n',
        'fig, axes = plt.subplots(1, 2, figsize=(12, 4))\n',
        `vc.head(15).plot(kind="bar", ax=axes[0], color="steelblue", edgecolor="white")\n`,
        `axes[0].set_title("${col} — Top Values")\n`,
        'axes[0].set_xlabel("")\n',
        'axes[0].tick_params(axis="x", rotation=45)\n',
        `(vc.head(8) if len(vc) > 8 else vc).plot(\n`,
        '    kind="pie", ax=axes[1], autopct="%1.1f%%", startangle=90\n',
        ')\n',
        `axes[1].set_title("${col} — Share")\n`,
        'axes[1].set_ylabel("")\n',
        'plt.tight_layout()\n',
        'plt.show()\n',
      ]))
    })
  } else {
    cells.push(md(['## Categorical Columns']))
    cells.push(code([
      'cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()\n',
      'print("Categorical columns:", cat_cols)\n',
      'for col in cat_cols[:3]:\n',
      '    print(f"\\n{col}:")\n',
      '    display(df[col].value_counts().head(10))\n',
    ]))
  }

  // ── Date / Time series ─────────────────────────────────────────────────────
  const dateCols = analysis?.columns.filter(c => c.type === 'date').map(c => c.name) ?? []

  if (dateCols.length > 0) {
    const dateCol = dateCols[0]
    cells.push(md([`## Time Series — \`${dateCol}\``]))

    cells.push(code([
      `df["${dateCol}"] = pd.to_datetime(df["${dateCol}"])\n`,
      `df = df.sort_values("${dateCol}")\n`,
      `print(f"Date range: {df['${dateCol}'].min().date()}  →  {df['${dateCol}'].max().date()}")\n`,
      `print(f"Span: {(df['${dateCol}'].max() - df['${dateCol}'].min()).days} days")\n`,
    ]))

    if (numericCols.length > 0) {
      const targetCol = numericCols[0]
      cells.push(code([
        `df["_month"] = df["${dateCol}"].dt.to_period("M")\n`,
        `monthly = df.groupby("_month")["${targetCol}"].agg(["sum", "mean", "count"])\n`,
        'display(monthly.tail(12))\n',
        '\n',
        'fig, axes = plt.subplots(2, 1, figsize=(13, 7))\n',
        `monthly["sum"].plot(ax=axes[0], marker="o", linewidth=1.5, markersize=3)\n`,
        `axes[0].set_title("Monthly Total — ${targetCol}")\n`,
        `monthly["count"].plot(ax=axes[1], marker="o", color="orange", linewidth=1.5, markersize=3)\n`,
        `axes[1].set_title("Monthly Row Count")\n`,
        'for ax in axes:\n',
        '    ax.tick_params(axis="x", rotation=45)\n',
        '    ax.grid(True, alpha=0.3)\n',
        'plt.tight_layout()\n',
        'plt.show()\n',
        'df.drop(columns=["_month"], inplace=True)\n',
      ]))
    } else {
      cells.push(code([
        `df["_month"] = df["${dateCol}"].dt.to_period("M")\n`,
        'monthly_count = df.groupby("_month").size()\n',
        '\n',
        'fig, ax = plt.subplots(figsize=(13, 4))\n',
        'monthly_count.plot(ax=ax, marker="o", linewidth=1.5, markersize=3)\n',
        'ax.set_title("Monthly Row Count")\n',
        'ax.tick_params(axis="x", rotation=45)\n',
        'ax.grid(True, alpha=0.3)\n',
        'plt.tight_layout()\n',
        'plt.show()\n',
        'df.drop(columns=["_month"], inplace=True)\n',
      ]))
    }
  } else {
    cells.push(md(['## Time Series']))
    cells.push(code([
      '# Auto-detect date columns\n',
      'date_candidates = df.select_dtypes(include=["object"]).columns\n',
      'for col in date_candidates:\n',
      '    try:\n',
      '        pd.to_datetime(df[col].head(20))\n',
      '        print(f"Possible date column: {col}")\n',
      '    except Exception:\n',
      '        pass\n',
    ]))
  }

  // ── Correlation matrix ─────────────────────────────────────────────────────
  if (numericCols.length > 1) {
    cells.push(md([`## Correlation Matrix\n`, `Columns: \`${numericCols.join('`, `')}\``]))
    cells.push(code([
      `num_cols = ${JSON.stringify(numericCols)}\n`,
      'corr = df[num_cols].corr()\n',
      '\n',
      `fig, ax = plt.subplots(figsize=(max(6, len(num_cols)), max(5, len(num_cols) - 1)))\n`,
      'mask = np.triu(np.ones_like(corr, dtype=bool))\n',
      'sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm",\n',
      '            mask=mask, ax=ax, linewidths=0.5,\n',
      '            vmin=-1, vmax=1, center=0)\n',
      'ax.set_title("Correlation Matrix")\n',
      'plt.tight_layout()\n',
      'plt.show()\n',
      '\n',
      '# High correlations (|r| > 0.7)\n',
      'high_corr = (\n',
      '    corr.where(np.tril(np.ones(corr.shape), k=-1).astype(bool))\n',
      '    .stack()\n',
      '    .reset_index()\n',
      ')\n',
      'high_corr.columns = ["col_a", "col_b", "r"]\n',
      'high_corr = high_corr[high_corr["r"].abs() > 0.7].sort_values("r", key=abs, ascending=False)\n',
      'if not high_corr.empty:\n',
      '    print("⚠ High correlations (|r| > 0.7):")\n',
      '    display(high_corr)\n',
      'else:\n',
      '    print("✓ No high correlations found")\n',
    ]))
  }

  // ── Summary export ─────────────────────────────────────────────────────────
  cells.push(md(['## Summary Export']))
  cells.push(code([
    'import datetime\n',
    '\n',
    'lines = [\n',
    '    f"EDA Summary — generated {datetime.datetime.now():%Y-%m-%d %H:%M}",\n',
    '    f"Dataset: {df.shape[0]:,} rows × {df.shape[1]} columns",\n',
    '    "",\n',
    '    "=== Column Types ===",\n',
    '    df.dtypes.to_string(),\n',
    '    "",\n',
    '    "=== Descriptive Stats ===",\n',
    '    df.describe(include="all").to_string(),\n',
    '    "",\n',
    '    "=== Missing Values ===",\n',
    '    df.isnull().sum().to_string(),\n',
    ']\n',
    'with open("../data/eda_summary.txt", "w") as f:\n',
    '    f.write("\\n".join(lines))\n',
    'print("✓ Summary exported → data/eda_summary.txt")\n',
  ]))

  // ── Serialise ──────────────────────────────────────────────────────────────
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
function genMakefile(db: string): string {
  let content = `.PHONY: install run db-export db-init clean

install:
\tuv sync

run:
\tuv run jupyter lab notebooks/

`
  if (db === 'prisma') {
    content += `db-generate:
\tuv run prisma generate

db-init:
\tuv run prisma db push
\tuv run python db/connection.py

`
  } else if (db !== 'none') {
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
function genReadme(name: string, db: string, hasData: boolean): string {
  return `# ${name}

Generated by [create-pykit](https://npmjs.com/package/create-pykit)

## Setup

\`\`\`bash
make install
\`\`\`

## Open notebook

\`\`\`bash
${hasData ? '# Outputs already pre-executed — just open the file\n' : ''}open notebooks/eda.ipynb
# or launch Jupyter Lab
make run
\`\`\`

${db !== 'none' ? `## Database

\`\`\`bash
cp .env.example .env   # fill in your credentials
make db-init           # test connection + verify setup
\`\`\`

The notebook includes an **Export to CSV** cell that clones every table into \`data/db_export/\`.

` : ''}\
## Structure

\`\`\`
${name}/
├── data/
│   ├── ${hasData ? '*.csv                  # your dataset' : '                       # place your CSV here'}
${db !== 'none' ? '│   └── db_export/             # tables exported from DB\n' : ''}\
├── notebooks/
│   └── eda.ipynb              # EDA notebook${hasData ? ' (outputs pre-executed)' : ''}
${db !== 'none' ? '├── db/\n│   └── connection.py         # DB connection\n' : ''}\
├── pyproject.toml
├── Makefile
├── .env.example
└── .gitignore
\`\`\`

## Makefile

\`\`\`bash
make install      # uv sync
make run          # open Jupyter Lab
${db !== 'none' ? 'make db-init      # test DB connection\n' : ''}\
make clean        # remove .venv, __pycache__
\`\`\`
`
}

// ── Main generate ─────────────────────────────────────────────────────────────
export function generate(opts: GenerateOptions) {
  const { projectName, dependencies, db, dbCredentials, csvAnalysis, csvSourcePath, outputDir } = opts

  fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(outputDir, 'notebooks'), { recursive: true })
  if (db !== 'none') {
    fs.mkdirSync(path.join(outputDir, 'db'), { recursive: true })
    fs.mkdirSync(path.join(outputDir, 'data', 'db_export'), { recursive: true })
  }

  // Copy CSV
  if (csvSourcePath && fs.existsSync(csvSourcePath)) {
    fs.copyFileSync(csvSourcePath, path.join(outputDir, 'data', path.basename(csvSourcePath)))
  }

  // pyproject.toml
  fs.writeFileSync(path.join(outputDir, 'pyproject.toml'), genPyproject(projectName, dependencies, db))

  // .env + .env.example
  fs.writeFileSync(path.join(outputDir, '.env.example'), genEnvContent(db, {}, true))
  fs.writeFileSync(path.join(outputDir, '.env'), genEnvContent(db, dbCredentials, false))

  // db/connection.py
  const dbCode = genDbConnection(db)
  if (dbCode) fs.writeFileSync(path.join(outputDir, 'db', 'connection.py'), dbCode)

  // schema.prisma (Prisma only)
  if (db === 'prisma') {
    fs.writeFileSync(path.join(outputDir, 'schema.prisma'), `generator client {
  provider             = "prisma-client-py"
  interface            = "asyncio"
  recursive_type_depth = 5
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// model User {
//   id    Int    @id @default(autoincrement())
//   name  String
//   email String @unique
// }
`)
  }

  // notebooks/eda.ipynb
  fs.writeFileSync(
    path.join(outputDir, 'notebooks', 'eda.ipynb'),
    genNotebook(csvAnalysis, db)
  )

  // Makefile
  fs.writeFileSync(path.join(outputDir, 'Makefile'), genMakefile(db))

  // README.md
  fs.writeFileSync(path.join(outputDir, 'README.md'), genReadme(projectName, db, !!csvSourcePath))

  // .gitignore
  fs.writeFileSync(
    path.join(outputDir, '.gitignore'),
    `.venv\n.env\n__pycache__\n*.pyc\n.ruff_cache\ndata/*.duckdb\ndata/db_export/\n`
  )
}
