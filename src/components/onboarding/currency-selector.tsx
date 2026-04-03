import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
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
import { CURRENCY_OPTIONS, getCurrencyOption } from "@/lib/currencies";
import { cn } from "@/lib/utils";

interface CurrencySelectorProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
}

export function CurrencySelector<T extends FieldValues>({
  control,
  name,
  label = "Currency",
}: CurrencySelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const options = Array.isArray(CURRENCY_OPTIONS) ? CURRENCY_OPTIONS : [];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const cur = getCurrencyOption(String(field.value ?? ""));
        return (
          <FormItem className="flex flex-col">
            <FormLabel id={`${String(name)}-currency-label`}>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`${label}: ISO currency picker with symbol preview`}
                    aria-labelledby={`${String(name)}-currency-label`}
                    className={cn(
                      "h-11 justify-between border-border/60 bg-surface-inner font-normal",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {cur ? (
                        <>
                          <span className="font-mono text-primary">{cur.symbol}</span>{" "}
                          {cur.code} — {cur.label}
                        </>
                      ) : (
                        "Select currency"
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,360px)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search ISO code…" />
                  <CommandList className="max-h-64">
                    <CommandEmpty>No currency found.</CommandEmpty>
                    <CommandGroup>
                      {options.map((c) => (
                        <CommandItem
                          key={c.code}
                          value={`${c.code} ${c.label}`}
                          onSelect={() => {
                            field.onChange(c.code);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              c.code === field.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-mono text-primary">{c.symbol}</span>
                          <span className="ml-2">{c.code}</span>
                          <span className="ml-2 text-muted-foreground">{c.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {cur ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Preview: <span className="text-foreground">{cur.symbol}</span> 1,234.56
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
