import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { Plus, Trash2, TrendingDown, TrendingUp, Minus, Pencil, X, Target } from "lucide-react";

const TARGET_WEIGHT = 54;

const TOKENS = {
  ink: "#1E2A32",
  paper: "#EEF2ED",
  paperDeep: "#E3E9E1",
  card: "#FBFCFA",
  brass: "#B8863E",
  brassSoft: "#E8D2AC",
  teal: "#3C6E62",
  tealSoft: "#D7E5DF",
  rust: "#A6532E",
  rustSoft: "#EFD8CC",
  line: "#D8DED6",
  ink60: "rgba(30,42,50,0.6)",
  ink40: "rgba(30,42,50,0.4)",
};

const STORAGE_KEY = "weight-tracker:entries";

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function formatDateFull(iso) {
  const [y, m, d] = iso.split("-");
  return `${y}年${m}月${d}日`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const RANGES = [
  { key: "7", label: "7天" },
  { key: "30", label: "30天" },
  { key: "90", label: "90天" },
  { key: "all", label: "全部" },
];

export default function WeightTracker() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dateInput, setDateInput] = useState(todayStr());
  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [range, setRange] = useState("30");

  // Load entries on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setEntries(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        // key doesn't exist yet — that's fine, start empty
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setSaving(true);
    setError("");
    try {
      const result = await window.storage.set(
        STORAGE_KEY,
        JSON.stringify(next),
        false
      );
      if (!result) throw new Error("no result");
    } catch (e) {
      setError("儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }, []);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const delta = latest && previous ? +(latest.weight - previous.weight).toFixed(1) : null;
  const toGoal = latest ? +(latest.weight - TARGET_WEIGHT).toFixed(1) : null;

  const chartData = useMemo(() => {
    if (range === "all") return sorted;
    const days = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return sorted.filter((e) => e.date >= cutoffStr);
  }, [sorted, range]);

  const avgInRange = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((a, e) => a + e.weight, 0);
    return +(sum / chartData.length).toFixed(1);
  }, [chartData]);

  function resetForm() {
    setDateInput(todayStr());
    setWeightInput("");
    setNoteInput("");
    setEditingId(null);
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setDateInput(entry.date);
    setWeightInput(String(entry.weight));
    setNoteInput(entry.note || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const w = parseFloat(weightInput);
    if (!dateInput || isNaN(w) || w <= 0) {
      setError("請輸入有效的日期與體重");
      return;
    }
    setError("");

    let next;
    const existingSameDate = entries.find(
      (en) => en.date === dateInput && en.id !== editingId
    );

    if (editingId) {
      next = entries.map((en) =>
        en.id === editingId
          ? { ...en, date: dateInput, weight: w, note: noteInput.trim() }
          : en
      );
      // if editing caused a collision with another date's entry, merge (keep edited one, drop the old dup)
      if (existingSameDate) {
        next = next.filter((en) => en.id !== existingSameDate.id);
      }
    } else if (existingSameDate) {
      // same-day update: overwrite that day's record
      next = entries.map((en) =>
        en.id === existingSameDate.id
          ? { ...en, weight: w, note: noteInput.trim() }
          : en
      );
    } else {
      next = [...entries, { id: uid(), date: dateInput, weight: w, note: noteInput.trim() }];
    }

    setEntries(next);
    resetForm();
    await persist(next);
  }

  async function handleDelete(id) {
    const next = entries.filter((en) => en.id !== id);
    setEntries(next);
    if (editingId === id) resetForm();
    await persist(next);
  }

  const trendColor =
    delta == null ? TOKENS.ink40 : delta > 0 ? TOKENS.rust : delta < 0 ? TOKENS.teal : TOKENS.ink40;
  const TrendIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: TOKENS.paper, color: TOKENS.ink, fontFamily: "'Inter', ui-sans-serif, system-ui" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .ff-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .ff-mono { font-family: 'JetBrains Mono', monospace; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; }
        .wt-scroll::-webkit-scrollbar { width: 6px; }
        .wt-scroll::-webkit-scrollbar-thumb { background: ${TOKENS.line}; border-radius: 999px; }
      `}</style>

      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        {/* Header / Hero */}
        <div className="mb-8">
          <p className="ff-mono text-xs tracking-widest uppercase mb-2" style={{ color: TOKENS.ink40 }}>
            體重紀錄
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-baseline gap-3">
                <span
                  className="ff-display leading-none"
                  style={{ fontSize: "3.75rem", fontWeight: 500, letterSpacing: "-0.02em" }}
                >
                  {latest ? latest.weight.toFixed(1) : "--"}
                </span>
                <span className="text-lg mb-1" style={{ color: TOKENS.ink60 }}>
                  kg
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: TOKENS.ink60 }}>
                {latest ? formatDateFull(latest.date) : "尚未有紀錄，從下方開始記錄吧"}
              </p>
            </div>

            {delta != null && (
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium"
                style={{
                  background:
                    delta > 0 ? TOKENS.rustSoft : delta < 0 ? TOKENS.tealSoft : TOKENS.line,
                  color: trendColor,
                }}
              >
                <TrendIcon size={16} strokeWidth={2.5} />
                <span className="ff-mono">
                  {delta > 0 ? "+" : ""}
                  {delta} kg
                </span>
              </div>
            )}
          </div>

          {latest && (
            <div className="flex items-center gap-1.5 mt-3 text-sm" style={{ color: TOKENS.ink60 }}>
              <Target size={14} style={{ color: TOKENS.brass }} />
              目標 <span className="ff-mono">{TARGET_WEIGHT} kg</span>
              {toGoal !== 0 && (
                <span>
                  ・還差 <span className="ff-mono font-semibold" style={{ color: TOKENS.ink }}>{Math.abs(toGoal).toFixed(1)} kg</span>
                  {toGoal > 0 ? "" : "（已超越目標）"}
                </span>
              )}
              {toGoal === 0 && <span style={{ color: TOKENS.teal }}>・已達成目標 🎉</span>}
            </div>
          )}
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 mb-6 shadow-sm"
          style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: TOKENS.ink }}>
              {editingId ? "編輯紀錄" : "新增今日紀錄"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                style={{ color: TOKENS.ink60 }}
              >
                <X size={14} /> 取消編輯
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs mb-1 block" style={{ color: TOKENS.ink60 }}>
                日期
              </span>
              <input
                type="date"
                value={dateInput}
                max={todayStr()}
                onChange={(e) => setDateInput(e.target.value)}
                className="ff-mono w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: TOKENS.paper, border: `1px solid ${TOKENS.line}`, color: TOKENS.ink }}
              />
            </label>
            <label className="block">
              <span className="text-xs mb-1 block" style={{ color: TOKENS.ink60 }}>
                體重 (kg)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="例如 65.5"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="ff-mono w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: TOKENS.paper, border: `1px solid ${TOKENS.line}`, color: TOKENS.ink }}
              />
            </label>
          </div>

          <label className="block mb-4">
            <span className="text-xs mb-1 block" style={{ color: TOKENS.ink60 }}>
              備註（選填）
            </span>
            <input
              type="text"
              placeholder="例如：早上空腹、運動後、生理期..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: TOKENS.paper, border: `1px solid ${TOKENS.line}`, color: TOKENS.ink }}
            />
          </label>

          {error && (
            <p className="text-xs mb-3" style={{ color: TOKENS.rust }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity"
            style={{ background: TOKENS.ink, color: TOKENS.paper, opacity: saving ? 0.6 : 1 }}
          >
            <Plus size={16} />
            {saving ? "儲存中..." : editingId ? "更新紀錄" : "儲存紀錄"}
          </button>
        </form>

        {/* Chart card */}
        <div
          className="rounded-2xl p-5 mb-6 shadow-sm"
          style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}` }}
        >
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="text-sm font-semibold">體重曲線</h2>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: range === r.key ? TOKENS.ink : "transparent",
                    color: range === r.key ? TOKENS.paper : TOKENS.ink60,
                    border: `1px solid ${range === r.key ? TOKENS.ink : TOKENS.line}`,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {avgInRange != null && (
            <p className="text-xs mb-3" style={{ color: TOKENS.ink40 }}>
              區間平均 <span className="ff-mono">{avgInRange} kg</span> ・ {chartData.length} 筆紀錄
            </p>
          )}

          {!loaded ? (
            <div className="h-56 flex items-center justify-center text-sm" style={{ color: TOKENS.ink40 }}>
              載入中...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-center px-6" style={{ color: TOKENS.ink40 }}>
              這個區間還沒有紀錄，新增第一筆體重開始追蹤趨勢
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={TOKENS.line} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11, fill: TOKENS.ink40, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: TOKENS.line }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[
                      (dataMin) => Math.min(dataMin - 1, TARGET_WEIGHT - 1),
                      (dataMax) => Math.max(dataMax + 1, TARGET_WEIGHT + 1),
                    ]}
                    tick={{ fontSize: 11, fill: TOKENS.ink40, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <ReferenceLine
                    y={TARGET_WEIGHT}
                    stroke={TOKENS.brass}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `目標 ${TARGET_WEIGHT}kg`,
                      position: "insideTopRight",
                      fill: TOKENS.brass,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          className="rounded-lg px-3 py-2 text-xs shadow-md"
                          style={{ background: TOKENS.ink, color: TOKENS.paper }}
                        >
                          <div className="ff-mono font-semibold">{d.weight.toFixed(1)} kg</div>
                          <div style={{ opacity: 0.7 }}>{formatDateFull(d.date)}</div>
                          {d.note && <div className="mt-1" style={{ opacity: 0.85 }}>{d.note}</div>}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={TOKENS.teal}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: TOKENS.teal, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: TOKENS.brass }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* History list */}
        <div
          className="rounded-2xl p-5 shadow-sm"
          style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}` }}
        >
          <h2 className="text-sm font-semibold mb-3">歷史紀錄</h2>
          {!loaded ? null : sorted.length === 0 ? (
            <p className="text-sm" style={{ color: TOKENS.ink40 }}>
              還沒有任何紀錄
            </p>
          ) : (
            <div className="wt-scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
              {[...sorted].reverse().map((en) => (
                <div
                  key={en.id}
                  className="flex items-center justify-between gap-3 py-3"
                  style={{ borderBottom: `1px solid ${TOKENS.line}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="ff-mono text-sm font-semibold">{en.weight.toFixed(1)} kg</span>
                      <span className="ff-mono text-xs" style={{ color: TOKENS.ink40 }}>
                        {formatDateFull(en.date)}
                      </span>
                    </div>
                    {en.note && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: TOKENS.ink60 }}>
                        {en.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(en)}
                      className="p-2 rounded-lg"
                      style={{ color: TOKENS.ink60 }}
                      aria-label="編輯"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(en.id)}
                      className="p-2 rounded-lg"
                      style={{ color: TOKENS.rust }}
                      aria-label="刪除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: TOKENS.ink40 }}>
          資料只儲存在你的裝置帳號中，不會分享給其他人
        </p>
      </div>
    </div>
  );
}
