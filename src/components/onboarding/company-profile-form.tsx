import type { Control } from "react-hook-form";

import type { CompanySetupFormValues } from "@/lib/company-setup-form-schema";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CompanyProfileFormProps {
  control: Control<CompanySetupFormValues>;
}

export function CompanyProfileForm({ control }: CompanyProfileFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="legalName"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Legal company name</FormLabel>
            <FormControl>
              <Input
                className="bg-surface-inner border-border/60"
                autoComplete="organization"
                aria-required
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="displayName"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Display name</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner border-border/60" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="addressLine1"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Street address</FormLabel>
            <FormControl>
              <Input
                className="bg-surface-inner border-border/60"
                placeholder="Line 1"
                autoComplete="street-address"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="addressLine2"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Address line 2 (optional)</FormLabel>
            <FormControl>
              <Input
                className="bg-surface-inner border-border/60"
                placeholder="Suite, unit, building"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="city"
        render={({ field }) => (
          <FormItem>
            <FormLabel>City</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner border-border/60" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="region"
        render={({ field }) => (
          <FormItem>
            <FormLabel>State / region</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner border-border/60" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="postalCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Postal code</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner border-border/60" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="country"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country (optional)</FormLabel>
            <FormControl>
              <Input
                className="bg-surface-inner border-border/60"
                placeholder="e.g. United States"
                autoComplete="country-name"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="website"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Website</FormLabel>
            <FormControl>
              <Input
                className="bg-surface-inner border-border/60"
                type="url"
                inputMode="url"
                placeholder="https://"
                autoComplete="url"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="logoUrl"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Logo URL or data URL</FormLabel>
            <FormControl>
              <Textarea
                className="min-h-[80px] resize-y bg-surface-inner border-border/60 font-mono text-xs"
                placeholder="https://… or paste a small data URL"
                aria-label="Company logo URL or embedded image data URL"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="taxId"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>VAT / tax ID (optional)</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner border-border/60" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
