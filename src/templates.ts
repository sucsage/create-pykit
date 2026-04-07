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
  { value: 'none',       label: 'None',       hint: 'ไม่ใช้ database' },
  { value: 'sqlite',     label: 'SQLite',     hint: 'sqlalchemy + local file' },
  { value: 'postgresql', label: 'PostgreSQL', hint: 'sqlalchemy + psycopg2' },
  { value: 'mysql',      label: 'MySQL',      hint: 'sqlalchemy + pymysql' },
  { value: 'mongodb',    label: 'MongoDB',    hint: 'pymongo' },
  { value: 'duckdb',     label: 'DuckDB',     hint: 'analytics-first, query CSV directly' },
]
