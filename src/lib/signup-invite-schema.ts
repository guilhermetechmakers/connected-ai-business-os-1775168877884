import { z } from "zod";

const passwordComplex = z
  .string()
  .min(10, "Use at least 10 characters")
  .refine((pw) => /\d/.test(pw), { message: "Include a number" })
  .refine((pw) => /[A-Z]/.test(pw), { message: "Include an uppercase letter" })
  .refine((pw) => /[^A-Za-z0-9]/.test(pw), { message: "Include a special character" });

export const signupInviteStep0Schema = z
  .object({
    entryMode: z.enum(["signup", "invite"]),
    tenantName: z.string().max(200).optional(),
    domainHint: z.string().max(200).optional(),
    inviteToken: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entryMode === "signup") {
      if (!data.tenantName?.trim() || data.tenantName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tenantName"],
          message: "Company name required",
        });
      }
      const h = data.domainHint?.trim();
      if (h && !/^[\w.-]+$/.test(h)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["domainHint"],
          message: "Use letters, numbers, dots, and hyphens only",
        });
      }
    } else if (!data.inviteToken?.trim() || data.inviteToken.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inviteToken"],
        message: "Valid invite token required",
      });
    }
  });

export const signupInviteStep1Schema = z
  .object({
    firstName: z.string().min(1, "First name required").max(100),
    lastName: z.string().min(1, "Last name required").max(100),
    email: z.string().email("Valid work email required"),
    password: passwordComplex,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match",
      });
    }
  });

export const signupInviteStep2Schema = z.object({
  timeZone: z.string().min(1).max(80),
  currency: z.string().min(1).max(16),
  departments: z
    .array(z.object({ name: z.string().min(1).max(120) }))
    .min(1, "Add at least one department")
    .max(50),
  integrationKeys: z.array(z.string()).max(32),
});

export const signupInviteFormSchema = z
  .object({
    entryMode: z.enum(["signup", "invite"]),
    tenantName: z.string().max(200).optional(),
    domainHint: z.string().max(200).optional(),
    inviteToken: z.string().max(500).optional(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    password: passwordComplex,
    confirmPassword: z.string().min(1),
    timeZone: z.string().min(1).max(80),
    currency: z.string().min(1).max(16),
    departments: z
      .array(z.object({ name: z.string().min(1).max(120) }))
      .min(1)
      .max(50),
    integrationKeys: z.array(z.string()).max(32),
    acceptTerms: z.boolean().refine((v) => v, {
      message: "Accept terms to continue",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match",
      });
    }
    if (data.entryMode === "signup") {
      if (!data.tenantName?.trim() || data.tenantName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tenantName"],
          message: "Company name required",
        });
      }
      const h = data.domainHint?.trim();
      if (h && !/^[\w.-]+$/.test(h)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["domainHint"],
          message: "Use letters, numbers, dots, and hyphens only",
        });
      }
    } else if (!data.inviteToken?.trim() || data.inviteToken.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inviteToken"],
        message: "Valid invite token required",
      });
    }
  });

export type SignupInviteFormValues = z.infer<typeof signupInviteFormSchema>;

export const signupInviteStepSchemas = [
  signupInviteStep0Schema,
  signupInviteStep1Schema,
  signupInviteStep2Schema,
] as const;
