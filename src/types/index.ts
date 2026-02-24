export interface ParsedEmail {
  messageId?: string;
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  replyTo?: string;
  date?: Date;
  headers: Record<string, string>;
  textBody?: string;
  htmlBody?: string;
  attachments: ParsedAttachment[];
  rawMessage: string;
}

export interface ParsedAttachment {
  filename?: string;
  contentType: string;
  size: number;
  content: Buffer;
  checksum?: string;
}

export type RuleAction = "forward" | "log" | "archive" | "reject";

export type ConditionOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "regex"
  | "notContains";

export interface RuleCondition {
  field: "subject" | "from" | "to" | "cc" | "body" | "header";
  operator: ConditionOperator;
  value: string;
  headerName?: string;
}

export interface ClassificationResult {
  matched: boolean;
  ruleName?: string;
  action: RuleAction;
  category?: string;
  forwardTo?: string;
}


export interface TenantSettings {
  /** Maximum message size in bytes. Overrides global MAX_MESSAGE_SIZE_MB for this tenant. */
  maxMessageSizeBytes?: number;
}