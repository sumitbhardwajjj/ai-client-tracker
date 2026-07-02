import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

// ── Startup env validation ──────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`✗ Missing required environment variable(s): ${missing.join(', ')}`)
  console.error('  Copy backend/.env.example to backend/.env and fill in the values.')
  process.exit(1)
}

const app = express()

// ── CORS ─────────────────────────────────────────────────────────────────
// In production, set FRONTEND_URL to your deployed frontend origin
// (e.g. https://your-app.onrender.com). Falls back to allow-all for local dev.
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : true

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '2mb' }))

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const STATUS_VALUES = ['Active', 'Renewal', 'Overdue']
const INVOICE_STATUS_VALUES = ['Paid', 'Pending', 'Overdue']
const EMAIL_RE = /\S+@\S+\.\S+/

const asyncHandler = fn => (req, res, next) => fn(req, res, next).catch(next)

function validateClientPayload(body, { partial = false } = {}) {
  const errors = []
  const clean = {}

  const has = k => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined

  if (!partial || has('name')) {
    const name = (body.name || '').toString().trim()
    if (!name) errors.push('name is required')
    clean.name = name
  }
  if (!partial || has('email')) {
    const email = (body.email || '').toString().trim()
    if (!email) errors.push('email is required')
    else if (!EMAIL_RE.test(email)) errors.push('email is invalid')
    clean.email = email
  }
  if (has('status')) {
    if (!STATUS_VALUES.includes(body.status)) errors.push(`status must be one of ${STATUS_VALUES.join(', ')}`)
    else clean.status = body.status
  } else if (!partial) {
    clean.status = 'Active'
  }
  if (has('invoice_status')) {
    if (!INVOICE_STATUS_VALUES.includes(body.invoice_status)) errors.push(`invoice_status must be one of ${INVOICE_STATUS_VALUES.join(', ')}`)
    else clean.invoice_status = body.invoice_status
  } else if (!partial) {
    clean.invoice_status = 'Paid'
  }

  for (const k of ['initials', 'contact', 'phone', 'contract_end', 'contract_value', 'invoice_amount', 'color', 'notes']) {
    if (has(k)) clean[k] = body[k]
  }
  if (has('projects_done')) {
    const n = Number(body.projects_done)
    clean.projects_done = Number.isFinite(n) ? n : 0
  }

  return { errors, clean }
}

// ── Health check (used by Render) ──────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// GET all clients
app.get('/api/clients', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: error.message })
  res.json(data)
}))

// GET single client
app.get('/api/clients/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ message: 'Not found' })
  res.json(data)
}))

// POST create client
app.post('/api/clients', asyncHandler(async (req, res) => {
  const { errors, clean } = validateClientPayload(req.body)
  if (errors.length) return res.status(422).json({ message: errors.join('; ') })

  // Duplicate check by email
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .ilike('email', clean.email)
    .maybeSingle()
  if (existing) return res.status(409).json({ message: 'A client with this email already exists' })

  const { data, error } = await supabase
    .from('clients')
    .insert([clean])
    .select()
    .single()
  if (error) return res.status(400).json({ message: error.message })
  res.status(201).json(data)
}))

// POST bulk import clients (CSV/Excel import from the frontend)
app.post('/api/clients/bulk', asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.clients) ? req.body.clients : []
  if (!rows.length) return res.status(422).json({ message: 'No client rows provided' })
  if (rows.length > 1000) return res.status(422).json({ message: 'Max 1000 rows per import' })

  const { data: existingRows } = await supabase.from('clients').select('email')
  const existingEmails = new Set((existingRows || []).map(r => (r.email || '').toLowerCase()))

  const toInsert = []
  const skipped = []
  const seenInBatch = new Set()

  rows.forEach((row, i) => {
    const { errors, clean } = validateClientPayload(row)
    const emailLower = (clean.email || '').toLowerCase()

    if (errors.length) {
      skipped.push({ row: i + 1, name: row.name, reason: errors.join('; ') })
      return
    }
    if (existingEmails.has(emailLower)) {
      skipped.push({ row: i + 1, name: row.name, reason: 'Duplicate — already exists in database' })
      return
    }
    if (seenInBatch.has(emailLower)) {
      skipped.push({ row: i + 1, name: row.name, reason: 'Duplicate — repeated within import file' })
      return
    }

    seenInBatch.add(emailLower)
    toInsert.push(clean)
  })

  let inserted = []
  if (toInsert.length) {
    const { data, error } = await supabase.from('clients').insert(toInsert).select()
    if (error) return res.status(400).json({ message: error.message })
    inserted = data
  }

  res.status(201).json({
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    inserted,
    skipped,
  })
}))

// PUT update client
app.put('/api/clients/:id', asyncHandler(async (req, res) => {
  const { errors, clean } = validateClientPayload(req.body, { partial: true })
  if (errors.length) return res.status(422).json({ message: errors.join('; ') })
  if (Object.keys(clean).length === 0) return res.status(422).json({ message: 'No valid fields to update' })

  const { data, error } = await supabase
    .from('clients')
    .update(clean)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ message: error.message })
  res.json(data)
}))

// DELETE client
app.delete('/api/clients/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Deleted' })
}))

// POST log contact
app.post('/api/clients/:id/contact', asyncHandler(async (req, res) => {
  const note = (req.body.note || '').toString().trim()
  if (!note) return res.status(422).json({ message: 'note is required' })

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('history')
    .eq('id', req.params.id)
    .single()
  if (fetchError) return res.status(404).json({ message: 'Not found' })

  const newHistory = [
    ...(client.history || []),
    { date: new Date().toISOString(), note }
  ]

  const { data, error } = await supabase
    .from('clients')
    .update({ history: newHistory, last_contact: 'Just now' })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(400).json({ message: error.message })
  res.json(data)
}))

// ── 404 + error handling ────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () =>
  console.log(`✓ Server running on port ${PORT} with Supabase`)
)
