import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function ProfileContactFields({ control }: { control: Control<FieldValues> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name={"jobTitle" as FieldPath<FieldValues>}
        render={({ field }) => (
          <FormItem className="sm:col-span-1">
            <FormLabel>Job title</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner" placeholder="VP Operations" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"department" as FieldPath<FieldValues>}
        render={({ field }) => (
          <FormItem className="sm:col-span-1">
            <FormLabel>Department</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner" placeholder="Revenue" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"phone" as FieldPath<FieldValues>}
        render={({ field }) => (
          <FormItem className="sm:col-span-1">
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner" type="tel" placeholder="+1 …" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"address" as FieldPath<FieldValues>}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Input className="bg-surface-inner" placeholder="City, region" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
