export interface DbField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
}

export const DB_FIELDS: Record<string, DbField[]> = {
  sqlite:          [{ key: 'DB_PATH',              label: 'SQLite file path',         placeholder: './data/db.sqlite' }],
  duckdb:          [{ key: 'DUCKDB_PATH',           label: 'DuckDB file path',         placeholder: './data/db.duckdb' }],
  postgresql: [
    { key: 'DB_HOST',     label: 'Host',          placeholder: 'localhost' },
    { key: 'DB_PORT',     label: 'Port',          placeholder: '5432' },
    { key: 'DB_NAME',     label: 'Database name', placeholder: 'mydb' },
    { key: 'DB_USER',     label: 'Username',      placeholder: 'postgres' },
    { key: 'DB_PASSWORD', label: 'Password',      placeholder: 'password', secret: true },
  ],
  mysql: [
    { key: 'DB_HOST',     label: 'Host',          placeholder: 'localhost' },
    { key: 'DB_PORT',     label: 'Port',          placeholder: '3306' },
    { key: 'DB_NAME',     label: 'Database name', placeholder: 'mydb' },
    { key: 'DB_USER',     label: 'Username',      placeholder: 'root' },
    { key: 'DB_PASSWORD', label: 'Password',      placeholder: 'password', secret: true },
  ],
  mongodb:         [
    { key: 'MONGO_URI', label: 'MongoDB URI',     placeholder: 'mongodb://localhost:27017' },
    { key: 'MONGO_DB',  label: 'Database name',   placeholder: 'mydb' },
  ],
  'mongodb-atlas': [
    { key: 'MONGO_URI', label: 'Atlas connection string', placeholder: 'mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net' },
    { key: 'MONGO_DB',  label: 'Database name',          placeholder: 'mydb' },
  ],
  supabase: [
    { key: 'SUPABASE_URL', label: 'Supabase project URL', placeholder: 'https://xxxxxxxxxxxx.supabase.co' },
    { key: 'SUPABASE_KEY', label: 'Anon/service key',     placeholder: 'your-anon-key', secret: true },
  ],
  neon:     [{ key: 'DATABASE_URL',          label: 'Neon connection string',   placeholder: 'postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require' }],
  firebase: [{ key: 'FIREBASE_CREDENTIALS', label: 'Credentials JSON path',    placeholder: 'firebase-credentials.json' }],
  redis:    [{ key: 'REDIS_URL',             label: 'Redis URL',                placeholder: 'redis://localhost:6379' }],
  prisma:   [{ key: 'DATABASE_URL',          label: 'Database URL (Prisma)',    placeholder: 'postgresql://user:password@host:5432/dbname' }],
}

export interface Template {
  label: string
  hint: string
  dependencies: string[]
}

export const TEMPLATES: Record<string, Template> = {
  'data-analysis': {
    label: 'Data Analysis',
    hint: 'pandas, numpy, matplotlib, seaborn',
    dependencies: ['pandas', 'numpy', 'matplotlib', 'seaborn', 'jupyterlab'],
  },
  'machine-learning': {
    label: 'Machine Learning',
    hint: 'scikit-learn, xgboost, pandas, numpy',
    dependencies: ['pandas', 'numpy', 'scikit-learn', 'xgboost', 'matplotlib', 'seaborn', 'jupyterlab'],
  },
  'deep-learning': {
    label: 'Deep Learning',
    hint: 'torch, torchvision, pandas, numpy',
    dependencies: ['torch', 'torchvision', 'pandas', 'numpy', 'matplotlib', 'jupyterlab'],
  },
  'nlp': {
    label: 'NLP',
    hint: 'transformers, spacy, pandas',
    dependencies: ['transformers', 'spacy', 'pandas', 'numpy', 'jupyterlab'],
  },
  'computer-vision': {
    label: 'Computer Vision',
    hint: 'opencv-python, torchvision, pillow',
    dependencies: ['opencv-python', 'torchvision', 'pillow', 'numpy', 'matplotlib', 'jupyterlab'],
  },
  'custom': {
    label: 'Custom',
    hint: 'เลือก dependencies เอง',
    dependencies: [],
  },
}

export const ALL_DEPS = [
  { value: 'pandas',          label: 'pandas',          hint: 'DataFrame, data manipulation' },
  { value: 'numpy',           label: 'numpy',           hint: 'numerical computing' },
  { value: 'matplotlib',      label: 'matplotlib',      hint: 'plotting' },
  { value: 'seaborn',         label: 'seaborn',         hint: 'statistical visualization' },
  { value: 'scikit-learn',    label: 'scikit-learn',    hint: 'ML algorithms' },
  { value: 'xgboost',         label: 'xgboost',         hint: 'gradient boosting' },
  { value: 'torch',           label: 'torch',           hint: 'PyTorch deep learning' },
  { value: 'torchvision',     label: 'torchvision',     hint: 'vision models + datasets' },
  { value: 'transformers',    label: 'transformers',    hint: 'HuggingFace NLP models' },
  { value: 'spacy',           label: 'spacy',           hint: 'NLP pipeline' },
  { value: 'opencv-python',   label: 'opencv-python',   hint: 'computer vision' },
  { value: 'pillow',          label: 'pillow',          hint: 'image processing' },
  { value: 'plotly',          label: 'plotly',          hint: 'interactive charts' },
  { value: 'jupyterlab',      label: 'jupyterlab',      hint: 'Jupyter Lab' },
  { value: 'python-dotenv',   label: 'python-dotenv',   hint: 'load .env files' },
  { value: 'loguru',          label: 'loguru',          hint: 'better logging' },
]

export const DB_OPTIONS = [
  // ── Local ────────────────────────────────────────────────────────────────────
  { value: 'none',            label: 'None',              hint: 'ไม่ใช้ database' },
  { value: 'sqlite',          label: 'SQLite',            hint: 'sqlalchemy + local file' },
  { value: 'duckdb',          label: 'DuckDB',            hint: 'analytics-first, query CSV directly' },
  // ── Self-hosted ───────────────────────────────────────────────────────────────
  { value: 'postgresql',      label: 'PostgreSQL',        hint: 'sqlalchemy + psycopg2' },
  { value: 'mysql',           label: 'MySQL',             hint: 'sqlalchemy + pymysql' },
  { value: 'mongodb',         label: 'MongoDB',           hint: 'pymongo (self-hosted)' },
  // ── Cloud / Online ────────────────────────────────────────────────────────────
  { value: 'mongodb-atlas',   label: 'MongoDB Atlas',     hint: 'pymongo + Atlas connection string' },
  { value: 'supabase',        label: 'Supabase',          hint: 'supabase-py (Postgres cloud)' },
  { value: 'neon',            label: 'Neon',              hint: 'sqlalchemy + psycopg2 (serverless Postgres)' },
  { value: 'firebase',        label: 'Firebase Firestore',hint: 'firebase-admin' },
  { value: 'redis',           label: 'Redis',             hint: 'redis-py (Redis / Redis Cloud)' },
  { value: 'prisma',          label: 'Prisma ORM',        hint: 'prisma Python client + DATABASE_URL' },
]
