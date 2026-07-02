import { useState, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Download, Loader2, RotateCcw,
} from 'lucide-react'
import { getClients, bulkImportClients } from '../lib/api'

const STATUS_VALUES = ['Active', 'Renewal', 'Overdue']
const INVOICE_STATUS_VALUES = ['Paid', 'Pending', 'Overdue']
const EMAIL_RE = /\S+@\S+\.\S+/

// Accepts common header variants and maps them to our schema.
const HEADER_ALIASES = {
  name: ['name', 'company', 'companyname', 'company name', 'client', 'clientname'],
  contact: ['contact', 'contactperson', 'contact person'],
  email: ['email', 'emailaddress', 'email address'],
  phone: ['phone', 'phonenumber', 'phone number', 'mobile'],
  status: ['status'],
  contract_end: ['contractend', 'contract end', 'contractenddate', 'contract end date'],
  contract_value: ['contractvalue', 'contract value'],
  invoice_status: ['invoicestatus', 'invoice status'],
  invoice_amount: ['invoiceamount', 'invoice amount'],
  notes: ['notes', 'note'],
  billing_cycle: ['billingcycle', 'billing cycle'],
  period_start: ['periodstart', 'period start', 'billingstart', 'billing start'],
  period_end: ['periodend', 'period end', 'billingend', 'billing end'],
}

function normalizeHeader(h) {
  return (h || '').toString().trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ')
}

function buildHeaderMap(rawHeaders) {
  const map = {}
  rawHeaders.forEach(raw => {
    const norm = normalizeHeader(raw)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm) || aliases.includes(norm.replace(/\s+/g, ''))) {
        map[raw] = field
        return
      }
    }
  })
  return map
}

