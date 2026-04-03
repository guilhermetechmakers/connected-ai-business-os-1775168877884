import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTimeZoneOptions } from "@/lib/timezones";
import { cn } from "@/lib/utils";

interface TimezoneSelectorProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
}

export function TimezoneSelector<T extends FieldValues>({
  control,
  name,
  label = "Timezone",
}: TimezoneSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => getTimeZoneOptions(), []);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel id={`${String(name)}-label`}>{label}</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-label={`${label}: searchable timezone list`}
                  aria-labelledby={`${String(name)}-label`}
                  className={cn(
                    "h-11 justify-between border-border/60 bg-surface-inner font-normal",
                    !field.value && "text-muted-foreground",
                  )}
                >
                  {field.value
                    ? String(field.value)
                    : "Select timezone"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search timezone…" />
                <CommandList className="max-h-64">
                  <CommandEmpty>No timezone found.</CommandEmpty>
                  <CommandGroup>
                    {(zones ?? []).map((z) => (
                      <CommandItem
                        key={z}
                        value={z}
                        onSelect={() => {
                          field.onChange(z);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            z === field.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {z}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
