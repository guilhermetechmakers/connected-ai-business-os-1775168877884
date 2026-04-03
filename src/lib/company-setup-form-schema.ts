import { z } from "zod";

const departmentSchema = z.object({ name: z.string().min(1, "Required") });

export const companySetupFormSchema = z.object({
  legalName: z.string().min(2),
  displayName: z.string().min(2),
  country: z.string().max(120).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  website: z.string().max(500).optional().or(z.literal("")),
  logoUrl: z.string().max(2000).optional().or(z.literal("")),
  taxId: z.string().max(80).optional(),
  timezone: z.string(),
  currency: z.string(),
  departments: z.array(departmentSchema).min(1, "Add at least one department"),
  templateId: z.string().uuid().optional(),
});

export type CompanySetupFormValues = z.infer<typeof companySetupFormSchema>;
