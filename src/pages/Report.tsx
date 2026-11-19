import { useMemo, useState } from 'react';
import { FileDown, FileText, Printer } from 'lucide-react';
import { useScenario } from '../state/scenarioStore';
import { useSimulation } from '../hooks/useSimulation';
import { RunStatus } from '../components/RunStatus';
import { Button, Callout, Card, CardBody, CardHeader } from '../components/ui/core';
import { PageHeader } from '../components/PageHeader';
import { buildReportMarkdown, markdownToHtml } from '../lib/report';
import { downloadText, slug } from '../lib/download';

const GRID = [0, 0.1, 0.2, 0.3, 0.4];

export default function Report() {
  const s = useScenario((x) => x.current);
  const auto = useSimulation<'automation'>();
  const cmp = useSimulation<'compare'>();
  const [generatedAt, setGeneratedAt] = useState('');
  const ready = auto.state.status === 'done' && cmp.state.status === 'done';
  const md = useMemo(
    () =>
      auto.state.status === 'done' && cmp.state.status === 'done'
        ? buildReportMarkdown(s, auto.state.result, cmp.state.result, generatedAt)
        : '',
    [s, auto.state, cmp.state, generatedAt],
  );
  const html = useMemo(() => (md ? markdownToHtml(md, `Policy report: ${s.name}`) : ''), [md, s.name]);
  const runBoth = () => {
    setGeneratedAt(new Date().toISOString().slice(0, 16).replace('T', ' '));
    auto.run({ kind: 'automation', scenario: s, adoptions: GRID });
    cmp.run({ kind: 'compare', scenario: s });
  };
  const status =
    auto.state.status === 'running' || cmp.state.status === 'running'
      ? auto.state
      : ready
        ? cmp.state
        : auto.state.status === 'error'
          ? auto.state
          : cmp.state;
  return (
    <>
      <PageHeader
        title="Policy report"
        lead="An automatically generated, evidence-based summary of the current scenario, which you can download as Markdown, HTML or PDF (print). It is generated entirely in your browser."
      />
      <Card className="mb-6 no-print">
        <CardBody className="flex flex-wrap items-center gap-3">
          <RunStatus
            state={status}
            onRun={runBoth}
            onCancel={() => {
              auto.cancel();
              cmp.cancel();
            }}
            label="Generate report"
          />
          {md && (
            <>
              <Button
                variant="outline"
                onClick={() => downloadText(`${slug(s.name)}-report.md`, md, 'text/markdown')}
                data-testid="download-md"
              >
                <FileText className="h-4 w-4" aria-hidden /> Markdown
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadText(`${slug(s.name)}-report.html`, html, 'text/html')}
                data-testid="download-html"
              >
                <FileDown className="h-4 w-4" aria-hidden /> HTML
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden /> Print / PDF
              </Button>
            </>
          )}
        </CardBody>
      </Card>
      {md ? (
        <Card>
          <CardHeader title="Preview" />
          <CardBody>
            {/* Rendered from our own escaped Markdown subset (no user HTML). */}
            <article
              className="prose-report space-y-2 text-sm [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_table]:text-xs [&_td]:border [&_td]:px-1 [&_th]:border [&_th]:px-1 [&_ul]:list-disc [&_ul]:pl-5"
              data-testid="report-preview"
              dangerouslySetInnerHTML={{ __html: html.replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, '') }}
            />
          </CardBody>
        </Card>
      ) : (
        <Callout>Press “Generate report” to compute the scenario and build the summary.</Callout>
      )}
    </>
  );
}
