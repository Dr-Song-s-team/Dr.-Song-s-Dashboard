import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadEntities, redact, unredact, scanText } from "@/lib/redaction";
import { callAI } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AnalysisData = {
  category: string;
  urgency: string;
  actionRequired: boolean;
  summaryTitle: string;
  summaryDetails: string[];
  clientTags: string[];
  recommendedActions: string[] | null;
  dueDate: string | null;
  dueTime: string | null;
  draftResponse: string | null;
};

type AnalyzeOneResult = {
  success: boolean;
  emailId?: string;
  analyzed?: boolean;
  error?: string;
  analysis?: AnalysisData;
};

/**
 * Strips leftover redaction tokens (e.g., {{EMAIL_2}}, {{PERSON_1}}) from text.
 * Replaces them with "[unavailable]" so users never see raw tokens.
 */
function stripLeftoverTokens(text: string): string {
  return text.replace(/\{\{[A-Z_0-9]+\}\}/g, "[unavailable]");
}

/**
 * Determines if a sender appears to be an organization/department rather than a person.
 * Uses heuristics based on fromName and fromEmail patterns.
 *
 * @internal Exported for testing
 */
export function isOrganizationalSender(fromName: string, fromEmail: string): boolean {
  const nameLower = fromName.trim().toLowerCase();
  const emailLocalPart = fromEmail.split("@")[0]?.toLowerCase() || "";

  // Common department/organizational keywords
  const organizationalKeywords = [
    "claims",
    "billing",
    "support",
    "noreply",
    "no-reply",
    "admin",
    "info",
    "notifications",
    "notification",
    "team",
    "service",
    "services",
    "dept",
    "department",
    "hello",
    "help",
    "contact",
    "customerservice",
    "customer service",
    "accounts",
    "payroll",
    "hr",
    "human resources",
    "reception",
    "office",
  ];

  // Check if fromName matches organizational keywords (whole word matches)
  // Use word boundaries to avoid false positives like "hr" in "chris"
  for (const keyword of organizationalKeywords) {
    if (nameLower === keyword) {
      return true;
    }
    // For multi-word keywords like "human resources", escape spaces
    const escapedKeyword = keyword.replace(/\s+/g, '\\s+');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    if (regex.test(nameLower)) {
      return true;
    }
  }

  // Check email local-part for organizational keywords (whole word matches)
  // Use word boundaries to avoid false positives like "hr" in "chris"
  for (const keyword of organizationalKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(emailLocalPart)) {
      return true;
    }
  }

  // Analyze single-word names
  const words = nameLower.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Check if it's a proper name format (e.g., "Madonna", "Alice")
    const isProperName = /^[A-Z][a-z]+$/.test(fromName.trim());

    // If it's a proper name, treat as human regardless of email
    if (isProperName) {
      return false;
    }

    // If name equals email local-part AND it's not a proper name (e.g., "noreply" from "noreply@...")
    if (nameLower === emailLocalPart) {
      return true;
    }

    // Single word, not proper name format, likely organizational
    // (e.g., "CLAIMS", "support", "no-reply")
    if (words[0].length <= 15) {
      return true;
    }
  }

  return false;
}

/**
 * Post-processes draft response to fix [unavailable] in greetings.
 * For human senders: replaces [unavailable] with the sender's first name.
 * For organizational senders: replaces personal greetings with neutral "Hello,".
 *
 * @internal Exported for testing
 */
export function fixDraftGreeting(
  draftResponse: string,
  senderName: string,
  senderEmail: string
): string {
  const isOrg = isOrganizationalSender(senderName, senderEmail);

  // Match common greeting patterns at the start of the draft
  // Captures: greeting word, recipient, and optional comma
  const greetingPattern = /^(Dear|Hello|Hi)\s+(\[unavailable\]|[^,\n]+)(,?)/i;
  const match = draftResponse.match(greetingPattern);

  if (!match) {
    return draftResponse;
  }

  const greetingWord = match[1]; // "Dear", "Hello", "Hi"
  const recipientPart = match[2]; // "[unavailable]", "Claims", "John", etc.
  const hasComma = match[3] === ",";

  if (isOrg) {
    // For organizational senders, use neutral greeting
    // Replace "Dear [anything]" or "Hello [anything]" with "Hello,"
    return draftResponse.replace(greetingPattern, "Hello,");
  } else {
    // For human senders, only fix if it's [unavailable]
    if (recipientPart === "[unavailable]") {
      // Extract first name from full name (e.g., "John Doe" → "John")
      const firstName = senderName.trim().split(/\s+/)[0];
      const comma = hasComma ? "," : "";
      return draftResponse.replace(greetingPattern, `${greetingWord} ${firstName}${comma}`);
    }
  }

  return draftResponse;
}

