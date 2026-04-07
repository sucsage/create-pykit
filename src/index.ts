#!/usr/bin/env node
import * as p from '@clack/prompts'
import chalk from 'chalk'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { analyzeCsv } from './csv-analyzer.js'
import { generate } from './generator.js'
import { ALL_DEPS, BASE_DEPS, DB_FIELDS, DB_OPTIONS, TEMPLATES } from './templates.js'

// ── Check uv ──────────────────────────────────────────────────────────────────
function checkUv(): boolean {
  try {
    execSync('uv --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ── Parse --data / --url flags ────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  let projectName: string | null = null
  let dataPath: string | null = null
  let dataUrl: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) {
      dataPath = args[i + 1]
      i++
    } else if (args[i] === '--url' && args[i + 1]) {
      dataUrl = args[i + 1]
      i++
    } else if (!args[i].startsWith('-')) {
      projectName = args[i]
    }
  }
  return { projectName, dataPath, dataUrl }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log()
  p.intro(chalk.bgCyan.black(' create-pykit '))

  // Check uv
  if (!checkUv()) {
    p.log.error('uv is not installed')
    p.log.info('Install uv first:')
    p.log.info('  macOS/Linux → ' + chalk.cyan('curl -LsSf https://astral.sh/uv/install.sh | sh'))
    p.log.info('  Windows     → ' + chalk.cyan('powershell -c "irm https://astral.sh/uv/install.ps1 | iex"'))
    p.log.info('  More info   → ' + chalk.cyan('https://docs.astral.sh/uv/getting-started/installation/'))
    process.exit(1)
  }

  const { projectName: argName, dataPath: argDataPath, dataUrl } = parseArgs()
  let dataPath = argDataPath

  // ── Project name ────────────────────────────────────────────────────────────
  const projectName = argName ?? await p.text({
    message: 'Project name',
    placeholder: 'my-project',
    defaultValue: 'my-project',
    validate: (v) => !v ? 'Required' : undefined,
  })
  if (p.isCancel(projectName)) { p.cancel('Cancelled'); process.exit(0) }

  // ── Download --url ──────────────────────────────────────────────────────────
  if (dataUrl && !dataPath) {
    const spinner = p.spinner()
    spinner.start(`Downloading ${dataUrl}`)
    try {
      const res = await fetch(dataUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const urlBasename = path.basename(new URL(dataUrl).pathname) || 'data.csv'
      const tmpFile = path.join(os.tmpdir(), urlBasename)
      fs.writeFileSync(tmpFile, buf)
      dataPath = tmpFile
      spinner.stop(`Downloaded → ${urlBasename}`)
    } catch (e: any) {
      spinner.stop(chalk.yellow(`Could not download URL: ${e.message} — skipping`))
    }
  }

  // ── Validate --data ─────────────────────────────────────────────────────────
  let csvPath: string | null = null
  let csvAnalysis = null

  if (dataPath) {
    const resolved = path.resolve(dataPath)
    if (!fs.existsSync(resolved)) {
      p.log.warn(`File not found: ${resolved} — skipping CSV analysis`)
    } else {
      csvPath = resolved
      const spinner = p.spinner()
      spinner.start('Analyzing CSV...')
      try {
        csvAnalysis = analyzeCsv(resolved)
        spinner.stop(
          `Detected ${csvAnalysis.columns.length} columns, ${csvAnalysis.rowCount} rows`
        )
        const types = csvAnalysis.columns.map(c => `${c.name} (${c.type})`).join(', ')
        p.log.info('Columns: ' + chalk.dim(types))
      } catch {
        spinner.stop(chalk.yellow('Could not parse CSV — continuing without analysis'))
      }
    }
  }

  // ── Template ────────────────────────────────────────────────────────────────
  const templateKey = await p.select({
    message: 'Template',
    options: Object.entries(TEMPLATES).map(([key, t]) => ({
      value: key,
      label: t.label,
      hint: t.hint,
    })),
  })
  if (p.isCancel(templateKey)) { p.cancel('Cancelled'); process.exit(0) }

  // ── Dependencies ────────────────────────────────────────────────────────────
  let selectedDeps: string[]

  const baseHint = chalk.dim(`(base: ${BASE_DEPS.filter(d => d !== 'python-dotenv' && d !== 'jupyterlab').join(', ')} — always included)`)

  if (templateKey === 'custom') {
    p.log.info(`Base deps always included: ${chalk.dim(BASE_DEPS.join(', '))}`)
    const chosen = await p.multiselect({
      message: `Additional AI/ML dependencies ${baseHint}`,
      options: ALL_DEPS,
      required: false,
    })
    if (p.isCancel(chosen)) { p.cancel('Cancelled'); process.exit(0) }
    selectedDeps = chosen as string[]
  } else {
    selectedDeps = TEMPLATES[templateKey as string].dependencies

    const addMore = await p.confirm({ message: `Add more AI/ML dependencies? ${baseHint}` })
    if (!p.isCancel(addMore) && addMore) {
      const extra = await p.multiselect({
        message: 'Additional AI/ML dependencies',
        options: ALL_DEPS.filter(d => !selectedDeps.includes(d.value)),
        required: false,
      })
      if (!p.isCancel(extra)) {
        selectedDeps = [...selectedDeps, ...(extra as string[])]
      }
    }
  }

  // ── Database ────────────────────────────────────────────────────────────────
  const db = await p.select({
    message: 'Database',
    options: DB_OPTIONS,
  })
  if (p.isCancel(db)) { p.cancel('Cancelled'); process.exit(0) }

  // ── DB credentials ──────────────────────────────────────────────────────────
  const dbCredentials: Record<string, string> = {}
  const dbFields = DB_FIELDS[db as string]
  if (dbFields?.length) {
    const fill = await p.confirm({ message: 'Fill in database credentials now? (skip to use placeholders)' })
    if (!p.isCancel(fill) && fill) {
      for (const field of dbFields) {
        const val = field.secret
          ? await p.password({ message: field.label, validate: () => undefined })
          : await p.text({ message: field.label, placeholder: field.placeholder, defaultValue: '' })
        if (p.isCancel(val)) break
        if (val) dbCredentials[field.key] = val as string
      }
    }
  }

  // ── Confirm & generate ──────────────────────────────────────────────────────
  const outputDir = path.resolve(process.cwd(), projectName as string)

  if (fs.existsSync(outputDir)) {
    const overwrite = await p.confirm({
      message: `${outputDir} already exists. Overwrite?`,
    })
    if (p.isCancel(overwrite) || !overwrite) { p.cancel('Cancelled'); process.exit(0) }
    fs.rmSync(outputDir, { recursive: true })
  }

  const spinner = p.spinner()
  spinner.start('Scaffolding project...')

  try {
    generate({
      projectName: projectName as string,
      dependencies: selectedDeps,
      db: db as string,
      dbCredentials,
      csvAnalysis,
      csvSourcePath: csvPath,
      outputDir,
    })
    spinner.stop('Files created')
  } catch (e) {
    spinner.stop(chalk.red('Failed to scaffold'))
    console.error(e)
    process.exit(1)
  }

  // ── uv sync (always) ─────────────────────────────────────────────────────────
  let syncOk = false
  const s2 = p.spinner()
  s2.start('Installing dependencies (uv sync)...')
  try {
    execSync('uv sync', { cwd: outputDir, stdio: 'ignore' })
    s2.stop('Dependencies installed')
    syncOk = true
  } catch {
    s2.stop(chalk.yellow('uv sync failed — run it manually inside the project'))
  }

  // ── Execute notebook (only if data was provided) ──────────────────────────
  if (syncOk && csvPath) {
    const s3 = p.spinner()
    s3.start('Executing notebook...')
    try {
      execSync(
        'uv run jupyter nbconvert --to notebook --execute --inplace notebooks/eda.ipynb',
        { cwd: outputDir, stdio: 'ignore', timeout: 120_000 }
      )
      s3.stop('Notebook executed — outputs saved')
    } catch {
      s3.stop(chalk.yellow('Could not auto-execute notebook — open and run cells manually'))
    }
  }

  // ── Next steps ───────────────────────────────────────────────────────────────
  const steps = [
    `cd ${projectName}`,
    !csvPath ? 'make run  # place your data in data/ first' : 'open notebooks/eda.ipynb',
    db !== 'none' ? 'cp .env.example .env  # fill in credentials' : '',
    db !== 'none' ? 'make db-init           # test DB connection' : '',
  ].filter(Boolean).join('\n')

  p.note(steps, 'Next steps')
  p.outro(chalk.green('Happy coding! 🐍'))
}

main()
