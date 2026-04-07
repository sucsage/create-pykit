import fs from 'node:fs'

export interface ColumnInfo {
  name: string
  type: 'numeric' | 'date' | 'categorical'
  sample: string
}

export interface CsvAnalysis {
  columns: ColumnInfo[]
  rowCount: number
  hasDate: boolean
  hasNumeric: boolean
  hasCategorical: boolean
}

function detectType(values: string[]): 'numeric' | 'date' | 'categorical' {
  const sample = values.filter(v => v.trim() !== '').slice(0, 20)

  const numericCount = sample.filter(v => !isNaN(Number(v))).length
  if (numericCount / sample.length > 0.8) return 'numeric'

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{4}\/\d{2}\/\d{2}/,
  ]
  const dateCount = sample.filter(v => datePatterns.some(p => p.test(v))).length
  if (dateCount / sample.length > 0.8) return 'date'

  return 'categorical'
}

export function analyzeCsv(filePath: string): CsvAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  const rows = lines.slice(1).map(l => l.split(',').map(v => v.trim().replace(/"/g, '')))

  const columns: ColumnInfo[] = headers.map((name, i) => {
    const values = rows.map(r => r[i] ?? '')
    const type = detectType(values)
    return { name, type, sample: values[0] ?? '' }
  })

  return {
    columns,
    rowCount: rows.length,
    hasDate: columns.some(c => c.type === 'date'),
    hasNumeric: columns.some(c => c.type === 'numeric'),
    hasCategorical: columns.some(c => c.type === 'categorical'),
  }
}
