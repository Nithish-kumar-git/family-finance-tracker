import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatCurrency } from '../../utils/formatters'

/**
 * Minimal sparkline chart for corpus trend.
 * Props:
 *   data   — array of { label: string, value: number }
 *   height — number (default 60)
 */
export default function SparkLine({ data, height = 60 }) {
  if (!data || data.length < 2) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis dataKey="label" hide />
        <Tooltip
          formatter={(val) => formatCurrency(val, true)}
          labelStyle={{ fontSize: '11px', color: '#64748b' }}
          contentStyle={{
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '4px 8px',
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#7C3AED"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#7C3AED' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
