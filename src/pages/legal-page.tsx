import { PublicChrome } from "@/components/layout/public-chrome";
import { AnimatedPage } from "@/components/animated-page";

export function LegalPage({
  title,
  body,
}: {
  title: string;
  body: string[];
}) {
  return (
    <PublicChrome>
      <AnimatedPage className="mx-auto max-w-3xl px-6 py-16 lg:px-24">
        <article className="prose prose-invert max-w-none prose-headings:font-display prose-p:text-muted-foreground">
          <h1>{title}</h1>
          {body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </article>
      </AnimatedPage>
    </PublicChrome>
  );
}