function initialsFor(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function validateRow(row) {
  const errors = []
  const name = (row.name || '').toString().trim()
  const email = (row.email || '').toString().trim()

  if (!name) errors.push('Missing name')
  if (!email) errors.push('Missing email')
  else if (!EMAIL_RE.test(email)) errors.push('Invalid email')

  let invoiceStatus = (row.invoice_status || 'Pending').toString().trim()
  if (invoiceStatus !== 'Paid') invoiceStatus = 'Pending'

  const billingCycle = (row.billing_cycle || '').toString().trim().toLowerCase() === 'monthly' ? 'monthly' : 'yearly'
  const periodStart = (row.period_start || '').toString().trim()
  const periodEnd = (row.period_end || '').toString().trim()

  if (billingCycle === 'monthly') {
    if (!periodStart) errors.push('Missing period_start')
    if (!periodEnd) errors.push('Missing period_end')
    if (periodStart && periodEnd && new Date(periodEnd) < new Date(periodStart)) {
      errors.push('period_end is before period_start')
    }
  }

  return {
    errors,
    clean: {
      name,
      email,
      contact: (row.contact || '').toString().trim(),
      phone: (row.phone || '').toString().trim(),
      contract_end: (row.contract_end || '').toString().trim(),
      contract_value: (row.contract_value || '').toString().trim(),
      invoice_status: invoiceStatus,
      invoice_amount: (row.invoice_amount || '').toString().trim(),
      notes: (row.notes || '').toString().trim(),
      color: '#3B6FF5',
      initials: initialsFor(name),
      billing_cycle: billingCycle === 'monthly' ? 'monthly' : undefined,
      period_start: billingCycle === 'monthly' ? periodStart : undefined,
      period_end: billingCycle === 'monthly' ? periodEnd : undefined,
    },
  }
}

const SAMPLE_CSV =
  'name,email,contact,phone,contract_end,contract_value,invoice_status,invoice_amount,notes,billing_cycle,period_start,period_end\n' +
  'Acme Corp,billing@acme.com,John Smith,+91 98765 43210,2026-12-31,"₹80,000/yr",Paid,"₹0",Long-term client,,,\n' +
  'Nova Studio,billing@novastudio.com,Jane Doe,+91 98765 11223,,,Pending,"₹15,000",Monthly retainer client,monthly,2026-07-01,2026-07-31\n'

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'client-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BulkImport({ onDone }) {
  const [stage, setStage] = useState('upload') // upload | preview | importing | result
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [rows, setRows] = useState([])       // { clean, errors, isDup, source }
  const [result, setResult] = useState(null) // { insertedCount, skippedCount, skipped }
  const fileInputRef = useRef(null)

  const reset = () => {
    setStage('upload')
    setFileName('')
    setParseError('')
    setRows([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processRawRows = async (rawRows) => {
    if (!rawRows.length) {
      setParseError('The file has no data rows.')
      return
    }
    if (rawRows.length > 1000) {
      setParseError('Max 1000 rows per import. Please split the file.')
      return
    }

    const headers = Object.keys(rawRows[0])
    const headerMap = buildHeaderMap(headers)

    if (!Object.values(headerMap).includes('name') || !Object.values(headerMap).includes('email')) {
      setParseError('Could not find "name" and "email" columns. Download the template below for the expected format.')
      return
    }

    // Existing clients, for duplicate-by-email detection
    let existingEmails = new Set()
    try {
      const { data } = await getClients()
      existingEmails = new Set(data.map(c => (c.email || '').toLowerCase()))
    } catch {
      // Non-fatal — duplicate check against DB just gets skipped if this fails
    }

    const seenInFile = new Set()
    const processed = rawRows.map((raw, i) => {
      const mapped = {}
      Object.entries(raw).forEach(([k, v]) => {
        const field = headerMap[k]
        if (field) mapped[field] = v
      })

      const { errors, clean } = validateRow(mapped)
      const emailLower = clean.email.toLowerCase()

      let isDup = false
      let dupReason = ''
      if (emailLower && existingEmails.has(emailLower)) {
        isDup = true
        dupReason = 'Already exists in your client list'
      } else if (emailLower && seenInFile.has(emailLower)) {
        isDup = true
        dupReason = 'Duplicate row within this file'
      }
      if (emailLower && !isDup) seenInFile.add(emailLower)

      return {
        rowNum: i + 1,
        clean,
        errors,
        isDup,
        dupReason,
        include: errors.length === 0 && !isDup,
      }
    })

    setRows(processed)
    setStage('preview')
  }

  const handleFile = (file) => {
    setParseError('')
    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => processRawRows(res.data),
        error: (err) => setParseError(err.message || 'Failed to parse CSV'),
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          processRawRows(json)
        } catch (err) {
          setParseError('Failed to parse Excel file: ' + err.message)
        }
      }
      reader.onerror = () => setParseError('Failed to read the file')
      reader.readAsArrayBuffer(file)
    } else {
      setParseError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.')
    }
  }

  const onFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const toggleRow = (rowNum) => {
    setRows(prev => prev.map(r =>
      r.rowNum === rowNum && r.errors.length === 0 ? { ...r, include: !r.include } : r
    ))
  }

  const importRows = async () => {
    const toImport = rows.filter(r => r.include).map(r => r.clean)
    if (!toImport.length) return
    setStage('importing')
    try {
      const { data } = await bulkImportClients(toImport)
      setResult(data)
      setStage('result')
    } catch (err) {
      setParseError(err.message || 'Import failed')
      setStage('preview')
    }
  }

  const validCount = rows.filter(r => r.errors.length === 0 && !r.isDup).length
  const errorCount = rows.filter(r => r.errors.length > 0).length
  const dupCount = rows.filter(r => r.isDup).length
  const includedCount = rows.filter(r => r.include).length

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
          Bulk Import Clients
        </h3>
        <button
          type="button"
          onClick={downloadSampleCSV}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12.5,
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          <Download size={13} /> Download template
        </button>
      </div>

      {stage === 'upload' && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-2)',
            borderRadius: 14,
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--bg-3)',
            transition: 'border-color .15s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileInput}
            style={{ display: 'none' }}
          />
          <UploadCloud size={30} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>
            Drop a CSV or Excel file here, or click to browse
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            Supports .csv, .xlsx, .xls — must include "name" and "email" columns. Add billing_cycle=monthly with period_start/period_end for monthly-billing clients.
          </div>
        </div>
      )}

      {parseError && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8,
          background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,.25)',
          borderRadius: 10, padding: '12px 16px', fontSize: 13.5, color: 'var(--red)',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{parseError}</span>
        </div>
      )}

      {stage === 'preview' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-2)' }}>
            <FileSpreadsheet size={15} /> {fileName}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="Ready to import" value={validCount} color="var(--green)" icon={CheckCircle2} />
            <Stat label="Duplicates" value={dupCount} color="var(--amber)" icon={AlertTriangle} />
            <Stat label="Errors" value={errorCount} color="var(--red)" icon={XCircle} />
          </div>

          <div className="table-scroll" style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table className="data-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Billing</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.rowNum} style={{ cursor: 'default' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.include}
                        disabled={r.errors.length > 0}
                        onChange={() => toggleRow(r.rowNum)}
                      />
                    </td>
                    <td style={{ color: 'var(--text-1)' }}>{r.clean.name || <em style={{ color: 'var(--text-3)' }}>—</em>}</td>
                    <td>{r.clean.email || <em style={{ color: 'var(--text-3)' }}>—</em>}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
                      {r.clean.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                    </td>
                    <td>
                      {r.errors.length > 0 ? (
                        <span style={{ color: 'var(--red)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={13} /> {r.errors.join(', ')}
                        </span>
                      ) : r.isDup ? (
                        <span style={{ color: 'var(--amber)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={13} /> {r.dupReason}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--green)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={importRows}
              disabled={includedCount === 0}
            >
              <UploadCloud size={15} /> Import {includedCount} client{includedCount === 1 ? '' : 's'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <RotateCcw size={15} /> Start over
            </button>
          </div>
        </div>
      )}

      {stage === 'importing' && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader2 size={26} className="spin" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13.5 }}>Importing clients…</div>
        </div>
      )}

      {stage === 'result' && result && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--green-bg)', border: '1px solid rgba(16,185,129,.25)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
          }}>
            <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>
              <strong>{result.insertedCount}</strong> client{result.insertedCount === 1 ? '' : 's'} imported successfully.
              {result.skippedCount > 0 && (
                <> <strong>{result.skippedCount}</strong> row{result.skippedCount === 1 ? '' : 's'} skipped.</>
              )}
            </div>
          </div>

          {result.skipped?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                Skipped rows
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.skipped.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--text-2)',
                    padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8,
                  }}>
                    <span style={{ color: 'var(--text-3)' }}>Row {s.row}</span>
                    <span>{s.name || '—'}</span>
                    <span style={{ color: 'var(--amber)' }}>{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => onDone?.()}>
              View clients
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <RotateCcw size={15} /> Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color, icon: Icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-3)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 14px',
    }}>
      <Icon size={15} style={{ color }} />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
    </div>
  )
}
