import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "AI Metrics — Dr. Song" };

async function loadAggregates() {
  const [ratingAggregate, recentRatings, batchAggregate, recentBatches] = await Promise.all([
    prisma.emailMetric.aggregate({
      _count: { id: true },
      _avg: {
        analysisUsefulness: true,
        koreanTranslationAccuracy: true,
      },
    }),
    prisma.emailMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        analysisUsefulness: true,
        koreanTranslationAccuracy: true,
        createdAt: true,
        email: {
          select: { id: true, subject: true },
        },
      },
    }),
    prisma.analysisBatch.aggregate({
      where: { completedAt: { not: null } },
      _count: { id: true },
      _avg: { durationMs: true },
      _sum: { emailsAttempted: true, emailsSucceeded: true, emailsFailed: true },
    }),
    prisma.analysisBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { completedAt: { not: null } },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        emailsAttempted: true,
        emailsSucceeded: true,
        emailsFailed: true,
        success: true,
      },
    }),
  ]);
  return { ratingAggregate, recentRatings, batchAggregate, recentBatches };
}

function ScoreBar({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-[#9b8070]">—</span>;
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-[#e8d9cc] overflow-hidden">
        <div
          className="h-2 rounded-full bg-[#286985] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold text-[#3f2b20]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#765d4e]">{title}</p>
      <div className="mt-2 text-3xl font-bold text-[#3f2b20]">{value}</div>
      {subtitle && (
        <p className="mt-1 text-xs text-[#9b8070]">{subtitle}</p>
      )}
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default async function MetricsDashboardPage() {
  await connection();

  const { ratingAggregate, recentRatings, batchAggregate, recentBatches } = await loadAggregates();

  const count = ratingAggregate._count.id;
  const avgAnalysis = ratingAggregate._avg.analysisUsefulness;
  const avgKorean = ratingAggregate._avg.koreanTranslationAccuracy;

  const batchCount = batchAggregate._count.id;
  const avgDurationMs = batchAggregate._avg.durationMs;
  const totalAttempted = batchAggregate._sum.emailsAttempted ?? 0;
  const totalSucceeded = batchAggregate._sum.emailsSucceeded ?? 0;
  const totalFailed = batchAggregate._sum.emailsFailed ?? 0;
  const successRate = totalAttempted > 0 ? totalSucceeded / totalAttempted : null;

  const hasRatingData = count > 0;
  const hasBatchData = batchCount > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#3f2b20]">
          AI Quality Metrics
        </h1>
        <p className="mt-1 text-sm text-[#765d4e]">
          Aggregate staff ratings for AI-generated summaries and Korean translations.
        </p>
      </div>

      {/* ── Analysis Performance ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#3f2b20]">Analysis Performance</h2>

        {!hasBatchData ? (
          <div className="rounded-2xl border border-dashed border-[#cbb199] bg-[#fffaf2]/70 p-8 text-center">
            <p className="text-sm font-medium text-[#765d4e]">No analysis runs recorded yet.</p>
            <p className="mt-1 text-xs text-[#9b8070]">
              Metrics are recorded automatically each time the inbox analyzer is triggered.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                title="Avg. batch duration"
                value={formatMs(avgDurationMs)}
                subtitle={`Across ${batchCount} completed ${batchCount === 1 ? "batch" : "batches"}`}
              />
              <StatCard
                title="Success rate"
                value={
                  successRate !== null ? (
                    <span>
                      {(successRate * 100).toFixed(1)}
                      <span className="ml-0.5 text-base font-normal text-[#9b8070]">%</span>
                    </span>
                  ) : "—"
                }
                subtitle={`${totalSucceeded} succeeded · ${totalFailed} failed · ${totalAttempted} total emails`}
              />
              <StatCard
                title="Emails analyzed"
                value={totalSucceeded}
                subtitle={`Across all completed batches`}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7 space-y-3">
              <h3 className="text-sm font-semibold text-[#3f2b20]">Success rate</h3>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-[#e8d9cc] overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-[#286985] transition-all"
                    style={{ width: `${successRate !== null ? successRate * 100 : 0}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-semibold text-[#3f2b20]">
                  {successRate !== null ? `${(successRate * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <p className="text-xs text-[#9b8070]">
                {totalSucceeded} emails succeeded out of {totalAttempted} attempted
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7 space-y-4">
              <h3 className="text-sm font-semibold text-[#3f2b20]">
                Recent batches
                <span className="ml-2 text-xs font-normal text-[#9b8070]">(last {recentBatches.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e8d9cc] text-left">
                      <th className="pb-3 font-semibold text-[#765d4e]">Started</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-center">Emails</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-center">Succeeded</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-center">Failed</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-right">Duration</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBatches.map((b) => (
                      <tr key={b.id} className="border-b border-[#f4eee7] last:border-0">
                        <td className="py-3 pr-4 text-xs text-[#9b8070]">
                          {formatDate(b.startedAt)}
                        </td>
                        <td className="py-3 text-center text-[#513a2e]">{b.emailsAttempted}</td>
                        <td className="py-3 text-center font-semibold text-[#286985]">{b.emailsSucceeded}</td>
                        <td className="py-3 text-center font-semibold text-red-500">{b.emailsFailed}</td>
                        <td className="py-3 text-right text-[#513a2e]">{formatMs(b.durationMs)}</td>
                        <td className="py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.success
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {b.success ? "OK" : "Partial"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Staff Quality Ratings ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#3f2b20]">Staff Quality Ratings</h2>

        {!hasRatingData ? (
          <div className="rounded-2xl border border-dashed border-[#cbb199] bg-[#fffaf2]/70 p-8 text-center">
            <p className="text-sm font-medium text-[#765d4e]">No ratings submitted yet.</p>
            <p className="mt-1 text-xs text-[#9b8070]">
              Staff can submit ratings from any individual email page using the &ldquo;Rate AI quality&rdquo; link.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                title="Total ratings"
                value={count}
                subtitle="Submissions from all emails"
              />
              <StatCard
                title="Avg. analysis usefulness"
                value={
                  avgAnalysis !== null ? (
                    <span>{avgAnalysis.toFixed(2)}<span className="ml-1 text-base font-normal text-[#9b8070]">/ 5</span></span>
                  ) : "—"
                }
                subtitle="1 = not useful · 5 = very useful"
              />
              <StatCard
                title="Avg. Korean accuracy"
                value={
                  avgKorean !== null ? (
                    <span>{avgKorean.toFixed(2)}<span className="ml-1 text-base font-normal text-[#9b8070]">/ 5</span></span>
                  ) : "—"
                }
                subtitle="1 = not accurate · 5 = very accurate"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7 space-y-5">
              <h3 className="text-sm font-semibold text-[#3f2b20]">Score breakdown</h3>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-[#765d4e]">AI Analysis Usefulness</p>
                  <ScoreBar value={avgAnalysis} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[#765d4e]">Korean Translation Accuracy</p>
                  <ScoreBar value={avgKorean} />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#8c6349]/15 bg-[#fffaf2]/80 p-5 shadow-sm sm:p-7 space-y-4">
              <h3 className="text-sm font-semibold text-[#3f2b20]">
                Recent ratings
                <span className="ml-2 text-xs font-normal text-[#9b8070]">(last {recentRatings.length})</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e8d9cc] text-left">
                      <th className="pb-3 font-semibold text-[#765d4e]">Email subject</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-center">Analysis</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-center">Korean</th>
                      <th className="pb-3 font-semibold text-[#765d4e] text-right">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRatings.map((r) => (
                      <tr key={r.id} className="border-b border-[#f4eee7] last:border-0">
                        <td className="py-3 pr-4 text-[#513a2e] max-w-xs truncate">
                          <a
                            href={`/email/${r.email.id}`}
                            className="hover:underline hover:text-[#286985]"
                          >
                            {r.email.subject}
                          </a>
                        </td>
                        <td className="py-3 text-center font-semibold text-[#286985]">
                          {r.analysisUsefulness}
                        </td>
                        <td className="py-3 text-center font-semibold text-[#286985]">
                          {r.koreanTranslationAccuracy}
                        </td>
                        <td className="py-3 text-right text-xs text-[#9b8070]">
                          {formatDate(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
