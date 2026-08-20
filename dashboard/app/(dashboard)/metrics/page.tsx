import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "AI Metrics — Dr. Song" };

async function loadAggregates() {
  const [ratingAggregate, recentRatings] = await Promise.all([
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
  ]);
  return { ratingAggregate, recentRatings };
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

export default async function MetricsDashboardPage() {
  await connection();

  const { ratingAggregate, recentRatings } = await loadAggregates();

  const count = ratingAggregate._count.id;
  const avgAnalysis = ratingAggregate._avg.analysisUsefulness;
  const avgKorean = ratingAggregate._avg.koreanTranslationAccuracy;

  const hasRatingData = count > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#3f2b20]">
          AI Quality Metrics
        </h1>
        <p className="mt-1 text-sm text-[#765d4e]">
          Staff ratings for AI-generated summaries and Korean translations.
        </p>
      </div>

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
