import { Badge } from '../../ui/badge';
import { CpuIcon } from '../../ui/cpu';
import { FileTextIcon } from '../../ui/file-text';
import { PenToolIcon } from '../../ui/pen-tool';

export function HowItWorks() {
  return (
    <section className="py-24 px-4 container mx-auto">
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        <Badge className="mb-6 px-4 py-2">How it works</Badge>
        <h2 className="text-3xl md:text-5xl font-bold font-sans tracking-tight mb-6">
          From link to scroll‑stopping post
        </h2>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl">
          Paste a link—watch real‑time analysis, tone‑matched examples, and a
          platform‑perfect draft stream in.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl border border-border bg-card/60 shadow-sm">
          <div className="mb-4 flex items-center justify-center">
            <CpuIcon className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Analyze</h3>
          <p className="text-sm text-muted-foreground">
            We parse your link for key ideas, audience, and content type—fast.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card/60 shadow-sm">
          <div className="mb-4 flex items-center justify-center">
            <FileTextIcon className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Match</h3>
          <p className="text-sm text-muted-foreground">
            We surface tone‑matched examples to guide voice and structure.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card/60 shadow-sm">
          <div className="mb-4 flex items-center justify-center">
            <PenToolIcon className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Write</h3>
          <p className="text-sm text-muted-foreground">
            We stream a platform‑perfect draft with your tone profile baked in.
          </p>
        </div>
      </div>
    </section>
  );
}
