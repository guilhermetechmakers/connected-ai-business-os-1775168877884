type ResendEmailRecipient = string | string[];

export type SendResendEmailInput = {
  from: string;
  to: ResendEmailRecipient;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: ResendEmailRecipient;
  apiKey?: string;
};

export type SendResendEmailResult = {
  id: string;
};

export type ResendEmailError = Error & {
  status?: number;
  detail?: string;
};

function toRecipientArray(value: ResendEmailRecipient | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function buildError(message: string, status?: number, detail?: string): ResendEmailError {
  return Object.assign(new Error(message), { status, detail });
}

export async function sendResendEmail(
  input: SendResendEmailInput,
): Promise<SendResendEmailResult> {
  const apiKey = input.apiKey?.trim() || Deno.env.get("RESEND_API_KEY")?.trim() || "";
  if (!apiKey) {
    throw buildError("Missing Resend API key (configure RESEND_API_KEY or provide apiKey)");
  }

  const body = {
    from: input.from,
    to: toRecipientArray(input.to),
    subject: input.subject,
    text: input.text,
    html: input.html,
    reply_to: toRecipientArray(input.replyTo),
  };

  if (!body.text && !body.html) {
    body.text = "(no body)";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "connected-ai-business-os/edge-functions",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await response.text();
    let detail = truncate(raw);
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: unknown };
      detail = truncate(
        parsed.message ||
          (typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error)),
      );
    } catch {
      // Keep response text as detail when payload isn't valid JSON.
    }
    throw buildError(`Resend: ${response.status} ${detail}`, response.status, detail);
  }

  const json = await response.json().catch(() => ({})) as { id?: string };
  if (!json?.id) {
    throw buildError("Resend: response missing email id", response.status);
  }

  return { id: json.id };
}
