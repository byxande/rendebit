import { Activity, ArrowDownRight, ArrowUpRight, Bitcoin, CalendarRange, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";

const periods = [
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "1y", label: "1 ano" },
  { id: "10y", label: "10 anos" },
  { id: "all", label: "Total" },
] as const;

type Period = (typeof periods)[number]["id"];
type Point = { timestamp: number; priceBrl: number };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function formatAxisPrice(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return brl.format(value);
}

function formatChartDate(timestamp: number, period: Period) {
  const date = new Date(timestamp);
  if (period === "24h") return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (period === "7d" || period === "30d" || period === "90d") return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function MarketTooltip({ active, payload, period }: { active?: boolean; payload?: Array<{ payload?: Point }>; period: Period }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="btc-chart-tooltip"><span>{formatChartDate(point.timestamp, period)}</span><b>{brl.format(point.priceBrl)}</b></div>;
}

export default function BtcMarketChart() {
  const [period, setPeriod] = useState<Period>("24h");
  const historyQuery = trpc.market.history.useQuery({ period }, { staleTime: 5 * 60_000, retry: 1 });
  const data = historyQuery.data;
  const positive = (data?.changePercent ?? 0) >= 0;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="br-stack btc-market-page">
      <section className="br-page-hero compact btc-market-hero">
        <div><span className="br-eyebrow">MERCADO BTC EM REAIS</span><h1>Acompanhe o Bitcoin do seu jeito.</h1><p>Compare períodos, veja altas e quedas e entenda como a cotação mexe no valor em reais — sem misturar isso com o rendimento da estratégia.</p></div>
        <div className="br-big-icon"><Activity /></div>
      </section>

      <section className="br-panel btc-market-card">
        <div className="btc-market-head">
          <div className="btc-market-price">
            <span><Bitcoin size={17} /> BTC/BRL</span>
            {data ? <><strong>{brl.format(data.endPriceBrl)}</strong><small>Última cotação do período</small></> : <><strong>Carregando…</strong><small>Buscando histórico em reais</small></>}
          </div>
          {data && <div className={`btc-market-change ${positive ? "positive" : "negative"}`}><TrendIcon /><div><strong>{positive ? "+" : ""}{data.changePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong><span>{positive ? "+" : ""}{brl.format(data.changeBrl)} no período</span></div></div>}
        </div>

        <div className="btc-periods" aria-label="Escolha o período do gráfico">
          {periods.map(item => <button type="button" key={item.id} className={period === item.id ? "active" : ""} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
        </div>

        {historyQuery.isLoading ? <div className="btc-chart-loading"><RefreshCw className="spinning" /><b>Montando o gráfico para você…</b><span>A gente está buscando os preços em reais.</span></div> : historyQuery.isError ? <div className="btc-chart-loading error"><Activity /><b>Não conseguimos carregar agora.</b><span>Tente de novo em instantes.</span><button type="button" className="br-outline" onClick={() => void historyQuery.refetch()}>Tentar novamente</button></div> : data ? <>
          <div className="btc-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points} margin={{ top: 12, right: 8, left: 6, bottom: 0 }}>
                <defs><linearGradient id="btc-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f7931a" stopOpacity={0.28} /><stop offset="100%" stopColor="#f7931a" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#eadfce" strokeDasharray="3 5" />
                <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={value => formatChartDate(Number(value), period)} axisLine={false} tickLine={false} minTickGap={42} tick={{ fill: "#9a8878", fontSize: 9 }} />
                <YAxis dataKey="priceBrl" domain={["auto", "auto"]} tickFormatter={formatAxisPrice} axisLine={false} tickLine={false} width={68} tick={{ fill: "#9a8878", fontSize: 9 }} />
                <Tooltip content={<MarketTooltip period={period} />} cursor={{ stroke: "#c46b0a", strokeDasharray: "3 4" }} isAnimationActive={false} />
                <Area type="monotone" dataKey="priceBrl" stroke="#e7800c" strokeWidth={3} fill="url(#btc-area)" activeDot={{ r: 5, fill: "#fffaf2", stroke: "#e7800c", strokeWidth: 3 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="btc-market-stats"><div><span>Início do período</span><b>{brl.format(data.startPriceBrl)}</b></div><div><span>Menor cotação</span><b>{brl.format(data.lowPriceBrl)}</b></div><div><span>Maior cotação</span><b>{brl.format(data.highPriceBrl)}</b></div><div><span>Última cotação</span><b>{brl.format(data.endPriceBrl)}</b></div></div>
          <div className="btc-market-source"><ShieldCheck size={15} /><span>{data.stale ? "Última série conhecida" : "Dados históricos atualizados"} via <b>{data.source}</b>. Cotação de referência; o preço de execução pode incluir spread e taxas.</span><button type="button" onClick={() => void historyQuery.refetch()} disabled={historyQuery.isFetching} aria-label="Atualizar histórico"><RefreshCw className={historyQuery.isFetching ? "spinning" : ""} size={14} /></button></div>
        </> : null}
      </section>

      <section className="btc-market-explainer">
        <article className="br-panel"><CalendarRange /><div><span>ESCOLHA O TEMPO</span><h3>Do dia a dia ao longo prazo</h3><p>Use os filtros para comparar movimentos curtos com ciclos maiores do Bitcoin.</p></div></article>
        <article className="br-panel"><Activity /><div><span>LEIA SEM CONFUSÃO</span><h3>Preço não é rendimento</h3><p>Este gráfico mostra somente a variação do BTC em reais. O retorno da estratégia aparece separado.</p></div></article>
      </section>
    </div>
  );
}
