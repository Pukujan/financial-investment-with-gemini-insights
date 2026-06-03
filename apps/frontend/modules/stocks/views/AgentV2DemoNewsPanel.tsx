import type { CachedDemoMarketNews } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  payload: CachedDemoMarketNews | null;
  loading: boolean;
  error: string | null;
};

export function AgentV2DemoNewsPanel({ payload, loading, error }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 text-sm text-amber-900">{error}</CardContent>
      </Card>
    );
  }

  if (!payload) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Synthetic Demo Market News</CardTitle>
        <CardDescription>
          Generated from Yahoo 30-day stock trend · prompt {AGENT_V2_PROMPT_VERSION} · cached until{' '}
          {new Date(payload.expiresAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
          These are synthetic demo market-news items generated from 30-day Yahoo stock trend data.
          They are not live news and should not be used for investment decisions.
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
    </Card>
  );
}