/**
 * Extracts the list of valid tokens from a tokenMap.
 * Returns an array like ["{{EMAIL_1}}", "{{PERSON_1}}", "{{PERSON_2}}"].
 */
function extractValidTokens(tokenMap: Map<string, string>): string[] {
  return Array.from(tokenMap.keys()).sort();
}

/**
 * Corrects hallucinated token indices in AI output.
 * If the AI wrote {{EMAIL_2}} but only {{EMAIL_1}} exists in the map,
 * and there's exactly ONE email token, substitute it.
 * Only single-candidate corrections; ambiguous cases fall through.
 *
 * @internal Exported for testing
 */
export function correctTokenIndices(
  text: string,
  tokenMap: Map<string, string>
): { correctedText: string; corrections: string[] } {
  const corrections: string[] = [];

  // Build a map of token type → valid tokens of that type
  const tokensByType = new Map<string, string[]>();
  for (const token of tokenMap.keys()) {
    // Extract type from token like {{EMAIL_1}} → EMAIL
    const match = token.match(/^\{\{([A-Z_]+)_\d+\}\}$/);
    if (match) {
      const type = match[1];
      if (!tokensByType.has(type)) {
        tokensByType.set(type, []);
      }
      tokensByType.get(type)!.push(token);
    }
  }

  // Find all tokens in the text
  let correctedText = text;
  const tokenRegex = /\{\{([A-Z_]+)_(\d+)\}\}/g;
  const matches = Array.from(text.matchAll(tokenRegex));

  for (const match of matches) {
    const fullToken = match[0]; // e.g., "{{EMAIL_2}}"
    const type = match[1]; // e.g., "EMAIL"

    // If this token exists in the map, no correction needed
    if (tokenMap.has(fullToken)) {
      continue;
    }

    // Check if there's exactly ONE valid token of this type
    const validTokensOfType = tokensByType.get(type) || [];
    if (validTokensOfType.length === 1) {
      // Single candidate - safe to substitute
      const correctToken = validTokensOfType[0];
      correctedText = correctedText.replace(new RegExp(escapeRegex(fullToken), 'g'), correctToken);
      corrections.push(`${fullToken} → ${correctToken}`);
    }
    // If multiple or zero candidates, fall through (will become [unavailable])
  }

  return { correctedText, corrections };
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyze a single email using the redact → callAI → unredact → scanText pipeline.
 * Returns 429 JSON on rate limit (instead of 500) to allow client retry logic.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Guard: require GROQ_API_KEY before touching the database.
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        error: "AI analysis is unavailable. Please try again later.",
      },
      { status: 500 }
    );
  }

  // Parse body - expecting { emailId: string }
  let emailId: string;
  try {
    const body = await request.json();
    if (typeof body.emailId !== "string" || !body.emailId) {
      return NextResponse.json<AnalyzeOneResult>(
        {
          success: false,
          error: "Missing or invalid emailId in request body",
        },
        { status: 400 }
      );
    }
    emailId = body.emailId;
  } catch {
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        error: "Invalid JSON in request body",
      },
      { status: 400 }
    );
  }

  // Fetch the email from database
  let email;
  try {
    email = await prisma.email.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        gmailMessageId: true,
        fromEmail: true,
        fromName: true,
        subject: true,
        body: true,
        aiAnalysis: true,
      },
    });

    if (!email) {
      return NextResponse.json<AnalyzeOneResult>(
        {
          success: false,
          error: "Email not found",
        },
        { status: 404 }
      );
    }

    // Only analyze sample inbox emails (gmailMessageId === null)
    if (email.gmailMessageId !== null) {
      return NextResponse.json<AnalyzeOneResult>(
        {
          success: false,
          error: "Email is not a sample inbox email",
        },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("[analyze-sample] Failed to fetch email:", err);
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        error: "Database error",
      },
      { status: 500 }
    );
  }

  // Load entities for redaction
  const entities = await loadEntities();

  // Redact email content
  const senderRedaction = redact(email.fromEmail, entities);
  const subjectRedaction = redact(email.subject, entities);
  const bodyRedaction = redact(
    email.body.length > 4000 ? email.body.slice(0, 4000) : email.body,
    entities
  );

  const _tokenMap = new Map<string, string>([
    ...senderRedaction.tokenMap,
    ...subjectRedaction.tokenMap,
    ...bodyRedaction.tokenMap,
  ]);

  // Build redacted prompt
  const prompt = `Emails:

[0]
From: ${senderRedaction.redactedText}
Subject: ${subjectRedaction.redactedText}
Body:
${bodyRedaction.redactedText}`;

  const finalRedaction = redact(prompt, entities);

  // Extract valid tokens for the prompt
  const validTokens = extractValidTokens(finalRedaction.tokenMap);
  const tokenList = validTokens.length > 0
    ? validTokens.join(", ")
    : "none";

  // Determine if sender is organizational vs. human
  const isOrgSender = isOrganizationalSender(email.fromName, email.fromEmail);

  // Identify sender token for draft response greeting (only for human senders)
  let senderToken: string | null = null;
  if (!isOrgSender) {
    for (const [token, value] of finalRedaction.tokenMap.entries()) {
      if (value === email.fromName) {
        senderToken = token;
        break;
      }
    }
  }

  // Build sender-specific greeting instructions
  let greetingInstruction: string;
  if (isOrgSender) {
    greetingInstruction =
      "\nThe email sender is an organization or department (not a person). When writing a draft response, use a neutral professional greeting like \"Hello,\" or \"To whom it may concern,\" — do NOT use personal greetings like \"Dear [name]\".";
  } else if (senderToken) {
    greetingInstruction = ` The email sender's name is ${senderToken}.
When writing a draft response greeting, ALWAYS use the sender's name token to address them personally.`;
  } else {
    greetingInstruction = "";
  }

  const ANALYSIS_SYSTEM = `
You analyze emails for Dr. Song's acupuncture clinic.

CRITICAL: Your response MUST be ONLY valid JSON. No markdown, no code fences, no explanatory text before or after.

PLACEHOLDER TOKENS: The input email contains redacted data represented by placeholder tokens. The ONLY valid placeholder tokens in this email are: ${tokenList}
When copying names, emails, or other data from the input, copy the placeholder tokens EXACTLY character-for-character. Never invent new tokens or renumber existing ones.${greetingInstruction}

Return this exact structure with one email object:

{
  "emails": [
    {
      "category": "client",
      "urgency": "high",
      "actionRequired": true,
      "summaryTitle": "Example summary text here",
      "summaryDetails": ["Detail 1", "Detail 2"],
      "clientTags": ["Patient Name"],
      "recommendedActions": ["Action 1", "Action 2"],
      "dueDate": "2024-12-31",
      "dueTime": "2:30 PM",
      "draftResponse": "Dear Patient, ..."
    }
  ]
}

JSON RULES - NO EXCEPTIONS:
- Output ONLY the JSON object, nothing else
- NO markdown code fences (no triple backticks)
- NO explanatory text before or after
- Use double quotes for all keys and strings
- No trailing commas
- Use true/false for booleans, null for missing values
- The emails array must have exactly 1 object

FIELD RULES:

category:
- "client" = patient/client email about care, symptoms, appointments, or billing
- "insurance" = insurance company email about coverage, claims, or documentation
- "spam" = marketing, promotional, vendor, job, newsletter, or irrelevant email

urgency:
- "high" = immediate deadline, claim denial risk, documentation due within 14 days, or urgent medical concern
- "medium" = requires staff attention soon
- "low" = informational, completed transaction, newsletter, marketing, or spam

actionRequired:
- true if clinic staff needs to perform an action
- false if no action is needed

summaryTitle:
- Write exactly two complete, plain-language sentences (20-35 words total).
- Give a detailed but scannable account of the email's main request or outcome.
- Include the relevant sender or patient, dates or times, deadlines, requested documents or actions, and consequences when those facts are present.

summaryDetails:
- 3-6 concise strings
- Include important names, dates, times, requests, deadlines, and consequences

clientTags:
- Include every patient/client full name mentioned or directly associated with the email
- For a patient email, include the sender's name
- For insurance emails, include identifiable patient names
- For spam, return []

recommendedActions:
- If staff needs to do something, return an array of concrete actions
- Each action must begin with a verb
- Each action must be 3-10 words
- If no action is needed, return null

dueDate:
- Use the actual deadline mentioned in the email when available
- Format exactly as YYYY-MM-DD
- If there is no task deadline, put it a week from the task creation, but do not use null

dueTime:
- Use the actual deadline time when explicitly stated
- Format exactly as HH:MM AM/PM
- If no deadline time is stated, use null

draftResponse:
- For client or insurance emails requiring a response, write a warm, professional response
- Address the sender using their name token (the sender's name token is provided above)
- Acknowledge their request
- State the next step
- Keep it concise
- Return null for spam or emails that do not require a response

Remember:
OUTPUT ONLY THE VALID JSON OBJECT.
`;

  // Call AI with retry logic (max 1 retry on 429 or json_validate_failed)
  let aiResponse: string;
  let retryAfterMs = 0;

  try {
    aiResponse = await callAI(finalRedaction.redactedText, {
      systemPrompt: ANALYSIS_SYSTEM,
      jsonMode: true,
      temperature: 0.2, // Low temperature for copy fidelity
      timeoutMs: 60000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const lowerMessage = message.toLowerCase();

    const isRateLimit =
      message.includes("429") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("rate_limit_exceeded");

    const isJsonValidateFailed =
      lowerMessage.includes("json_validate_failed") ||
      lowerMessage.includes("failed to generate json");

    // Handle json_validate_failed - retry once with jsonMode off
    if (isJsonValidateFailed) {
      console.warn(
        `[analyze-sample] JSON validation failed for email ${emailId}. Retrying without JSON mode...`
      );

      try {
        aiResponse = await callAI(finalRedaction.redactedText, {
          systemPrompt: ANALYSIS_SYSTEM,
          jsonMode: false, // Disable JSON mode, let model output raw text
          temperature: 0.2, // Low temperature for copy fidelity
          timeoutMs: 60000,
        });
      } catch (retryErr: unknown) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error("[analyze-sample] AI retry without JSON mode failed:", retryMessage);
        return NextResponse.json<AnalyzeOneResult>(
          {
            success: false,
            emailId,
            error: "AI analysis failed after retry",
          },
          { status: 502 }
        );
      }
    } else if (isRateLimit) {
      // Handle rate limit with existing logic
      // Parse Groq's retry-after hint, cap at 4s
      const retryMatch = message.match(/try again in\s+([\d.]+)s/i);
      if (retryMatch) {
        const retrySeconds = Number(retryMatch[1]);
        retryAfterMs = Math.min(Math.ceil(retrySeconds * 1000), 4000);
      } else {
        retryAfterMs = 2000; // Default 2s
      }

      console.warn(
        `[analyze-sample] Rate limit hit for email ${emailId}. Waiting ${retryAfterMs}ms before retry...`
      );

      // Wait and retry once
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));

      try {
        aiResponse = await callAI(finalRedaction.redactedText, {
          systemPrompt: ANALYSIS_SYSTEM,
          jsonMode: true,
          temperature: 0.2, // Low temperature for copy fidelity
          timeoutMs: 60000,
        });
      } catch (retryErr: unknown) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        const retryIsRateLimit =
          retryMessage.includes("429") ||
          retryMessage.toLowerCase().includes("rate limit");

        if (retryIsRateLimit) {
          console.error(
            `[analyze-sample] Rate limit persisted after retry for email ${emailId}`
          );
          return NextResponse.json<AnalyzeOneResult>(
            {
              success: false,
              emailId,
              error: "Rate limit exceeded. Please try again in 5s",
            },
            { status: 429 }
          );
        }

        console.error("[analyze-sample] AI retry failed:", retryMessage);
        return NextResponse.json<AnalyzeOneResult>(
          {
            success: false,
            emailId,
            error: "AI analysis failed after retry",
          },
          { status: 502 }
        );
      }
    } else {
      // Neither json_validate_failed nor rate_limit - unknown error
      console.error("[analyze-sample] AI call failed:", message);
      return NextResponse.json<AnalyzeOneResult>(
        {
          success: false,
          emailId,
          error: "AI analysis failed",
        },
        { status: 502 }
      );
    }
  }

  // Correction pass: fix hallucinated token indices before unredacting
  const { correctedText, corrections } = correctTokenIndices(
    aiResponse,
    finalRedaction.tokenMap
  );

  // Log corrections if any were made
  if (corrections.length > 0) {
    console.warn(
      `[analyze-sample] Corrected ${corrections.length} token index error(s) for email ${emailId}:`,
      corrections
    );
  }

  // Unredact the corrected AI response
  const { originalText: unredactedResponse } = unredact(
    correctedText,
    finalRedaction.tokenMap
  );

  // Parse JSON response
  const jsonText = unredactedResponse.startsWith("```")
    ? unredactedResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    : unredactedResponse;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("[analyze-sample] Failed to parse AI response");
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        emailId,
        error: "Invalid AI response format",
      },
      { status: 500 }
    );
  }

  // Accept both { emails: [...] } (preferred) and bare [...] (legacy fallback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailResults: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.emails)
    ? parsed.emails
    : [];

  if (emailResults.length !== 1) {
    console.error(
      `[analyze-sample] Expected 1 result, got ${emailResults.length}`
    );
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        emailId,
        error: "AI returned wrong number of results",
      },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = emailResults[0] as any;

  // Validate and normalize result, applying token cleanup to all text fields
  const analysis: AnalysisData = {
    category: ["client", "insurance", "spam"].includes(item.category)
      ? item.category
      : "spam",
    urgency: ["high", "medium", "low"].includes(item.urgency)
      ? item.urgency
      : "low",
    actionRequired: Boolean(item.actionRequired),
    summaryTitle: stripLeftoverTokens(String(item.summaryTitle || item.summary || "").trim()),
    summaryDetails: Array.isArray(item.summaryDetails)
      ? (item.summaryDetails
          .map((detail: unknown) => stripLeftoverTokens(String(detail).trim()))
          .filter(Boolean)
          .slice(0, 6) as string[])
      : [],
    clientTags: Array.isArray(item.clientTags)
      ? ([
          ...new Set(
            item.clientTags.map((name: unknown) => stripLeftoverTokens(String(name).trim())).filter(Boolean)
          ),
        ].slice(0, 6) as string[])
      : [],
    recommendedActions: Array.isArray(item.recommendedActions)
      ? ([
          ...new Set<string>(
            item.recommendedActions
              .map((action: unknown): string => stripLeftoverTokens(String(action).trim()))
              .filter(Boolean)
          ),
        ].slice(0, 10) as string[])
      : null,
    draftResponse: item.draftResponse
      ? fixDraftGreeting(
          stripLeftoverTokens(String(item.draftResponse).trim()),
          email.fromName,
          email.fromEmail
        )
      : null,
    dueDate:
      item.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : null,
    dueTime:
      item.dueTime && /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i.test(String(item.dueTime))
        ? String(item.dueTime).trim().toUpperCase()
        : null,
  };

  // Run scanText on final values (warn only, don't throw)
  try {
    scanText(analysis.summaryTitle, { throwOnHighSeverityMiss: false });
    for (const detail of analysis.summaryDetails) {
      scanText(detail, { throwOnHighSeverityMiss: false });
    }
    for (const tag of analysis.clientTags) {
      scanText(tag, { throwOnHighSeverityMiss: false });
    }
    if (analysis.recommendedActions) {
      for (const action of analysis.recommendedActions) {
        scanText(action, { throwOnHighSeverityMiss: false });
      }
    }
    if (analysis.draftResponse) {
      scanText(analysis.draftResponse, { throwOnHighSeverityMiss: false });
    }
  } catch (err) {
    console.error("[analyze-sample] scanText error:", err);
  }

  // Persist the result to database
  try {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        aiSummary: analysis.summaryTitle,
        aiDraft: analysis.draftResponse,
        aiAnalysis: {
          category: analysis.category,
          urgency: analysis.urgency,
          actionRequired: analysis.actionRequired,
          summaryTitle: analysis.summaryTitle,
          summaryDetails: analysis.summaryDetails,
          clientTags: analysis.clientTags,
          recommendedActions: analysis.recommendedActions,
          dueDate: analysis.dueDate,
          dueTime: analysis.dueTime,
        },
      },
    });
  } catch (err) {
    console.error("[analyze-sample] Failed to persist analysis:", err);
    return NextResponse.json<AnalyzeOneResult>(
      {
        success: false,
        emailId,
        error: "Failed to save analysis",
      },
      { status: 500 }
    );
  }

  return NextResponse.json<AnalyzeOneResult>({
    success: true,
    emailId,
    analyzed: true,
    analysis,
  });
}
