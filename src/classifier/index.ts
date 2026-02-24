import { logger } from "../config/logger.js";
import { ruleRepository } from "../db/index.js";
import type {
  ParsedEmail,
  RuleCondition,
  ClassificationResult,
  RuleAction,
} from "../types/index.js";

function testCondition(email: ParsedEmail, condition: RuleCondition): boolean {
  let fieldValue: string | undefined;

  switch (condition.field) {
    case "subject":
      fieldValue = email.subject;
      break;
    case "from":
      fieldValue = email.from;
      break;
    case "to":
      fieldValue = email.to;
      break;
    case "cc":
      fieldValue = email.cc;
      break;
    case "body":
      fieldValue = email.textBody || email.htmlBody;
      break;
    case "header":
      fieldValue = condition.headerName
        ? email.headers[condition.headerName.toLowerCase()]
        : undefined;
      break;
  }

  if (fieldValue === undefined) return false;

  const target = fieldValue.toLowerCase();
  const value = condition.value.toLowerCase();

  switch (condition.operator) {
    case "contains":
      return target.includes(value);
    case "notContains":
      return !target.includes(value);
    case "equals":
      return target === value;
    case "startsWith":
      return target.startsWith(value);
    case "endsWith":
      return target.endsWith(value);
    case "regex":
      try {
        return new RegExp(condition.value, "i").test(fieldValue);
      } catch {
        logger.warn({ pattern: condition.value }, "Invalid regex in rule");
        return false;
      }
  }
}

const DEFAULT_RESULT: ClassificationResult = {
  matched: false,
  action: "log",
};

export async function classifyEmail(
  email: ParsedEmail,
  tenantId?: string
): Promise<ClassificationResult> {
  const rules = await ruleRepository.findAllEnabled(tenantId);

  for (const rule of rules) {
    let conditions: RuleCondition[];
    try {
      conditions = JSON.parse(rule.conditions) as RuleCondition[];
    } catch {
      logger.warn({ ruleName: rule.name }, "Failed to parse rule conditions");
      continue;
    }

    const matchFn = rule.matchMode === "any" ? "some" : "every";
    const allMatch = conditions[matchFn]((cond: RuleCondition) => testCondition(email, cond));
    if (allMatch) {
      logger.info(
        { ruleName: rule.name, action: rule.action, emailSubject: email.subject },
        "Email matched classification rule"
      );
      return {
        matched: true,
        ruleName: rule.name,
        action: rule.action as RuleAction,
        category: rule.category ?? undefined,
        forwardTo: rule.forwardTo ?? undefined,
      };
    }
  }

  logger.info({ emailSubject: email.subject }, "No rule matched, defaulting to log");
  return DEFAULT_RESULT;
}
