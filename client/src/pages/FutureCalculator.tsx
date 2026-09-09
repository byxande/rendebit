import { ArrowRight, Bitcoin, CalendarDays, Info, SlidersHorizontal, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { FUTURE_SCENARIOS, projectFuture, type ProjectionPoint } from "@/lib/futureProjection";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const currencyPrecise = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const btcFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const CURRENT_BTC_BRL = 421_930;
const PROTOCOL_YIELD = 0.03;

function brlInput(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrl(value: string) {
  return Math.max(0, Number(value.replace(/\./g, "").replace(",", ".")) || 0);
}

function LineChart({ points }: { points: ProjectionPoint[] }) {
  const width = 820;
  const height = 270;
  const padX = 22;
  const padY = 20;
  const maxValue = Math.max(1, ...points.flatMap(point => [point.projectedValueBrl, point.contributedBrl]));
  const sample = points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 48)) === 0 || index === points.length - 1);
  const x = (month: number) => padX + (month / Math.max(1, points.at(-1)?.month ?? 1)) * (width - padX * 2);
  const y = (value: number) => height - padY - (Math.max(0, value) / maxValue) * (height - padY * 2);
  const path = (key: "contributedBrl" | "projectedValueBrl") => sample.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.month)},${y(point[key])}`).join(" ");
  const projectedPath = path("projectedValueBrl");
  const area = `${projectedPath} L${x(sample.at(-1)?.month ?? 0)},${height - padY} L${x(0)},${height - padY} Z`;

  return (
    <div className="future-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico da projeção do patrimônio e do total investido">
        <defs>
          <linearGradient id="futureArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7931a" stopOpacity=".28" /><stop offset="1" stopColor="#f7931a" stopOpacity="0" /></linearGradient>
        </defs>
        {[.2, .4, .6, .8].map(level => <line key={level} x1={padX} x2={width - padX} y1={height * level} y2={height * level} stroke="#e8dccb" strokeDasharray="5 7" />)}
        <path d={area} fill="url(#futureArea)" />
        <path d={path("contributedBrl")} fill="none" stroke="#aa9b8b" strokeWidth="2" strokeDasharray="7 7" strokeLinecap="round" />
        <path d={projectedPath} fill="none" stroke="#e47f0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(sample.at(-1)?.month ?? 0)} cy={y(sample.at(-1)?.projectedValueBrl ?? 0)} r="6" fill="#fffaf2" stroke="#e47f0b" strokeWidth="4" />
      </svg>
      <div className="future-chart-axis"><span>Hoje</span><span>{Math.max(1, Math.round((points.at(-1)?.month ?? 12) / 24))} anos</span><span>{Math.round((points.at(-1)?.month ?? 12) / 12)} anos</span></div>
    </div>
  );
}

export default function FutureCalculator() {
  const [initialValue, setInitialValue] = useState("10.000,00");
  const [monthlyValue, setMonthlyValue] = useState("500,00");
  const [years, setYears] = useState(5);
  const [btcAnnualChange, setBtcAnnualChange] = useState(0);

  const initialBrl = parseBrl(initialValue);
  const monthlyBrl = parseBrl(monthlyValue);
  const points = useMemo(() => projectFuture({ initialBrl, monthlyBrl, years, protocolAnnualYield: PROTOCOL_YIELD, btcAnnualChange: btcAnnualChange / 100, currentBtcBrl: CURRENT_BTC_BRL }), [initialBrl, monthlyBrl, years, btcAnnualChange]);
  const final = points.at(-1)!;
  const earnings = final.projectedValueBrl - final.contributedBrl;
  const scenarioResults = FUTURE_SCENARIOS.map(scenario => ({ ...scenario, final: projectFuture({ initialBrl, monthlyBrl, years, protocolAnnualYield: PROTOCOL_YIELD, btcAnnualChange: scenario.btcAnnualChange, currentBtcBrl: CURRENT_BTC_BRL }).at(-1)! }));
  const maxScenario = Math.max(1, ...scenarioResults.map(item => item.final.projectedValueBrl));

  return (
    <div className="br-stack future-page">
      <section className="br-page-hero compact future-hero">
        <div><span className="br-eyebrow">SIMULADOR DE GANHOS FUTUROS</span><h1>Faça planos para o seu Bitcoin.</h1><p>Escolha quanto colocar, por quanto tempo e um cenário para o preço do BTC. A gente mostra a projeção em reais e em Bitcoin.</p></div>
        <div className="br-big-icon"><TrendingUp /></div>
      </section>

      <div className="future-layout">
        <section className="br-panel future-controls">
          <div className="future-panel-title"><div><span className="br-eyebrow">SEUS PLANOS</span><h2>Monte sua simulação</h2></div><SlidersHorizontal /></div>
          <label><span>Quanto você quer começar colocando?</span><div className="future-money-input"><b>R$</b><input value={initialValue} onChange={event => setInitialValue(event.target.value)} inputMode="decimal" aria-label="Valor inicial em reais" /></div></label>
          <label><span>Quanto pretende colocar por mês?</span><div className="future-money-input"><b>R$</b><input value={monthlyValue} onChange={event => setMonthlyValue(event.target.value)} inputMode="decimal" aria-label="Aporte mensal em reais" /></div></label>
          <div className="future-control-group"><span>Por quanto tempo?</span><div className="future-option-row">{[1, 3, 5, 10].map(option => <button className={years === option ? "active" : ""} type="button" key={option} onClick={() => setYears(option)}>{option} {option === 1 ? "ano" : "anos"}</button>)}</div></div>
          <div className="future-control-group"><div className="future-slider-label"><span>Cenário anual do Bitcoin</span><b>{btcAnnualChange > 0 ? "+" : ""}{btcAnnualChange}%</b></div><input className="future-slider" type="range" min="-30" max="50" step="1" value={btcAnnualChange} onChange={event => setBtcAnnualChange(Number(event.target.value))} aria-label="Variação anual estimada do preço do Bitcoin" /><div className="future-slider-axis"><span>−30%</span><span>0%</span><span>+50%</span></div><div className="future-option-row compact">{FUTURE_SCENARIOS.map(scenario => <button type="button" key={scenario.id} className={btcAnnualChange === scenario.btcAnnualChange * 100 ? "active" : ""} onClick={() => setBtcAnnualChange(scenario.btcAnnualChange * 100)}>{scenario.btcAnnualChange > 0 ? "+" : ""}{scenario.btcAnnualChange * 100}%</button>)}</div></div>
          <div className="future-reference"><Bitcoin /><div><span>Referência usada na simulação</span><b>BTC a {currencyPrecise.format(CURRENT_BTC_BRL)}</b><small>Rendimento nativo estimado em ~3% a.a.</small></div></div>
        </section>

        <section className="future-result-card">
          <div className="future-result-kicker"><Sparkles /> SUA PROJEÇÃO EM {years} {years === 1 ? "ANO" : "ANOS"}</div>
          <strong>{currency.format(final.projectedValueBrl)}</strong>
          <p>Valor futuro no cenário de BTC a {btcAnnualChange > 0 ? "+" : ""}{btcAnnualChange}% ao ano</p>
          <div className="future-result-grid"><div><span>Você terá colocado</span><b>{currency.format(final.contributedBrl)}</b></div><div><span>Diferença projetada</span><b className={earnings >= 0 ? "positive" : "negative"}>{earnings >= 0 ? "+" : ""}{currency.format(earnings)}</b></div><div><span>Rendimento da estratégia</span><b>+{currency.format(final.protocolYieldBrl)}</b></div><div><span>Bitcoin acumulado</span><b>₿ {btcFormat.format(final.projectedBtc)}</b></div></div>
          <div className="future-result-note"><Info /><span>O efeito do preço do Bitcoin é mostrado separado do rendimento da estratégia.</span></div>
        </section>
      </div>

      <section className="br-panel future-chart-card">
        <div className="br-section-head"><div><span className="br-eyebrow">EVOLUÇÃO NO TEMPO</span><h2>Como seu patrimônio pode crescer</h2><p>A linha laranja mostra o valor projetado. A pontilhada mostra quanto saiu do seu bolso.</p></div><div className="future-legend"><span><i className="orange" /> Valor projetado</span><span><i /> Total colocado</span></div></div>
        <LineChart points={points} />
      </section>

      <section className="br-panel future-scenarios-card">
        <div className="br-section-head"><div><span className="br-eyebrow">COMPARE POSSIBILIDADES</span><h2>O mesmo plano em três cenários</h2><p>O rendimento da estratégia continua em 3% a.a.; o que muda abaixo é o preço do Bitcoin.</p></div><CalendarDays /></div>
        <div className="future-scenario-grid">{scenarioResults.map(item => { const difference = item.final.projectedValueBrl - item.final.contributedBrl; return <article key={item.id}><div className="future-scenario-head"><span>{item.label}</span><b>{item.btcAnnualChange > 0 ? "+" : ""}{Math.round(item.btcAnnualChange * 100)}% a.a.</b></div><strong>{currency.format(item.final.projectedValueBrl)}</strong><div className="future-scenario-track"><i style={{ width: `${Math.max(4, item.final.projectedValueBrl / maxScenario * 100)}%` }} /></div><p><span>Total colocado</span><b>{currency.format(item.final.contributedBrl)}</b></p><p><span>Diferença projetada</span><b className={difference >= 0 ? "positive" : "negative"}>{difference >= 0 ? "+" : ""}{currency.format(difference)}</b></p></article>; })}</div>
      </section>

      <section className="future-breakdown">
        <article className="br-panel"><WalletCards /><span>Dinheiro colocado</span><strong>{currency.format(final.contributedBrl)}</strong><p>Valor inicial mais {years * 12} aportes mensais.</p></article>
        <ArrowRight />
        <article className="br-panel"><TrendingUp /><span>Rendimento da estratégia</span><strong>+{currency.format(final.protocolYieldBrl)}</strong><p>Estimativa com referência de ~3% a.a. sobre o saldo em BTC.</p></article>
        <ArrowRight />
        <article className="br-panel"><Bitcoin /><span>Efeito do preço do BTC</span><strong className={final.marketEffectBrl >= 0 ? "positive" : "negative"}>{final.marketEffectBrl >= 0 ? "+" : ""}{currency.format(final.marketEffectBrl)}</strong><p>Cenário escolhido: {btcAnnualChange > 0 ? "+" : ""}{btcAnnualChange}% ao ano.</p></article>
      </section>

      <details className="br-panel future-assumptions"><summary>Ver premissas e riscos da simulação</summary><div><p>Esta calculadora é educativa. Ela mantém a taxa da estratégia em 3% a.a. e aplica a variação escolhida ao preço do Bitcoin. Aportes são convertidos mensalmente pela cotação projetada, e o rendimento é composto mês a mês.</p><p>Custos de compra, spread, taxas, impostos, liquidez, interrupções e mudanças de protocolo não entram nesta projeção. Os resultados podem ser maiores ou menores e não representam promessa de retorno.</p><p><b>Data-base da referência BTC/BRL:</b> 08/09/2026, valor demonstrativo de {currencyPrecise.format(CURRENT_BTC_BRL)}.</p></div></details>
    </div>
  );
}
