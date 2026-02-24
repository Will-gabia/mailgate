export interface Email {
  id: string
  createdAt: string
  updatedAt: string
  mailFrom: string
  rcptTo: string
  remoteIp: string
  messageId: string | null
  subject: string | null
  fromHeader: string | null
  toHeader: string | null
  ccHeader: string | null
  replyTo: string | null
  date: string | null
  headers: string | null
  textBody: string | null
  htmlBody: string | null
  status: 'received' | 'classified' | 'forwarded' | 'failed' | 'archived'
  category: string | null
  matchedRule: string | null
  tenantId: string | null
  _count: { attachments: number; forwardLogs: number }
}

export interface EmailDetail extends Omit<Email, '_count'> {
  attachments: Attachment[]
  forwardLogs: ForwardLog[]
}

export interface Attachment {
  id: string
  emailId: string
  filename: string
  contentType: string
  size: number
  checksum: string
  storagePath: string
  createdAt: string
}

export interface Tenant {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  domains: string[]
  settings: string | null
  enabled: boolean
}

export interface Rule {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  description: string | null
  priority: number
  enabled: boolean
  conditions: string
  action: string
  forwardTo: string | null
  category: string | null
  tenantId: string | null
}

export interface ForwardLog {
  id: string
  emailId: string
  forwardTo: string
  status: 'pending' | 'success' | 'failed'
  smtpResponse: string | null
  errorMessage: string | null
  attempts: number
  createdAt: string
  updatedAt: string
}

export interface Stats {
  totalEmails: number
  emailsByStatus: Record<string, number>
  emailsToday: number
  totalTenants: number
  totalRules: number
  recentEmails: {
    id: string
    subject: string | null
    fromHeader: string | null
    status: string
    createdAt: string
  }[]
}
