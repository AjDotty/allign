'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

export type TrendPoint = {
  label: string
  vei: number
  opponent: string
  date: string
}

export type RadarPoint = {
  subject: string
  value: number
}

export default function ReportCharts({
  trendData,
  radarData,
  avgVei,
}: {
  trendData: TrendPoint[]
  radarData: RadarPoint[]
  avgVei: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

      {/* VEI Trend */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
        }}>
          VEI Trend
        </div>
        {trendData.length < 2 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: '#9CA3AF' }}>
            Needs 2+ matches
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ top: 4, right: 40, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false} interval={0}
              />
              <YAxis
                domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', fontFamily: 'Inter, sans-serif', boxShadow: 'none', padding: '8px 12px' }}
                formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'VEI']}
                labelFormatter={(_l, p) => {
                  const pt = p?.[0]?.payload as TrendPoint | undefined
                  return pt ? `vs ${pt.opponent} — ${pt.date}` : _l
                }}
              />
              <ReferenceLine y={avgVei} stroke="#D1D5DB" strokeDasharray="4 3"
                label={{ value: `Avg ${avgVei.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
              />
              <Line type="monotone" dataKey="vei" stroke="#111111" strokeWidth={2}
                dot={{ fill: '#111111', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#111111', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Dimension Radar */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
        }}>
          Dimensions
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={radarData} margin={{ top: 4, right: 20, left: 20, bottom: 4 }}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'Inter, sans-serif' }}
            />
            <Radar
              dataKey="value"
              stroke="#111111"
              fill="#111111"
              fillOpacity={0.12}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
