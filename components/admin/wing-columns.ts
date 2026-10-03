// Heatmap columns shared by the Overview (wings) and Wings (platoons) tabs.
// Works for any row that carries the same metric fields as WingInsight.
import type { HeatColumn } from '@/components/admin/charts'
import type { WingInsight } from '@/lib/admin-analytics'

export type MetricRow = Pick<WingInsight,
    'activePct' | 'adherencePct' | 'proteinHitPct' | 'avgSleepH' | 'trainingMinWk' | 'ipptPassPct' | 'atRiskPct'>

export const WING_COLUMNS: HeatColumn<MetricRow>[] = [
    { key: 'active', label: 'Daily logging', get: w => w.activePct, format: v => `${v}%`, weak: 30, strong: 90 },
    { key: 'adherence', label: 'Calories on target', get: w => w.adherencePct, format: v => `${v}%`, weak: 20, strong: 70 },
    { key: 'protein', label: 'Protein target', get: w => w.proteinHitPct, format: v => `${v}%`, weak: 20, strong: 70 },
    { key: 'sleep', label: 'Avg sleep', get: w => w.avgSleepH, format: v => `${v}h`, weak: 5, strong: 7.5 },
    { key: 'training', label: 'Training / wk', get: w => w.trainingMinWk, format: v => `${v}m`, weak: 30, strong: 180 },
    { key: 'ippt', label: 'IPPT pass', get: w => w.ipptPassPct, format: v => `${v}%`, weak: 50, strong: 95 },
    { key: 'risk', label: 'At risk', get: w => w.atRiskPct, format: v => `${v}%`, weak: 60, strong: 5 },
]

export const wingHref = (wing: string) => `/dashboard/admin/wings?wing=${encodeURIComponent(wing)}`

