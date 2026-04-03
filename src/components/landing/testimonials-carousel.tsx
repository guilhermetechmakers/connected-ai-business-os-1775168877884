import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LandingTestimonial } from "@/types/landing-content";

export interface TestimonialsCarouselProps {
  items?: LandingTestimonial[] | null;
  className?: string;
  intervalMs?: number;
}

export function TestimonialsCarousel({
  items,
  className,
  intervalMs = 6500,
}: TestimonialsCarouselProps) {
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const len = list.length;
  const safeIndex = len > 0 ? index % len : 0;
  const current = len > 0 ? list[safeIndex] : undefined;

  const go = useCallback(
    (dir: -1 | 1) => {
      if (len === 0) return;
      setIndex((i) => (i + dir + len) % len);
    },
    [len],
  );

  useEffect(() => {
    if (len <= 1 || paused || reduceMotionRef.current) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [len, paused, intervalMs]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  if (len === 0) {
    return (
      <section
        className={cn("px-6 py-16 lg:px-24", className)}
        aria-label="Customer testimonials"
      >
        <p className="text-center text-sm text-muted-foreground">
          Testimonials will appear here when available.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn("px-6 py-24 lg:px-24", className)}
      aria-roledescription="carousel"
      aria-label="Customer logos and testimonials"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Trusted by operators</h2>
          <p className="text-lg text-muted-foreground">
            Teams standardizing on integration-first orchestration and audited AI.
          </p>
        </div>
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-200 hover:shadow-card-hover">
            <CardContent className="space-y-8 p-8 md:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex h-12 min-w-[7rem] items-center justify-center rounded-lg border border-border/60 bg-surface-inner px-4">
                  {current?.logoUrl ? (
                    <img
                      src={current.logoUrl}
                      alt=""
                      className="max-h-8 w-auto object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {current?.author?.slice(0, 2) ?? "CX"}
                    </span>
                  )}
                </div>
                <Quote className="h-8 w-8 text-primary/40" aria-hidden />
              </div>
              <blockquote className="text-xl font-medium leading-relaxed text-foreground md:text-2xl">
                “{current?.quote ?? ""}”
              </blockquote>
              <footer className="text-sm">
                <cite className="not-italic font-semibold text-foreground">{current?.author}</cite>
                <p className="text-muted-foreground">{current?.role}</p>
              </footer>
            </CardContent>
          </Card>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Previous testimonial"
              onClick={() => go(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-2" role="tablist" aria-label="Testimonial slides">
              {list.map((_, i) => (
                <button
                  key={list[i]?.id ?? `dot-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border border-border/60 transition-all duration-150",
                    i === safeIndex ? "scale-125 bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Next testimonial"
              onClick={() => go(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
