import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'BillFlow <noreply@billflow.app>'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ id: string } | null> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Send failed:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('[email] Send error:', err)
    return null
  }
}

export function buildReminderEmail(bills: Array<{ payee_name: string; amount: number; currency: string; due_date: string }>): { subject: string; html: string } {
  const count = bills.length
  const subject = count === 1
    ? `Reminder: ${bills[0].payee_name} bill due ${bills[0].due_date}`
    : `Reminder: ${count} bills due soon`

  const rows = bills.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500">${b.payee_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${b.amount.toFixed(2)} ${b.currency}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${b.due_date}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a;margin-bottom:16px">Bill Reminder</h2>
      <p style="color:#555;margin-bottom:16px">
        You have ${count} bill${count !== 1 ? 's' : ''} due soon:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Payee</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Amount</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://billflow.app'}/dashboard"
         style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-weight:500">
        View in BillFlow
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px">
        You can change your reminder settings in BillFlow Settings.
      </p>
    </div>
  `

  return { subject, html }
}

export function buildPaymentFollowupEmail(bills: Array<{ payee_name: string; amount: number; currency: string; paid_at: string }>): { subject: string; html: string } {
  const count = bills.length
  const subject = count === 1
    ? `Check payment receipt: ${bills[0].payee_name}`
    : `Check payment receipt for ${count} bills`

  const rows = bills.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500">${b.payee_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${b.amount.toFixed(2)} ${b.currency}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${b.paid_at}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a;margin-bottom:16px">Payment Follow-up</h2>
      <p style="color:#555;margin-bottom:16px">
        ${count === 1 ? 'This bill was marked as paid a few business days ago.' : 'These bills were marked as paid a few business days ago.'}
        Check whether the payment has been received and confirm it in BillFlow.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Payee</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Amount</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Paid At</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://billflow.app'}/dashboard"
         style="display:inline-block;padding:10px 20px;background:#1f2937;color:white;border-radius:8px;text-decoration:none;font-weight:500">
        Review in BillFlow
      </a>
    </div>
  `

  return { subject, html }
}

export function buildOverdueEmail(bills: Array<{ payee_name: string; amount: number; currency: string; due_date: string }>): { subject: string; html: string } {
  const count = bills.length
  const subject = count === 1
    ? `Overdue: ${bills[0].payee_name} was due ${bills[0].due_date}`
    : `Overdue: ${count} bills past due date`

  const rows = bills.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500">${b.payee_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${b.amount.toFixed(2)} ${b.currency}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:#dc2626">${b.due_date}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626;margin-bottom:16px">Overdue Bills</h2>
      <p style="color:#555;margin-bottom:16px">
        ${count} bill${count !== 1 ? 's have' : ' has'} passed ${count !== 1 ? 'their' : 'its'} due date:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#fef2f2">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Payee</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Amount</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://billflow.app'}/dashboard"
         style="display:inline-block;padding:10px 20px;background:#dc2626;color:white;border-radius:8px;text-decoration:none;font-weight:500">
        View in BillFlow
      </a>
    </div>
  `

  return { subject, html }
}
