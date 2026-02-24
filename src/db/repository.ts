import { getDb } from "./client.js";
import { config } from "../config/index.js";
import type { TenantSettings } from "../types/index.js";

export interface CreateEmailInput {
  mailFrom: string;
  rcptTo: string;
  remoteIp: string;
  messageId?: string;
  subject?: string;
  fromHeader?: string;
  toHeader?: string;
  ccHeader?: string;
  replyTo?: string;
  date?: Date;
  headers?: string;
  textBody?: string;
  htmlBody?: string;
  rawMessage: string;
  tenantId?: string;
  dkimResult?: string;
  spfResult?: string;
  keywords?: string;
}

export interface UpdateParsedFieldsInput {
  messageId?: string;
  subject?: string;
  fromHeader?: string;
  toHeader?: string;
  ccHeader?: string;
  replyTo?: string;
  date?: Date;
  headers?: string;
  textBody?: string;
  htmlBody?: string;
  tenantId?: string;
  dkimResult?: string;
  spfResult?: string;
  keywords?: string;
}

export interface CreateAttachmentInput {
  emailId: string;
  filename?: string;
  contentType: string;
  size: number;
  checksum?: string;
  storagePath?: string;
}

export const emailRepository = {
  async create(data: CreateEmailInput) {
    return getDb().email.create({ data });
  },

  async findById(id: string) {
    return getDb().email.findUnique({
      where: { id },
      include: { attachments: true, forwardLogs: true },
    });
  },

  async findByMessageId(messageId: string) {
    return getDb().email.findUnique({
      where: { messageId },
    });
  },

  async updateStatus(
    id: string,
    status: string,
    extra?: { category?: string; matchedRule?: string }
  ) {
    return getDb().email.update({
      where: { id },
      data: { status, ...extra },
    });
  },

  async updateParsedFields(id: string, data: UpdateParsedFieldsInput) {
    return getDb().email.update({
      where: { id },
      data,
    });
  },

  async listRecent(limit = 50, offset = 0) {
    return getDb().email.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { attachments: true },
    });
  },

  async findByStatus(status: string) {
    return getDb().email.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
    });
  },
};

export const attachmentRepository = {
  async create(data: CreateAttachmentInput) {
    return getDb().attachment.create({ data });
  },

  async findByEmailId(emailId: string) {
    return getDb().attachment.findMany({
      where: { emailId },
    });
  },
};

export const forwardLogRepository = {
  async create(data: {
    emailId: string;
    forwardTo: string;
    status: string;
    error?: string;
    smtpResponse?: string;
    nextRetryAt?: Date;
  }) {
    return getDb().forwardLog.create({ data });
  },

  async findByEmailId(emailId: string) {
    return getDb().forwardLog.findMany({
      where: { emailId },
      orderBy: { createdAt: "desc" },
    });
  },
};

export interface ClassificationRuleInput {
  name: string;
  description?: string;
  priority?: number;
  enabled?: boolean;
  conditions: string;
  action: string;
  forwardTo?: string;
  category?: string;
  tenantId?: string;
}

export const ruleRepository = {
  async findAllEnabled(tenantId?: string) {
    if (tenantId) {
      // Return tenant-specific rules + global rules (tenantId=null)
      return getDb().classificationRule.findMany({
        where: { enabled: true, OR: [{ tenantId }, { tenantId: null }] },
        orderBy: { priority: "desc" },
      });
    }
    // No tenant — global rules only
    return getDb().classificationRule.findMany({
      where: { enabled: true, tenantId: null },
      orderBy: { priority: "desc" },
    });
  },


  async findAll() {
    return getDb().classificationRule.findMany({
      orderBy: { priority: "desc" },
    });
  },

  async create(data: ClassificationRuleInput) {
    return getDb().classificationRule.create({ data });
  },

  async update(
    id: string,
    data: Partial<Omit<ClassificationRuleInput, "name">>
  ) {
    return getDb().classificationRule.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return getDb().classificationRule.delete({ where: { id } });
  },

  async findByName(name: string) {
    return getDb().classificationRule.findUnique({ where: { name } });
  },
};

// --- Tenant Repository ---

export interface CreateTenantInput {
  name: string;
  domains: string; // JSON array string
  settings?: string;
  enabled?: boolean;
}

export const tenantRepository = {
  async create(data: CreateTenantInput) {
    return getDb().tenant.create({ data });
  },

  async findAll() {
    return getDb().tenant.findMany({
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return getDb().tenant.findUnique({ where: { id } });
  },

  async findByName(name: string) {
    return getDb().tenant.findUnique({ where: { name } });
  },

  /**
   * Find tenant by matching domain against the JSON domains array.
   * Iterates all enabled tenants and checks if the domain is in their domains list.
   */
  async findByDomain(domain: string) {
    const tenants = await getDb().tenant.findMany({
      where: { enabled: true },
    });
    const lowerDomain = domain.toLowerCase();
    for (const tenant of tenants) {
      try {
        const domains = JSON.parse(tenant.domains) as string[];
        if (domains.some((d) => d.toLowerCase() === lowerDomain)) {
          return tenant;
        }
      } catch {
        // Skip tenants with invalid domains JSON
      }
    }
    return null;
  },

  async update(id: string, data: Partial<CreateTenantInput>) {
    return getDb().tenant.update({ where: { id }, data });
  },

  async delete(id: string) {
    return getDb().tenant.delete({ where: { id } });
  },

  /**
   * Get the maximum message size in bytes for a tenant.
   * Falls back to the global MAX_MESSAGE_SIZE_MB config if the tenant has no override.
   */
  getMaxMessageSize(tenant: { settings: string | null }): number {
    const globalMax = config.messageSize.maxBytes;
    if (!tenant.settings) return globalMax;
    try {
      const settings = JSON.parse(tenant.settings) as TenantSettings;
      return settings.maxMessageSizeBytes ?? globalMax;
    } catch {
      return globalMax;
    }
  },
};
