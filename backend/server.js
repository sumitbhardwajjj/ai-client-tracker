import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

dotenv.config()

// ── Startup env validation ──────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET']
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

// ── Auth ─────────────────────────────────────────────────────────────────
const JWT_EXPIRY = '7d'

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ message: 'Session expired, please log in again' })
  }
}

// Creates the first team account from env vars if no users exist yet — there's
// no one logged in to create a user through the API on a brand new deploy.
async function ensureAdminUser() {
  const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true })
  if (error) {
    console.error('✗ Could not check users table — did you run the users table migration in Supabase?', error.message)
    return
  }
  if (count > 0) return
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn('⚠ No users exist yet and ADMIN_EMAIL/ADMIN_PASSWORD are not set — no one will be able to log in.')
    return
  }
  const password_hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
  const { error: insertError } = await supabase.from('users').insert([{
    email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
    password_hash,
    name: process.env.ADMIN_NAME || 'Admin',
  }])
  if (insertError) console.error('✗ Failed to create initial admin user:', insertError.message)
  else console.log(`✓ Created initial admin user (${process.env.ADMIN_EMAIL})`)
}

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = (req.body.email || '').toString().trim().toLowerCase()
  const password = (req.body.password || '').toString()
  if (!email || !password) return res.status(422).json({ message: 'Email and password are required' })

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, password_hash')
    .ilike('email', email)
    .maybeSingle()
  if (error || !user) return res.status(401).json({ message: 'Invalid email or password' })

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' })

  const token = signToken(user)
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
}))

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', req.user.sub)
    .maybeSingle()
  if (error || !user) return res.status(401).json({ message: 'Not authenticated' })
  res.json(user)
}))

// ── Team management (add/remove teammate accounts) ─────────────────────────
app.get('/api/users', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('users').select('id, email, name, created_at').order('created_at')
  if (error) return res.status(500).json({ message: error.message })
  res.json(data)
}))

app.post('/api/users', requireAuth, asyncHandler(async (req, res) => {
  const email = (req.body.email || '').toString().trim().toLowerCase()
  const password = (req.body.password || '').toString()
  const name = (req.body.name || '').toString().trim()
  if (!email || !EMAIL_RE.test(email)) return res.status(422).json({ message: 'A valid email is required' })
  if (!password || password.length < 8) return res.status(422).json({ message: 'Password must be at least 8 characters' })

  const { data: existing } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()
  if (existing) return res.status(409).json({ message: 'A user with this email already exists' })

  const password_hash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password_hash, name: name || email.split('@')[0] }])
    .select('id, email, name, created_at')
    .single()
  if (error) return res.status(400).json({ message: error.message })
  res.status(201).json(data)
}))

app.delete('/api/users/:id', requireAuth, asyncHandler(async (req, res) => {
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true })
  if (count <= 1) return res.status(409).json({ message: 'Cannot remove the last remaining account' })
  if (req.params.id === req.user.sub) return res.status(409).json({ message: "You can't remove your own account while logged in" })

  const { error } = await supabase.from('users').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Removed' })
}))

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

// Everything under /api/clients requires a logged-in session
app.use('/api/clients', requireAuth)

// GET all clients (list view — history log omitted here since it's only
// needed on the detail page, and can grow large over time)
app.get('/api/clients', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ message: error.message })
  const trimmed = (data || []).map(({ history, ...rest }) => rest)
  res.json(trimmed)
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

// Builds the first invoice period (and, if pre-marked Paid, the following
// period too) for a monthly-billing row coming from bulk import — mirrors
// the logic in the single-client "start monthly billing" endpoint below.
function buildMonthlyInvoices({ period_start, period_end, amount, status }) {
  const cleanStatus = status === 'Paid' ? 'Paid' : 'Pending'
  const invoices = [{
    id: crypto.randomUUID(),
    period_start, period_end, amount: amount || '',
    status: cleanStatus,
    paid_at: cleanStatus === 'Paid' ? new Date().toISOString() : null,
  }]
  if (cleanStatus === 'Paid') {
    const { period_start: ns, period_end: ne } = nextPeriod(period_end)
    invoices.push({
      id: crypto.randomUUID(), period_start: ns, period_end: ne,
      amount: amount || '', status: 'Pending', paid_at: null,
    })
  }
  return invoices
}

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

    const isMonthly = (row.billing_cycle || '').toString().trim().toLowerCase() === 'monthly'
    if (isMonthly) {
      const period_start = (row.period_start || '').toString().trim()
      const period_end = (row.period_end || '').toString().trim()
      if (!period_start || !period_end) {
        errors.push('period_start and period_end are required when billing_cycle is monthly')
      } else if (new Date(period_end) < new Date(period_start)) {
        errors.push('period_end cannot be before period_start')
      } else {
        clean.billing_cycle = 'monthly'
        clean.invoices = buildMonthlyInvoices({
          period_start, period_end,
          amount: clean.invoice_amount,
          status: clean.invoice_status,
        })
        // Monthly clients don't use contract_end/invoice_status the way
        // annual ones do — status is derived from the invoices array instead.
        delete clean.contract_end
      }
    }

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

