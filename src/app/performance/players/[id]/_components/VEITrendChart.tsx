'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

export type ChartPoint = {
  label: string    // opponent name
  vei: number
  opponent: string
  date: string
}

export default function VEITrendChart({
  data,
  avgVei,
}: {
  data: ChartPoint[]
  avgVei: number
}) {
  if (data.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#111111', marginBottom: '6px' }}>
          More matches needed
        </div>
        <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
          VEI trend will appear after 2 or more graded matches
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 48, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          width={60}
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: 'none',
            padding: '8px 12px',
          }}
          formatter={(value) => [typeof value === 'number' ? value.toFixed(1) : value, 'VEI']}
          labelFormatter={(_label, payload) => {
            const p = payload?.[0]?.payload as ChartPoint | undefined
            return p ? `vs ${p.opponent} — ${p.date}` : _label
          }}
        />
        <ReferenceLine
          y={avgVei}
          stroke="#D1D5DB"
          strokeDasharray="5 3"
          label={{
            value: `Avg ${avgVei.toFixed(1)}`,
            position: 'right',
            fontSize: 10,
            fill: '#9CA3AF',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <Line
          type="monotone"
          dataKey="vei"
          stroke="#111111"
          strokeWidth={2}
          dot={{ fill: '#111111', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#111111', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
