"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { NetworkStats } from "@/types/vpn";
import { formatBytes } from "@/lib/utils";
import { format } from "date-fns";

interface NetworkChartProps {
  data: NetworkStats[];
}

/** Matches Recharts tooltip payload `value` without importing package-internal types. */
type TooltipChartValue = string | number | readonly (string | number)[] | undefined;

function formatTooltipMb(value: TooltipChartValue): string {
  if (value === undefined) return "";
  const scalar: string | number = Array.isArray(value) ? (value[0] ?? "") : value;
  if (scalar === "") return "";
  const n = typeof scalar === "number" ? scalar : Number(scalar);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

export function NetworkChart({ data }: NetworkChartProps) {
  const chartData = data.map((stat) => ({
    time: format(stat.timestamp, "HH:mm"),
    in: stat.bytesIn / 1024 / 1024,
    out: stat.bytesOut / 1024 / 1024,
  }));

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Network Traffic</CardTitle>
        <CardDescription>Bandwidth usage over the last 24 hours</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="time"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(0)} MB`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Inbound
                          </span>
                          <span className="font-bold text-green-600">
                            {formatTooltipMb(payload[0].value)} MB
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Outbound
                          </span>
                          <span className="font-bold text-teal-600">
                            {formatTooltipMb(payload[1].value)} MB
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="in"
              strokeWidth={2}
              stroke="#22c55e"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="out"
              strokeWidth={2}
              stroke="#14b8a6"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
