'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'

export type RadarDimension = {
  dimension: string
  value: number   // 0-100
  avg: number     // org avg 0-100
}

export default function PlayerRadarChart({
  data,
  size = 300,
}: {
  data: RadarDimension[]
  size?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid
          stroke="#E5E7EB"
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 12, fontFamily: 'Inter, sans-serif', fill: '#6B7280', fontWeight: 500 }}
        />
        {/* Org average — dashed grey fill */}
        <Radar
          name="Avg"
          dataKey="avg"
          stroke="#D1D5DB"
          fill="#D1D5DB"
          fillOpacity={0.15}
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        {/* Player — solid black */}
        <Radar
          name="Player"
          dataKey="value"
          stroke="#111111"
          fill="#111111"
          fillOpacity={0.08}
          strokeWidth={2}
          dot={{ r: 3, fill: '#111111', strokeWidth: 0 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