// POST bulk delete clients (Dashboard multi-select delete)
app.post('/api/clients/bulk-delete', asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : []
  if (!ids.length) return res.status(422).json({ message: 'No client ids provided' })
  if (ids.length > 1000) return res.status(422).json({ message: 'Max 1000 clients per bulk delete' })

  const { error, count } = await supabase
    .from('clients')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ deletedCount: count ?? ids.length })
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

// ── Monthly billing (recurring invoice periods, stored as JSONB on the client) ──
function nextPeriod(periodEndStr) {
  const end = new Date(periodEndStr)
  const nextStart = new Date(end)
  nextStart.setDate(nextStart.getDate() + 1)
  const nextEnd = new Date(nextStart)
  nextEnd.setMonth(nextEnd.getMonth() + 1)
  nextEnd.setDate(nextEnd.getDate() - 1)
  const fmt = d => d.toISOString().slice(0, 10)
  return { period_start: fmt(nextStart), period_end: fmt(nextEnd) }
}

// POST create the first (or an additional) billing period for a client.
// Switches the client onto monthly billing. If status is 'Paid', the next
// period is generated immediately so billing keeps rolling forward.
app.post('/api/clients/:id/invoices', asyncHandler(async (req, res) => {
  const { period_start, period_end, amount } = req.body
  const status = req.body.status === 'Paid' ? 'Paid' : 'Pending'
  if (!period_start || !period_end) return res.status(422).json({ message: 'period_start and period_end are required' })

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('invoices')
    .eq('id', req.params.id)
    .single()
  if (fetchError) return res.status(404).json({ message: 'Not found' })

  const invoice = {
    id: crypto.randomUUID(),
    period_start, period_end, amount: amount || '',
    status,
    paid_at: status === 'Paid' ? new Date().toISOString() : null,
  }
  let invoices = [...(client.invoices || []), invoice]

  if (status === 'Paid') {
    const { period_start: ns, period_end: ne } = nextPeriod(period_end)
    invoices.push({
      id: crypto.randomUUID(), period_start: ns, period_end: ne,
      amount: amount || '', status: 'Pending', paid_at: null,
    })
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ invoices, billing_cycle: 'monthly' })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ message: error.message })
  res.status(201).json(data)
}))

// PATCH edit a billing period's dates/amount. Only pending (unpaid) periods
// can be edited — once a period is marked Paid it's a historical record.
app.patch('/api/clients/:id/invoices/:invoiceId', asyncHandler(async (req, res) => {
  const { period_start, period_end, amount } = req.body

  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('invoices')
    .eq('id', req.params.id)
    .single()
  if (fetchError) return res.status(404).json({ message: 'Not found' })

  const invoices = client.invoices || []
  const idx = invoices.findIndex(i => i.id === req.params.invoiceId)
  if (idx === -1) return res.status(404).json({ message: 'Invoice period not found' })
  if (invoices[idx].status === 'Paid') return res.status(409).json({ message: 'Cannot edit a period that is already marked paid' })

  const nextStart = period_start || invoices[idx].period_start
  const nextEnd = period_end || invoices[idx].period_end
  if (new Date(nextEnd) < new Date(nextStart)) {
    return res.status(422).json({ message: 'Period end cannot be before period start' })
  }

  invoices[idx] = {
    ...invoices[idx],
    period_start: nextStart,
    period_end: nextEnd,
    amount: amount !== undefined ? amount : invoices[idx].amount,
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ invoices })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ message: error.message })
  res.json(data)
}))

// POST mark a billing period as Paid — automatically generates the next period.
app.post('/api/clients/:id/invoices/:invoiceId/mark-paid', asyncHandler(async (req, res) => {
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('invoices')
    .eq('id', req.params.id)
    .single()
  if (fetchError) return res.status(404).json({ message: 'Not found' })

  const invoices = client.invoices || []
  const idx = invoices.findIndex(i => i.id === req.params.invoiceId)
  if (idx === -1) return res.status(404).json({ message: 'Invoice period not found' })
  if (invoices[idx].status === 'Paid') return res.status(409).json({ message: 'Already marked paid' })

  invoices[idx] = { ...invoices[idx], status: 'Paid', paid_at: new Date().toISOString() }

  const alreadyHasNext = invoices.some(i =>
    new Date(i.period_start) > new Date(invoices[idx].period_end)
  )
  if (!alreadyHasNext) {
    const { period_start: ns, period_end: ne } = nextPeriod(invoices[idx].period_end)
    invoices.push({
      id: crypto.randomUUID(), period_start: ns, period_end: ne,
      amount: invoices[idx].amount, status: 'Pending', paid_at: null,
    })
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ invoices })
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
await ensureAdminUser()
app.listen(PORT, () =>
  console.log(`✓ Server running on port ${PORT} with Supabase`)
)
