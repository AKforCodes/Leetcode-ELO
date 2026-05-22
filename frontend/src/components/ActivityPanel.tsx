import React, { useMemo, useState } from "react";
import {
  bucketForCount,
  buildHeatmap,
  computeStreak,
  getDayCounts,
  type SolvedDates
} from "../lib/activity";

type Props = {
  solvedDates: SolvedDates;
};

export default function ActivityPanel({ solvedDates }: Props) {
  const [open, setOpen] = useState(false);

  const { streak, total, todayCount, cells } = useMemo(() => {
    const dayCounts = getDayCounts(solvedDates);
    const cells = buildHeatmap(dayCounts, 13);
    const total = Object.keys(solvedDates).length;
    const streak = computeStreak(dayCounts);
    const todayIso = cells.find((c) => c.isToday)?.date ?? "";
    const todayCount = dayCounts[todayIso] || 0;
    return { streak, total, todayCount, cells };
  }, [solvedDates]);

  const weeks = cells.length / 7;

  return (
    <section className="activity">
      <button
        type="button"
        className="activity-header"
        aria-expanded={open}
        aria-controls="activity-body"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="activity-stats">
          <span className="activity-streak">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <strong>{streak}</strong>
            <span className="activity-label">day{streak === 1 ? "" : "s"} streak</span>
          </span>
          <span className="activity-divider" aria-hidden="true" />
          <span className="activity-total">
            <strong>{total.toLocaleString()}</strong>
            <span className="activity-label">total solved</span>
          </span>
          {todayCount > 0 && (
            <>
              <span className="activity-divider" aria-hidden="true" />
              <span className="activity-today">
                <strong>+{todayCount}</strong>
                <span className="activity-label">today</span>
              </span>
            </>
          )}
        </div>
        <span className="activity-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div id="activity-body" className="activity-body">
          <div
            className="heatmap"
            role="img"
            aria-label={`Activity heatmap, last ${weeks} weeks`}
            style={{
              gridTemplateColumns: `repeat(${weeks}, 12px)`,
              gridTemplateRows: "repeat(7, 12px)"
            }}
          >
            {cells.map((c) => (
              <div
                key={c.date}
                className={`hm-cell hm-${bucketForCount(c.count)}${c.isFuture ? " hm-future" : ""}${c.isToday ? " hm-today" : ""}`}
                title={`${c.date}: ${c.count} solved`}
                aria-label={`${c.date}: ${c.count} solved`}
              />
            ))}
          </div>
          <div className="hm-legend">
            <span className="hm-legend-label">Less</span>
            <span className="hm-cell hm-0" aria-hidden="true" />
            <span className="hm-cell hm-1" aria-hidden="true" />
            <span className="hm-cell hm-2" aria-hidden="true" />
            <span className="hm-cell hm-3" aria-hidden="true" />
            <span className="hm-cell hm-4" aria-hidden="true" />
            <span className="hm-legend-label">More</span>
          </div>
          <p className="activity-note">Counts the day you ticked a problem solved on this site.</p>
        </div>
      )}
    </section>
  );
}
