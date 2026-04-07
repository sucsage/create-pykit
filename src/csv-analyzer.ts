import fs from 'node:fs'

export interface ColumnInfo {
  name: string
  type: 'numeric' | 'date' | 'categorical' | 'boolean' | 'id'
  sample: string
  nullCount: number
  uniqueCount: number
  // numeric only
  min?: number
  max?: number
  mean?: number
  // categorical only
  topValues?: string[]
}

export interface CsvAnalysis {
  columns: ColumnInfo[]
  rowCount: number
  hasDate: boolean
  hasNumeric: boolean
  hasCategorical: boolean
  fileName: string
}

function detectType(
  values: string[],
  uniqueCount: number,
  totalCount: number,
): ColumnInfo['type'] {
  const sample = values.filter(v => v.trim() !== '').slice(0, 50)
  if (sample.length === 0) return 'categorical'

  // Boolean
  const boolSet = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'])
  if (sample.every(v => boolSet.has(v.toLowerCase()))) return 'boolean'

  // Numeric
  const numericCount = sample.filter(v => !isNaN(Number(v)) && v.trim() !== '').length
  if (numericCount / sample.length > 0.8) {
    // High cardinality numeric that looks like an ID
    if (uniqueCount / totalCount > 0.95 && uniqueCount > 100) return 'id'
    return 'numeric'
  }

  // Date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{4}\/\d{2}\/\d{2}/,
    /^\d{2}-\d{2}-\d{4}/,
  ]
  const dateCount = sample.filter(v => datePatterns.some(p => p.test(v))).length
  if (dateCount / sample.length > 0.8) return 'date'

  // ID-like string (high cardinality, looks like UUID or code)
  if (uniqueCount / totalCount > 0.95 && uniqueCount > 100) return 'id'

  return 'categorical'
}

export function analyzeCsv(filePath: string): CsvAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  const rows = lines.slice(1).map(l => {
    // Simple CSV split — handles basic quoted fields
    const result: string[] = []
    let current = ''
    let inQuote = false
    for (const ch of l) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue }
      current += ch
    }
    result.push(current.trim())
    return result
  })

  const rowCount = rows.length

  const columns: ColumnInfo[] = headers.map((name, i) => {
    const rawValues = rows.map(r => r[i] ?? '')
    const nullCount = rawValues.filter(v => v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'nan' || v.toLowerCase() === 'na').length
    const nonNull = rawValues.filter(v => v !== '' && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'nan' && v.toLowerCase() !== 'na')
    const uniqueCount = new Set(nonNull).size

    const type = detectType(nonNull, uniqueCount, rowCount)

    const col: ColumnInfo = {
      name,
      type,
      sample: nonNull[0] ?? '',
      nullCount,
      uniqueCount,
    }

    if (type === 'numeric') {
      const nums = nonNull.map(Number).filter(n => !isNaN(n))
      if (nums.length > 0) {
        col.min = Math.min(...nums)
        col.max = Math.max(...nums)
        col.mean = nums.reduce((a, b) => a + b, 0) / nums.length
      }
    }

    if (type === 'categorical' || type === 'boolean') {
      const freq: Record<string, number> = {}
      for (const v of nonNull) freq[v] = (freq[v] ?? 0) + 1
      col.topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([v]) => v)
    }

    return col
  })

  return {
    columns,
    rowCount,
    hasDate: columns.some(c => c.type === 'date'),
    hasNumeric: columns.some(c => c.type === 'numeric'),
    hasCategorical: columns.some(c => c.type === 'categorical'),
    fileName: filePath.split('/').pop() ?? 'data.csv',
  }
}
