import type { CachedDemoMarketNews } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import { Newspaper } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  payload: CachedDemoMarketNews | null;
  loading: boolean;
  error: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
};

export function AgentV2DemoNewsPanel({
  payload,
  loading,
  error,
  canGenerate,
  onGenerate,
}: Props) {
  return (
    <Card className="mt-6 border-t pt-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Synthetic Demo Market News</CardTitle>
            <CardDescription>
              Generated from Yahoo 30-day stock trend · prompt {AGENT_V2_PROMPT_VERSION}
              {payload ? ` · cached until ${new Date(payload.expiresAt).toLocaleString()}` : ''}
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
          >
            <Newspaper className="w-4 h-4 mr-2" />
            {loading ? 'Generating…' : payload ? 'Regenerate 20 Demo News' : 'Generate 20 Demo News'}
          </Button>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="px-0 space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      )}

      {error && !loading && (
        <CardContent className="px-0">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        </CardContent>
      )}

      {!loading && !error && !payload && (
        <CardContent className="px-0">
          <p className="text-sm text-muted-foreground text-center py-6">
            Click Generate to create 20 synthetic demo news items from this symbol&apos;s Yahoo
            30-day trend. Results are cached for 24 hours per symbol.
          </p>
        </CardContent>
      )}

      {payload && !loading && (
        <CardContent className="px-0 space-y-3">
          <p className="text-xs rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
            Generated from Yahoo 30-day stock trend. These are synthetic demo items — not live news.
            Do not use for investment decisions.
          </p>
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {payload.items.map(item => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900">{item.headline}</span>
                  <Badge variant="outline">{item.source}</Badge>
                  <Badge variant="secondary">{item.sentiment}</Badge>
                  <Badge variant="outline">{item.impact} impact</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(item.publishedAt).toLocaleString()}
                </p>
                <p className="text-slate-700">{item.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tags: {item.catalystTags.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
