import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Bitcoin,
  Building2,
  Check,
  CircleCheckBig,
  ChevronDown,
  CircleDollarSign,
  Copy,
  CreditCard,
  FileCheck2,
  FileDown,
  FileText,
  Fingerprint,
  HelpCircle,
  Gauge,
  Home,
  Landmark,
  Layers3,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Network,
  PieChart,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { createPixReceiptPdf } from "@/lib/pixReceipt";
import {
  connectXverse,
  requestXverseReadPermission,
  revokeXversePermissions,
  signStacksTransaction,
} from "@/lib/xverse";
import RendeBitFooter from "@/components/RendeBitFooter";
import NotificationCenter, { type AppNotificationView } from "@/components/NotificationCenter";
import FutureCalculator from "./FutureCalculator";
import BusinessSolutions from "./BusinessSolutions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BtcMarketChart = lazy(() => import("./BtcMarketChart"));
const PIX_LOGO_SRC = "/manus-storage/pix-logo_757c6551.svg";

type SectionId = "inicio" | "depositar" | "rendimento" | "mercado" | "simulador" | "lotes" | "resgate" | "fiscal" | "reservas" | "empresas" | "ajuda";

type NavItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
};

type PurchaseStep = "eligibility" | "quote" | "success";
type RedemptionStep = "review" | "success";

type RedemptionQuoteView = {
  id: number;
  btcAmount: string;
  referenceBtcBrl: string;
  grossBrl: string;
  protocolFeeBrl: string;
  conversionPixFeeBrl: string;
  netBrl: string;
  expiresAt: Date | string;
  pixDestinationMasked: string;
};

type PixDepositRecord = {
  id: number;
  amountBrl: string;
  status: "created" | "awaiting_payment" | "paid" | "expired" | "cancelled" | "manual_review";
  pixCopyPaste: string | null;
  qrCodeText: string | null;
  providerReference: string | null;
  endToEndId: string | null;
  expiresAt: Date | string;
  paidAt: Date | string | null;
  createdAt: Date | string;
};

type PurchaseRecord = {
  id: string;
  date: string;
  invested: number;
  btc: number;
  quote: number;
  currentValue: number;
  gain: number;
  status: string;
  paymentMethod?: "pix" | "credit_card";
  paymentStatus?: "not_started" | "pending" | "approved" | "rejected" | "refunded";
  checkoutUrl?: string | null;
  completed: boolean;
};

const navItems: NavItem[] = [
  { id: "inicio", label: "Visão geral", icon: Home },
  { id: "depositar", label: "Depositar via Pix", icon: ArrowDownToLine },
  { id: "rendimento", label: "Meus rendimentos", icon: TrendingUp },
  { id: "mercado", label: "Mercado BTC", icon: Activity },
  { id: "simulador", label: "Simular o futuro", icon: PieChart },
  { id: "lotes", label: "Meus aportes", icon: Layers3 },
  { id: "resgate", label: "Receber via Pix", icon: QrCode },
  { id: "fiscal", label: "Relatório fiscal", icon: FileText },
  { id: "reservas", label: "Segurança", icon: ShieldCheck },
  { id: "empresas", label: "Para empresas", icon: Building2 },
  { id: "ajuda", label: "Central de ajuda", icon: HelpCircle },
];

const wealthPattern = [
  { label: "10 jun", factor: 0.9926 },
  { label: "24 jun", factor: 0.9935 },
  { label: "08 jul", factor: 0.9933 },
  { label: "22 jul", factor: 0.9950 },
  { label: "05 ago", factor: 0.9967 },
  { label: "19 ago", factor: 0.9978 },
  { label: "Hoje", factor: 1 },
];

const initialPurchases: PurchaseRecord[] = [];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FALLBACK_BTC_BRL = 421930;
const DEMO_BTC_BALANCE = 0.28989168;

function parseBrl(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBtc(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${currency.format(Math.abs(value))}`;
}

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  return (
    <button
      className="br-copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        toast.success("Copiado para a área de transferência");
      }}
      type="button"
    >
      <Copy size={14} /> {label}
    </button>
  );
}

function MiniChart({ currentValue }: { currentValue: number }) {
  const width = 760;
  const height = 238;
  const pad = 12;
  const wealthPoints = wealthPattern.map(point => ({ label: point.label, value: currentValue * point.factor }));
  const values = wealthPoints.map((point) => point.value);
  const min = Math.min(...values) - 900;
  const max = Math.max(...values) + 700;
  const points = wealthPoints.map((point, index) => ({
    ...point,
    x: pad + (index / (wealthPoints.length - 1)) * (width - pad * 2),
    y: pad + ((max - point.value) / (max - min)) * (height - pad * 2),
  }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)?.x},${height} L${points[0].x},${height} Z`;

  return (
    <div className="br-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução demonstrativa do patrimônio em reais">
        <defs>
          <linearGradient id="wealthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7931a" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f7931a" stopOpacity="0" />
          </linearGradient>
          <filter id="softGlow"><feGaussianBlur stdDeviation="5" result="blur" /></filter>
        </defs>
        {[0.18, 0.5, 0.82].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="#dce6e3" strokeDasharray="5 7" />
        ))}
        <path d={area} fill="url(#wealthArea)" />
        <path d={line} fill="none" stroke="#f7931a" strokeWidth="9" opacity="0.12" filter="url(#softGlow)" />
        <path d={line} fill="none" stroke="#e47f0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 6 : 3.5} fill="#fffaf1" stroke="#e47f0b" strokeWidth="3" />
          </g>
        ))}
      </svg>
      <div className="br-chart-labels">
        {wealthPoints.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </div>
  );
}

function DemoPill() {
  return <span className="br-demo-pill"><Sparkles size={13} /> Brasil · Ambiente demonstrativo</span>;
}

function PixBrand({ compact = false }: { compact?: boolean }) {
  return <span className={`br-pix-brand${compact ? " compact" : ""}`}><img src={PIX_LOGO_SRC} alt="Logo Pix" /></span>;
}

function downloadPixReceipt(deposit: PixDepositRecord) {
  const url = URL.createObjectURL(createPixReceiptPdf(deposit));
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprovante-pix-rendebit-${deposit.id}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Comprovante Pix baixado", { description: "PDF demonstrativo gerado no seu navegador." });
}

function BrazilFirstStrip() {
  return (
    <section className="br-brazil-strip">
      <div className="br-brazil-icon"><MapPin /></div>
      <div>
        <span>FEITA EXCLUSIVAMENTE PARA O BRASIL</span>
        <b>Da entrada em reais ao resgate via Pix.</b>
        <p>Uma experiência em português, com CPF, conta Pix da sua titularidade, valores em BRL e informações organizadas para o seu contador.</p>
      </div>
      <div className="br-brazil-chips"><span>CPF</span><span>PIX</span><span>BRL</span><span>PT-BR</span></div>
    </section>
  );
}

function BtcBrlQuoteCard({
  quote,
  loading,
  refreshing,
  onRefresh,
}: {
  quote: { priceBrl: number; source: string; marketUpdatedAt: number; stale: boolean } | undefined;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const updateTime = quote
    ? new Date(quote.marketUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const isBinance = quote?.source === "Binance";

  return (
    <section className={`br-btc-quote-card${quote?.stale ? " is-stale" : ""}`} aria-labelledby="btc-brl-quote-title">
      <div className="br-btc-quote-head">
        <div>
          <span className="br-eyebrow">COTAÇÃO BTC/BRL</span>
          <h2 id="btc-brl-quote-title">Bitcoin em reais <span>BTC/BRL</span></h2>
        </div>
        <button className="br-quote-refresh" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar cotação BTC/BRL">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>
      <div className="br-btc-quote-body">
        <div className="br-btc-quote-value">
          {loading ? <span className="br-quote-loading">Carregando cotação…</span> : quote ? <strong>{currency.format(quote.priceBrl)}</strong> : <strong>Indisponível</strong>}
          {quote && <span>por 1 BTC</span>}
        </div>
        <div className={`br-quote-source${isBinance ? " is-primary" : ""}`}>
          <i />
          {isBinance ? "Binance Spot" : quote ? `Fonte reserva · ${quote.source}` : "Aguardando fonte"}
        </div>
      </div>
      <div className="br-btc-quote-meta">
        <span>{updateTime ? `Atualizado às ${updateTime}` : "Buscando o preço mais recente"}</span>
        <span>{quote?.stale ? "Último valor conhecido" : "Atualiza automaticamente a cada 60 s"}</span>
      </div>
      <p className="br-btc-quote-note">Preço spot público da Binance para referência. A cotação de uma compra pode incluir spread, taxa e validade própria.</p>
    </section>
  );
}

function YieldSummary({ onRedeem, onDeposit, onAddMoney, onSimulate, btcPriceBrl, quoteSource, quoteTime, quoteStale, pendingPixDeposit }: { onRedeem: () => void; onDeposit: () => void; onAddMoney: () => void; onSimulate: () => void; btcPriceBrl: number; quoteSource: string; quoteTime: string | null; quoteStale: boolean; pendingPixDeposit: { amountBrl: string } | null }) {
  const currentValue = DEMO_BTC_BALANCE * btcPriceBrl;
  const initialValue = currentValue * wealthPattern[0].factor;
  const wealthGain = currentValue - initialValue;
  const nativeYieldBtc = DEMO_BTC_BALANCE * 0.03;
  return (
    <>
      <section className="br-hero-grid">
        <div className="br-balance-card">
          <div className="br-card-head">
            <div>
              <span className="br-eyebrow light">SEU SALDO EM BITCOIN</span>
              <div className="br-btc-value"><span>₿</span> {formatBtc(DEMO_BTC_BALANCE)}</div>
              <p>Seu rendimento é acumulado nativamente em BTC</p>
            </div>
            <div className="br-orbit"><Bitcoin size={28} /><i /><i /></div>
          </div>
          <div className="br-brl-badge"><Bitcoin size={15} /> Rendimento nativo em BTC · BRL é apenas referência de valor</div>
          <div className="br-balance-brl">
            <div><small>Valor em reais hoje (BRL)</small><strong>{currency.format(currentValue)}</strong></div>
            <span className="br-positive">+0,74% em 90 dias</span>
          </div>
          <div className="br-balance-actions">
            <button type="button" className="br-primary light" onClick={onDeposit} aria-label="Abrir depósito Pix"><img className="br-pix-logo" src={PIX_LOGO_SRC} alt="" aria-hidden="true" /> Pix <ArrowDownToLine size={17} /></button>
            <button type="button" className="br-secondary light" onClick={onAddMoney}>Comprar Bitcoin</button>
            <button type="button" className="br-secondary light" onClick={onRedeem}>Receber via Pix</button>
          </div>
          {pendingPixDeposit && <div className="br-pix-pending" role="status" aria-live="polite"><PixBrand compact /><div><strong>Pix aguardando pagamento</strong><span>{currency.format(Number(pendingPixDeposit.amountBrl))} · QR Code aberto</span></div><button type="button" onClick={onDeposit} aria-label="Acompanhar Pix aguardando pagamento"><ArrowRight size={15} /></button></div>}
        </div>

        <div className="br-yield-card br-panel">
          <div className="br-card-headline"><span>Rendimento nativo em BTC</span><span className="br-live"><i /> REFERÊNCIA</span></div>
          <strong className="br-yield-number">Até 6% a.a.</strong>
          <span className="br-yield-btc">Cenário-base de ~3%: ≈ ₿ {formatBtc(nativeYieldBtc)} em 12 meses · valor equivalente em BRL: {currency.format(currentValue * 0.03)}</span>
          <div className="br-divider" />
          <div className="br-kv"><span>Rendimento nativo em 90 dias</span><b>+0,74%</b></div>
          <div className="br-kv"><span>Conversão BTC/BRL</span><b>{currency.format(btcPriceBrl)}</b></div>
          <div className="br-kv"><span>{quoteStale ? "Último valor conhecido" : "Cotação ao vivo"}</span><b>{quoteSource}{quoteTime ? ` · ${quoteTime}` : ""}</b></div>
          <div className="br-kv"><span>Faixa máxima comunicada</span><b>Até 6% ao ano em BTC</b></div>
          <button type="button" className="br-text-action" onClick={onSimulate}>Simule seus ganhos futuros <ArrowRight size={15} /></button>
        </div>
      </section>

      <section className="br-panel br-wealth-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">PATRIMÔNIO EM REAIS</span>
            <h2>Sua evolução, sem perder a referência em Bitcoin.</h2>
          </div>
          <div className="br-period"><button className="active" type="button">90 dias</button><button type="button" onClick={() => toast.info("Mais períodos na versão completa")}>1 ano</button></div>
        </div>
        <div className="br-chart-summary">
          <div><small>Valor inicial</small><b>{currency.format(initialValue)}</b></div>
          <ArrowRight size={19} />
          <div><small>Valor atual</small><b>{currency.format(currentValue)}</b></div>
          <span className="br-positive">+{currency.format(wealthGain)}</span>
        </div>
        <MiniChart currentValue={currentValue} />
        <div className="br-chart-note"><Fingerprint size={15} /> Patrimônio exibido em BRL para referência; o rendimento nativo é acumulado em BTC.</div>
      </section>
    </>
  );
}

function InnovationGrid({ setSection }: { setSection: (section: SectionId) => void }) {
  const items = [
    { icon: Bitcoin, title: "Bitcoin com rendimento", text: "Seu Bitcoin pode gerar rendimento nativo em BTC sem você precisar lidar com a parte técnica.", tone: "lime" },
    { icon: QrCode, title: "Pix para entrar e sair", text: "Coloque reais e peça seu resgate para uma conta Pix da sua titularidade.", tone: "cyan" },
    { icon: ReceiptText, title: "Tudo bem organizado", text: "Veja quanto colocou, quando comprou e como cada aporte está hoje.", tone: "violet" },
    { icon: FileCheck2, title: "Ajuda para o seu contador", text: "Relatórios em reais, pensados para facilitar sua declaração e sua organização.", tone: "orange" },
    { icon: Network, title: "Reservas que você confere", text: "A parte técnica fica nos bastidores, mas a comprovação continua disponível.", tone: "green" },
    { icon: LockKeyhole, title: "Seu dinheiro separado", text: "O patrimônio dos clientes não se mistura com o caixa da RendeBit.", tone: "blue" },
  ];
  return (
    <section className="br-innovation">
      <div className="br-section-head">
        <div><span className="br-eyebrow">PENSADA PARA A VIDA REAL</span><h2>Bitcoin que conversa com a vida financeira brasileira.</h2></div>
        <button type="button" className="br-outline" onClick={() => setSection("empresas")}>Solução para empresas <ArrowRight size={16} /></button>
      </div>
      <div className="br-feature-grid">
        {items.map(({ icon: Icon, title, text, tone }) => (
          <article className="br-feature-card" key={title}>
            <div className={`br-feature-icon ${tone}`}><Icon size={22} /></div>
            <h3>{title}</h3><p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function YieldPage({ btcPriceBrl }: { btcPriceBrl: number }) {
  const currentValue = DEMO_BTC_BALANCE * btcPriceBrl;
  return (
    <div className="br-stack">
      <section className="br-page-hero compact"><div><span className="br-eyebrow">SEU BITCOIN TRABALHANDO</span><h1>Veja seu rendimento sem complicação.</h1><p>As estratégias elegíveis podem chegar a até 6% ao ano em BTC. Mostramos o rendimento nativo em BTC e a variação do preço do Bitcoin em reais separadamente; o simulador usa um cenário-base conservador.</p></div><div className="br-big-icon"><TrendingUp /></div></section>
      <div className="br-metric-grid">
        <div className="br-panel br-metric"><small>Rendimento nativo anual estimado em BTC</small><strong>Até 6% a.a.</strong><span>teto de referência; cenário-base separado</span></div>
        <div className="br-panel br-metric"><small>Estimativa em 90 dias</small><strong>+0,74%</strong><span>aprox. {currency.format(currentValue * 0.0074)} em BRL</span></div>
        <div className="br-panel br-metric"><small>Variação do Bitcoin</small><strong>Separada</strong><span>pode aumentar ou reduzir o valor em BRL</span></div>
      </div>
      <section className="br-panel br-formula-card">
        <div><span className="br-eyebrow">TRANSPARÊNCIA SEM COMPLICAÇÃO</span><h2>Como chegamos ao seu valor</h2></div>
        <div className="br-formula"><span>Bitcoin comprado</span><i>+</i><span>rendimento nativo em BTC</span><i>×</i><span>cotação em reais</span><i>=</i><b>{currency.format(currentValue)}</b></div>
        <p>O painel combina seu saldo em BTC, o rendimento nativo acumulado em BTC e a cotação em BRL. O valor em reais é uma referência; custos e diferenças de execução aparecem separadamente antes da compra ou do resgate.</p>
      </section>
      <section className="br-panel br-breakdown">
        <div className="br-section-head"><div><span className="br-eyebrow">HISTÓRICO</span><h2>Patrimônio em reais com rendimento nativo em BTC</h2></div><span className="br-positive">+0,74% em 90 dias</span></div>
        <MiniChart currentValue={currentValue} />
      </section>
    </div>
  );
}

function LotsPage({ purchases }: { purchases: PurchaseRecord[] }) {
  const completedPurchases = purchases.filter(purchase => purchase.completed);
  const pendingPurchases = purchases.length - completedPurchases.length;
  const totals = completedPurchases.reduce((acc, purchase) => ({ invested: acc.invested + purchase.invested, current: acc.current + purchase.currentValue, gain: acc.gain + purchase.gain }), { invested: 0, current: 0, gain: 0 });
  return (
    <div className="br-stack">
      <section className="br-page-hero compact"><div><span className="br-eyebrow">SEUS APORTES, BEM ORGANIZADOS</span><h1>Cada compra conta uma parte da sua história.</h1><p>Confira quanto colocou em reais, quanto Bitcoin recebeu, o rendimento nativo acumulado e como cada aporte está hoje.</p></div><div className="br-big-icon"><Layers3 /></div></section>
      <div className="br-purchase-summary"><div className="br-panel"><small>Total investido</small><b>{currency.format(totals.invested)}</b><span>{completedPurchases.length} concluídas{pendingPurchases ? ` · ${pendingPurchases} pendentes` : ""}</span></div><div className="br-panel"><small>Valor atual</small><b>{currency.format(totals.current)}</b><span>somente compras concluídas</span></div><div className="br-panel"><small>Resultado estimado</small><b className={totals.gain >= 0 ? "gain" : "loss"}>{formatSignedCurrency(totals.gain)}</b><span>estimativa em BRL</span></div></div>
      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><h2>Compras e ativações</h2><p>Valores demonstrativos atualizados em 08/09/2026.</p></div><button className="br-outline" type="button" onClick={() => toast.success("CSV demonstrativo preparado")}>Exportar CSV <ArrowDownToLine size={16} /></button></div>
        <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Aporte em BRL</th><th>Pagamento</th><th>Bitcoin comprado</th><th>Cotação BTC/BRL</th><th>Valor atual</th><th>Resultado</th><th>Status</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td><b>{purchase.date}</b></td><td>{currency.format(purchase.invested)}</td><td>{purchase.paymentMethod === "credit_card" ? "Cartão" : "Pix"}</td><td className="mono">{purchase.completed ? `₿ ${formatBtc(purchase.btc)}` : "Aguardando"}</td><td>{currency.format(purchase.quote)}</td><td>{purchase.completed ? currency.format(purchase.currentValue) : "—"}</td><td className={purchase.completed ? (purchase.gain >= 0 ? "gain" : "loss") : ""}>{purchase.completed ? formatSignedCurrency(purchase.gain) : "—"}</td><td><span className={`br-status ${purchase.completed ? "" : "pending"}`}><i />{purchase.status}</span>{purchase.checkoutUrl && !purchase.completed && <button className="br-resume-checkout" type="button" onClick={() => window.location.assign(purchase.checkoutUrl!)}>Continuar pagamento</button>}</td></tr>)}</tbody></table></div>
        <div className="br-history-disclosure"><ShieldCheck size={17} /><div><b>Rendimento nativo em BTC ativado</b><span>A tela mostra o valor em reais para facilitar a leitura, mas o rendimento é gerado e acumulado em BTC. A trilha técnica de conversão e aplicação permanece verificável na área Segurança.</span></div></div>
      </section>
    </div>
  );
}

function RedeemPage({
  amount,
  setAmount,
  availableBtc,
  pixDestination,
  quote,
  quoteSeconds,
  redemptions,
  authenticated,
  loading,
  btcPriceBrl,
  onQuote,
}: {
  amount: string;
  setAmount: (value: string) => void;
  availableBtc: number;
  pixDestination: string;
  quote: RedemptionQuoteView | null;
  quoteSeconds: number;
  redemptions: Array<{ id: number; requestedAt: Date; btcAmount: string; netBrl: string; status: string; pixEndToEndId: string | null }>;
  authenticated: boolean;
  loading: boolean;
  btcPriceBrl: number;
  onQuote: () => void;
}) {
  const numericAmount = Number(amount.replace(",", ".")) || 0;
  const gross = quote ? Number(quote.grossBrl) : numericAmount * btcPriceBrl;
  const protocolFee = quote ? Number(quote.protocolFeeBrl) : gross * 0.0015;
  const fxFee = quote ? Number(quote.conversionPixFeeBrl) : gross * 0.0045;
  const net = quote ? Number(quote.netBrl) : Math.max(0, gross - protocolFee - fxFee);
  const formatInput = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 8, maximumFractionDigits: 8, useGrouping: false });
  const statusLabel = (status: string) => ({ settled: "Pix concluído", processing: "Em processamento", manual_review: "Em revisão", failed: "Não concluído", cancelled: "Cancelado" }[status] ?? status);
  return (
    <div className="br-stack">
      <section className="br-page-hero compact pix"><div><span className="br-eyebrow">RECEBA NA SUA CONTA PIX</span><h1>Precisou usar seu dinheiro? É só pedir.</h1><p>Antes de confirmar, você vê a cotação, as taxas e o valor líquido em reais. O Pix vai para uma conta verificada no seu nome.</p></div><div className="br-big-icon"><QrCode /></div></section>
      <div className="br-redemption-status"><ShieldCheck size={17} /><div><b>Resgate protegido por saldo reservado</b><span>O valor só fica indisponível após sua confirmação. Em sandbox, nenhuma transação ou Pix real é enviado.</span></div><strong>Disponível: ₿ {formatBtc(availableBtc)}</strong></div>
      <div className="br-redeem-grid">
        <section className="br-panel br-quote-form">
          <span className="br-eyebrow">QUANTO DESEJA RESGATAR?</span>
          <label className="br-amount-input"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" aria-label="Quantidade de Bitcoin" /><span>BTC</span></label>
          <div className="br-chips"><button type="button" disabled={availableBtc <= 0} onClick={() => setAmount(formatInput(availableBtc * 0.25))}>25%</button><button type="button" disabled={availableBtc <= 0} onClick={() => setAmount(formatInput(availableBtc * 0.5))}>50%</button><button type="button" disabled={availableBtc <= 0} onClick={() => setAmount(formatInput(availableBtc))}>Máximo</button></div>
          <div className="br-pix-account"><div className="br-bank-icon"><Landmark size={20} /></div><div><small>Conta Pix de destino</small><b>{pixDestination || "Conta Pix não verificada"}</b><span>{pixDestination ? "Mesma titularidade verificada no sandbox" : "Confirme seus dados antes de resgatar"}</span></div>{pixDestination ? <BadgeCheck size={21} /> : <ShieldCheck size={21} />}</div>
          <button type="button" className="br-primary full" disabled={authenticated && (numericAmount <= 0 || numericAmount > availableBtc || loading)} onClick={onQuote}>{loading ? <RefreshCw className="animate-spin" size={17} /> : <ArrowRight size={17} />} {authenticated ? "Gerar cotação segura" : "Entrar para resgatar"}</button>
          {authenticated && availableBtc <= 0 && <p className="br-inline-error">Faça uma compra sandbox antes de solicitar um resgate.</p>}
          {authenticated && numericAmount > availableBtc && availableBtc > 0 && <p className="br-inline-error">A quantidade informada é maior que o saldo disponível.</p>}
        </section>
        <section className="br-panel br-live-quote">
          <div className="br-card-headline"><h2>Cotação transparente</h2><span className="br-live"><i /> {quote ? `${quoteSeconds}s` : "prévia"}</span></div>
          <div className="br-quote-value"><small>Você receberá</small><strong>{currency.format(net)}</strong><span>via Pix após a liquidação</span></div>
          <div className="br-divider" />
          <div className="br-kv"><span>Valor bruto</span><b>{currency.format(gross)}</b></div>
          <div className="br-kv"><span>Resgate do protocolo (0,15%)</span><b>-{currency.format(protocolFee)}</b></div>
          <div className="br-kv"><span>Conversão e Pix (0,45%)</span><b>-{currency.format(fxFee)}</b></div>
          <div className="br-kv total"><span>Valor líquido</span><b>{currency.format(net)}</b></div>
          <div className="br-warning"><ShieldCheck size={18} /><p><b>{quote ? "Cotação persistida." : "Prévia indicativa."}</b> O valor só é confirmado depois da sua revisão final.</p></div>
        </section>
      </div>
      <section className="br-panel br-table-card br-redemption-history">
        <div className="br-section-head"><div><span className="br-eyebrow">HISTÓRICO DE RESGATES</span><h2>Do pedido à confirmação do Pix</h2></div><span className="br-help-honesty"><ReceiptText size={15} /> Trilha persistida</span></div>
        {redemptions.length === 0 ? <div className="br-ops-empty">Nenhum resgate solicitado nesta conta.</div> : <div className="br-table-scroll"><table><thead><tr><th>Solicitado em</th><th>Quantidade</th><th>Valor líquido</th><th>Destino</th><th>Status</th><th>Referência</th></tr></thead><tbody>{redemptions.map(item => <tr key={item.id}><td>{new Date(item.requestedAt).toLocaleString("pt-BR")}</td><td className="mono">₿ {item.btcAmount}</td><td><b>{currency.format(Number(item.netBrl))}</b></td><td>{pixDestination || "Conta verificada"}</td><td><span className={`br-status ${item.status === "manual_review" || item.status === "failed" ? "warning" : ""}`}><i />{statusLabel(item.status)}</span></td><td className="mono">{item.pixEndToEndId || "Aguardando"}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function PixDepositPage({ deposits, availableBrl, amount, setAmount, authenticated, loading, onCreate, onPay, onLogin }: {
  deposits: PixDepositRecord[];
  availableBrl: number;
  amount: string;
  setAmount: (value: string) => void;
  authenticated: boolean;
  loading: boolean;
  onCreate: () => void;
  onPay: (depositId: number) => void;
  onLogin: () => void;
}) {
  const active = deposits.find(item => item.status === "awaiting_payment") ?? null;
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const secondsLeft = active ? Math.max(0, Math.floor((new Date(active.expiresAt).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    if (!active?.qrCodeText) { setQrDataUrl(""); return; }
    void QRCode.toDataURL(active.qrCodeText, { width: 260, margin: 1, color: { dark: "#2a211b", light: "#fffaf2" } }).then(setQrDataUrl);
  }, [active?.id, active?.qrCodeText]);

  useEffect(() => {
    if (!active || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active?.id, secondsLeft]);

  const statusLabel: Record<PixDepositRecord["status"], string> = {
    created: "Criado",
    awaiting_payment: "Pix aguardando pagamento",
    paid: "Saldo disponível",
    expired: "Expirado",
    cancelled: "Cancelado",
    manual_review: "Em análise",
  };

  if (!authenticated) return <div className="br-stack"><section className="br-page-hero compact"><div><span className="br-eyebrow">DEPÓSITO VIA PIX</span><h1>Entre para gerar seu QR Code.</h1><p>Use uma conta Google/Gmail ou Apple no portal seguro. Nenhum Pix real é movimentado no sandbox.</p><button className="br-primary" type="button" onClick={onLogin}>Entrar com Gmail ou Apple <ArrowRight size={16} /></button></div><div className="br-big-icon"><QrCode /></div></section></div>;

  return (
    <div className="br-stack">
      <section className="br-page-hero compact br-pix-hero"><div><span className="br-eyebrow">COLOQUE REAIS COM PIX</span><h1>Seu primeiro passo leva poucos minutos.</h1><p>Escolha o valor, escaneie o QR Code ou use o Pix Copia e Cola. O saldo aparece somente depois da confirmação do pagamento.</p></div><div className="br-pix-balance"><small>Seus reais disponíveis</small><strong>{currency.format(availableBrl)}</strong><span><ShieldCheck size={14} /> Separados do caixa da empresa</span></div></section>

      <div className="br-pix-grid">
        <section className="br-panel br-pix-create">
          <span className="br-eyebrow">NOVO DEPÓSITO</span><h2>Quanto deseja depositar?</h2>
          <div className="br-amount-field"><span>R$</span><input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-label="Valor do depósito Pix" /></div>
          <div className="br-buy-chips"><button type="button" onClick={() => setAmount("100,00")}>R$ 100</button><button type="button" onClick={() => setAmount("500,00")}>R$ 500</button><button type="button" onClick={() => setAmount("1.000,00")}>R$ 1.000</button></div>
          <div className="br-pix-rules"><span><Check /> Crédito somente após confirmação</span><span><Check /> Cobrança válida por 15 minutos</span><span><Check /> Sem taxa no sandbox</span></div>
          <button className="br-primary full" type="button" onClick={onCreate} disabled={loading || parseBrl(amount) < 10 || parseBrl(amount) > 1_000_000}><img className="br-pix-logo" src={PIX_LOGO_SRC} alt="" aria-hidden="true" /> {loading ? "Gerando…" : "Gerar QR Code Pix"}</button>
          <p className="br-dialog-footnote"><ShieldCheck size={13} /> Em produção, a titularidade e a assinatura do webhook serão verificadas pelo parceiro Pix.</p>
        </section>

        <section className="br-panel br-pix-charge">
          {!active ? <div className="br-pix-empty"><QrCode /><h3>Nenhuma cobrança aberta</h3><p>Escolha um valor para gerar um QR Code demonstrativo.</p></div> : <>
            <div className="br-pix-proof-bar"><PixBrand compact /><span>Comprovante Pix sandbox</span><small>RendeBit</small></div>
            <div className="br-pix-charge-head"><div><span className="br-eyebrow">COBRANÇA ATIVA</span><h2>{currency.format(Number(active.amountBrl))}</h2></div><span className={`br-pix-timer ${secondsLeft === 0 ? "expired" : ""}`}>{secondsLeft > 0 ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}` : "Expirada"}</span></div>
            {qrDataUrl && <img className="br-pix-qr" src={qrDataUrl} alt="QR Code da cobrança Pix sandbox" />}
            <div className="br-pix-code"><span>Pix Copia e Cola</span><code>{active.pixCopyPaste}</code><CopyButton value={active.pixCopyPaste ?? ""} label="Copiar código" /></div>
            <button className="br-outline full" type="button" onClick={() => downloadPixReceipt(active)}><FileDown size={16} /> Baixar comprovante Pix (PDF)</button>
            <button className="br-outline full" type="button" onClick={() => onPay(active.id)} disabled={loading || secondsLeft === 0}><BadgeCheck size={16} /> Simular pagamento no sandbox</button>
            <p className="br-inline-note">Em produção, este botão não existe: o crédito ocorre somente após webhook assinado e conciliação.</p>
          </>}
        </section>
      </div>

      <section className="br-panel br-table-card br-pix-history"><div className="br-section-head"><div className="br-pix-history-heading"><PixBrand compact /><div><span className="br-eyebrow">HISTÓRICO PIX</span><h2>Depósitos e conciliação</h2></div></div><span className="br-help-honesty"><ReceiptText size={15} /> {deposits.length} registros</span></div>{deposits.length === 0 ? <div className="br-ops-empty">Nenhum depósito Pix registrado.</div> : <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Valor</th><th>Status Pix</th><th>Referência</th><th>Confirmação</th><th>Comprovante</th></tr></thead><tbody>{deposits.map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td><b>{currency.format(Number(item.amountBrl))}</b></td><td><span className={`br-status ${item.status === "paid" ? "" : "warning"}`}><i /> {item.status === "awaiting_payment" && new Date(item.expiresAt).getTime() <= now ? "Expirado" : statusLabel[item.status]}</span></td><td className="mono">{item.providerReference ?? "—"}</td><td className="mono">{item.endToEndId ?? "—"}</td><td><button className="br-table-download" type="button" onClick={() => downloadPixReceipt(item)}><FileDown size={14} /> PDF</button></td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}

function FiscalPage() {
  return (
    <div className="br-stack">
      <section className="br-page-hero compact fiscal"><div><span className="br-eyebrow">ANO-CALENDÁRIO 2026</span><h1>Na hora de falar com seu contador, fica mais simples.</h1><p>Posição patrimonial, custo de cada compra e resgates organizados em reais, num só lugar.</p></div><div className="br-big-icon"><FileCheck2 /></div></section>
      <div className="br-fiscal-grid">
        <section className="br-panel br-report-preview">
          <div className="br-report-top"><div className="br-report-mark"><Bitcoin /> <b>RENDEBIT</b></div><span>RELATÓRIO FISCAL 2026</span></div>
          <div className="br-report-person"><small>Titular</small><b>Alexandre B. • CPF •••.482.•••-••</b></div>
          <div className="br-report-values"><div><small>Posição em 31/12</small><b>R$ 122.314,00</b></div><div><small>Custo de aquisição</small><b>R$ 115.800,00</b></div><div><small>Ganhos realizados</small><b>R$ 0,00</b></div></div>
          <div className="br-report-lines"><i /><i /><i /><i /></div>
          <div className="br-report-seal"><FileCheck2 /><span>Conciliação por lote concluída</span></div>
        </section>
        <section className="br-panel br-report-actions"><span className="br-eyebrow">PRONTO PARA EXPORTAR</span><h2>Pacote fiscal completo</h2><ul><li><Check /> Bens e Direitos em BRL</li><li><Check /> Memória de cálculo por lote</li><li><Check /> Resgates e conversões realizados</li><li><Check /> Extrato anual das taxas</li><li><Check /> Arquivo auxiliar em CSV</li></ul><button className="br-primary full" type="button" onClick={() => toast.success("PDF demonstrativo gerado")}>Baixar relatório em PDF <ArrowDownToLine size={17} /></button><button className="br-outline full" type="button" onClick={() => toast.info("Compartilhamento seguro disponível na versão completa")}>Compartilhar com contador</button><p className="br-legal-note">Material informativo demonstrativo. A classificação tributária deve ser validada por profissional habilitado.</p></section>
      </div>
    </div>
  );
}

function ReservesPage({
  wallets,
  settlements,
  xverseActions,
  authenticated,
  saving,
  connectingXverse,
  xversePermissionGranted,
  permissionLoading,
  onSaveWallet,
  onConnectXverse,
  onRequestPermission,
  onRevokePermission,
  onSignAction,
  focusActionId,
  onFocusActionConsumed,
  onLogin,
}: {
  wallets: Array<{
    id: number;
    address: string;
    network: "testnet" | "mainnet";
    label: string | null;
    isPrimary: boolean;
  }>;
  settlements: Array<{
    id: number;
    status: string;
    provider: string;
    btcAmount: string;
    blockerReason: string | null;
    stacksTxId: string | null;
  }>;
  xverseActions: Array<{
    id: number;
    actionType: "wallet_connection" | "withdrawal" | "swap" | "yield";
    status: string;
    network: "testnet" | "mainnet";
    walletAddress: string;
    transactionId: string | null;
    unsignedTransaction: string | null;
    createdAt: Date | string;
  }>;
  authenticated: boolean;
  saving: boolean;
  connectingXverse: boolean;
  xversePermissionGranted: boolean;
  permissionLoading: boolean;
  onSaveWallet: (input: {
    address: string;
    network: "testnet" | "mainnet";
    label: string;
  }) => void;
  onConnectXverse: () => void;
  onRequestPermission: () => void;
  onRevokePermission: () => void;
  onSignAction: (action: {
    id: number;
    actionType: "withdrawal" | "swap" | "yield";
    unsignedTransaction: string;
  }) => Promise<void>;
  focusActionId: number | null;
  onFocusActionConsumed: () => void;
  onLogin: () => void;
}) {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [label, setLabel] = useState("Minha carteira Stacks");
  const primary = wallets.find(wallet => wallet.isPrimary && wallet.network === network) ?? null;
  const latestSettlement = settlements[0] ?? null;
  const [xverseGuideOpen, setXverseGuideOpen] = useState(false);
  const [signatureDialogAction, setSignatureDialogAction] = useState<{
    id: number;
    actionType: "withdrawal" | "swap" | "yield";
    unsignedTransaction: string;
  } | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const pendingSignature = xverseActions.find(
    action =>
      action.status === "intent_created" &&
      action.actionType !== "wallet_connection" &&
      Boolean(action.unsignedTransaction)
  );
  const pendingSignatureLabel = pendingSignature?.actionType === "withdrawal"
    ? "um recebimento"
    : pendingSignature?.actionType === "swap"
      ? "uma troca"
      : pendingSignature?.actionType === "yield"
        ? "uma atualização"
        : null;
  useEffect(() => {
    if (!focusActionId || pendingSignature?.id !== focusActionId) return;
    setSignatureDialogAction({
      id: pendingSignature.id,
      actionType: pendingSignature.actionType as "withdrawal" | "swap" | "yield",
      unsignedTransaction: pendingSignature.unsignedTransaction!,
    });
    onFocusActionConsumed();
  }, [focusActionId, onFocusActionConsumed, pendingSignature]);

  function saveWallet() {
    if (!authenticated) {
      onLogin();
      return;
    }
    if (!address.trim()) {
      toast.error("Cole o endereço público da sua carteira Stacks.");
      return;
    }
    onSaveWallet({ address: address.trim(), network, label: label.trim() });
  }

  const reserveItems = [
    { label: "stBTC em circulação", value: "142,8047 stBTC", detail: "Contrato do token" },
    { label: "sBTC em reservas e bonds", value: "146,6239 sBTC", detail: "Lastro verificável" },
    { label: "Índice de cobertura", value: "102,67%", detail: "Atualizado no bloco 612.842" },
  ];
  return (
    <div className="br-stack">
      <section className="br-page-hero compact reserves"><div><span className="br-eyebrow">SEGURANÇA EXPLICADA COM CLAREZA</span><h1>Você não precisa entender a tecnologia para conferir.</h1><p>Traduzimos reservas, lastro e separação do patrimônio para uma linguagem simples. Os números abaixo são demonstrativos.</p></div><div className="br-big-icon"><ShieldCheck /></div></section>
      <div className="br-reserve-grid">{reserveItems.map((item, index) => <div className="br-panel br-reserve-metric" key={item.label}><div className={`br-number-chip n${index}`}>0{index + 1}</div><small>{item.label}</small><strong>{item.value}</strong><span>{item.detail}</span></div>)}</div>
      <section className="br-panel br-custody-card">
        <div className="br-section-head"><div><span className="br-eyebrow">CUSTÓDIA SEGREGADA</span><h2>Patrimônio do cliente separado da operação.</h2></div><span className="br-verified"><BadgeCheck /> Estrutura verificável</span></div>
        <div className="br-custody-flow">
          <div className="br-flow-node"><div><WalletCards /></div><b>Carteiras dos clientes</b><span>Posições individualizadas</span></div><ArrowRight />
          <div className="br-flow-node highlighted"><div><LockKeyhole /></div><b>Vault segregado</b><span>Sem mistura com caixa</span></div><ArrowRight />
          <div className="br-flow-node"><div><Network /></div><b>Protocolo stBTC</b><span>Reservas + PoX-5</span></div><ArrowRight />
          <div className="br-flow-node"><div><Landmark /></div><b>Parceiro BRL</b><span>Liquidação via Pix</span></div>
        </div>
      </section>
      <section className="br-panel br-contract-card"><div><span className="br-eyebrow">ENDEREÇO DEMONSTRATIVO</span><h3>Vault segregado de clientes</h3><code>SP2NEXO...8FA2.stbtc-client-vault-v1</code></div><CopyButton value="SP2NEXO8EXAMPLE8FA2.stbtc-client-vault-v1" label="Copiar endereço" /></section>
      <section className="br-panel br-stacks-wallet-card">
        <div className="br-section-head">
          <div><span className="br-eyebrow">SUA CARTEIRA</span><h2>Endereço da sua carteira</h2><p>Usamos somente o endereço público para organizar sua conta. Você não precisa compartilhar senha ou qualquer código secreto.</p></div>
          <span className="br-help-honesty"><Network size={15} /> {primary ? "Endereço cadastrado" : "Pendente"}</span>
        </div>
        <div className="br-stacks-wallet-grid">
          <div className="br-stacks-wallet-form">
            <label><span>Ambiente</span><select value={network} onChange={event => setNetwork(event.target.value as "testnet" | "mainnet")}><option value="testnet">Ambiente de teste</option><option value="mainnet">Ambiente principal</option></select></label>
            <label><span>Apelido</span><input value={label} maxLength={100} onChange={event => setLabel(event.target.value)} placeholder="Ex.: minha carteira" /></label>
            <label className="wide"><span>Endereço da carteira</span><input value={address} spellCheck={false} autoCapitalize="characters" onChange={event => setAddress(event.target.value.toUpperCase())} placeholder={network === "testnet" ? "ST..." : "SP..."} /></label>
            <div className="br-stacks-wallet-actions">
              <button className="br-primary" type="button" onClick={saveWallet} disabled={saving || connectingXverse}>{saving ? <RefreshCw className="animate-spin" size={16} /> : <WalletCards size={16} />}{authenticated ? "Salvar endereço público" : "Entrar para cadastrar"}</button>
              <button className="br-outline br-xverse-trigger" type="button" onClick={() => setXverseGuideOpen(true)} disabled={saving || connectingXverse}>{connectingXverse ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />} {connectingXverse ? "Abrindo sua carteira…" : xversePermissionGranted ? "Carteira conectada" : "Conectar carteira"}</button>
            </div>
          </div>
          <div className="br-stacks-wallet-status">
            <div><small>Carteira principal</small><code>{primary?.address ?? "Ainda não informada"}</code><span>{primary ? `${primary.label || "Carteira principal"} · ${primary.network === "testnet" ? "ambiente de teste" : "ambiente principal"}` : "Cadastre antes de habilitar esta opção."}</span></div>
            <div className={`br-stacks-settlement ${latestSettlement?.status === "blocked" ? "blocked" : ""}`}><b>Preparação da compra</b><span>{latestSettlement ? latestSettlement.status === "blocked" ? "Aguardando uma revisão de segurança." : "Em preparação." : "Nenhuma compra aguardando preparação."}</span>{latestSettlement?.stacksTxId && <code>{latestSettlement.stacksTxId}</code>}</div>
          </div>
        </div>
        <p className="br-inline-note"><ShieldCheck size={14} /> Este é um ambiente de demonstração: nada é enviado de verdade. Antes de qualquer operação real, todos os controles serão revisados.</p>
        <div className="br-wallet-helper">
          <div className="br-wallet-helper-icon"><Sparkles size={18} /></div>
          <div>
            <b>{pendingSignature ? "Há um pedido esperando sua confirmação." : "Sua carteira fica com você."}</b>
            <p>{pendingSignature ? `Confira ${pendingSignatureLabel} com calma antes de decidir.` : "Quando algo precisar da sua confirmação, abriremos uma janelinha simples para você conferir com calma."}</p>
          </div>
          {pendingSignature ? <button className="br-primary br-wallet-helper-action" type="button" onClick={() => setSignatureDialogAction({ id: pendingSignature.id, actionType: pendingSignature.actionType as "withdrawal" | "swap" | "yield", unsignedTransaction: pendingSignature.unsignedTransaction! })}>Conferir agora <ArrowRight size={14} /></button> : <button className="br-text-action" type="button" onClick={() => setXverseGuideOpen(true)}>Como funciona</button>}
        </div>
      </section>
      <Dialog open={xverseGuideOpen} onOpenChange={setXverseGuideOpen}>
        <DialogContent className="br-confirm-dialog br-xverse-dialog">
          <DialogHeader>
            <div className="br-xverse-dialog-icon"><Sparkles size={22} /></div>
            <DialogTitle>Sua carteira confirma com você</DialogTitle>
            <DialogDescription>
              Quando algo precisar da sua autorização, vamos explicar o que está acontecendo antes de pedir sua confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="br-xverse-journey" aria-label="Etapas da autorização Xverse">
            <div className="br-xverse-journey-step is-current">
              <span>1</span>
              <div><b>Mostrar o endereço da sua carteira</b><small>Compartilhamos apenas o endereço público escolhido por você.</small></div>
              <WalletCards size={18} />
            </div>
            <div className="br-xverse-journey-step">
              <span>2</span>
              <div><b>Você confere cada pedido</b><small>Se uma ação precisar de confirmação, mostraremos o pedido em uma janelinha clara.</small></div>
              <Fingerprint size={18} />
            </div>
            <div className="br-xverse-journey-step is-locked">
              <span>3</span>
              <div><b>Seu acesso continua protegido</b><small>A RendeBit nunca pede sua senha ou qualquer código secreto.</small></div>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="br-xverse-permission-note">
            <CircleCheckBig size={16} />
            <p><b>O que acontece agora?</b> Sua carteira mostrará um pedido para compartilhar o endereço público. Você pode aceitar ou fechar sem continuar.</p>
          </div>
          <div className="br-xverse-dialog-actions">
            <button className="br-dialog-cancel" type="button" onClick={() => setXverseGuideOpen(false)}>Agora não</button>
            {xversePermissionGranted ? <button className="br-primary" type="button" onClick={onRequestPermission} disabled={permissionLoading}>{permissionLoading ? "Abrindo sua carteira…" : "Revisar conexão"} <ArrowRight size={16} /></button> : <button className="br-primary" type="button" onClick={() => { setXverseGuideOpen(false); onConnectXverse(); }} disabled={connectingXverse}>{connectingXverse ? "Abrindo sua carteira…" : "Continuar"} <ArrowRight size={16} /></button>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(signatureDialogAction)} onOpenChange={open => { if (!open && !signatureLoading) setSignatureDialogAction(null); }}>
        <DialogContent className="br-confirm-dialog br-xverse-dialog br-signature-dialog">
          <DialogHeader>
            <div className="br-xverse-dialog-icon"><ShieldCheck size={22} /></div>
            <DialogTitle>Confira antes de confirmar</DialogTitle>
            <DialogDescription>
              Sua carteira vai mostrar os detalhes de {signatureDialogAction?.actionType === "withdrawal" ? "um recebimento" : signatureDialogAction?.actionType === "swap" ? "uma troca" : "uma atualização"}. Só continue se tudo fizer sentido para você.
            </DialogDescription>
          </DialogHeader>
          <div className="br-signature-checklist">
            <div><CircleCheckBig size={16} /><span>Você verá o pedido na sua carteira.</span></div>
            <div><CircleCheckBig size={16} /><span>Nada acontece sem sua confirmação.</span></div>
            <div><CircleCheckBig size={16} /><span>Se preferir, basta fechar esta janela.</span></div>
          </div>
          <div className="br-xverse-dialog-actions">
            <button className="br-dialog-cancel" type="button" onClick={() => setSignatureDialogAction(null)} disabled={signatureLoading}>Agora não</button>
            <button className="br-primary" type="button" disabled={!signatureDialogAction || signatureLoading} onClick={async () => { if (!signatureDialogAction) return; setSignatureLoading(true); try { await onSignAction(signatureDialogAction); setSignatureDialogAction(null); } finally { setSignatureLoading(false); } }}>{signatureLoading ? "Abrindo sua carteira…" : "Conferir na carteira"} <ArrowRight size={16} /></button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BusinessPage() {
  return <BusinessSolutions />;
}

export default function BitcoinYield() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const utils = trpc.useUtils();
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: isAuthenticated });
  const pixDepositsQuery = trpc.pixDeposits.summary.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5_000, refetchInterval: isAuthenticated ? 15_000 : false });
  const purchasesQuery = trpc.purchases.list.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5_000, refetchInterval: isAuthenticated ? 15_000 : false });
  const walletsQuery = trpc.wallets.list.useQuery(undefined, { enabled: isAuthenticated });
  const walletSettlementsQuery = trpc.wallets.settlements.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: isAuthenticated ? 15_000 : false });
  const xverseActionsQuery = trpc.wallets.xverseActions.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: isAuthenticated ? 15_000 : false });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: isAuthenticated ? 15_000 : false });
  const redemptionsQuery = trpc.redemptions.summary.useQuery(undefined, { enabled: isAuthenticated });
  const marketQuoteQuery = trpc.market.btcBrl.useQuery(undefined, { staleTime: 55_000, refetchInterval: 60_000, retry: 1 });
  const [dashboardNow, setDashboardNow] = useState(Date.now());
  const hasAwaitingPix = Boolean(pixDepositsQuery.data?.deposits.some(item => item.status === "awaiting_payment" && new Date(item.expiresAt).getTime() > dashboardNow));
  useEffect(() => {
    if (!hasAwaitingPix) return;
    const timer = window.setInterval(() => setDashboardNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasAwaitingPix]);
  const [section, setSection] = useState<SectionId>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return navItems.some(item => item.id === requested) ? requested as SectionId : "inicio";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusNotificationActionId, setFocusNotificationActionId] = useState<number | null>(null);
  const [loginOpen, setLoginOpen] = useState(() => new URLSearchParams(window.location.search).get("login") === "1");
  const pixStatusRef = useRef<Record<number, PixDepositRecord["status"]>>({});
  const simulatedPixIdsRef = useRef<Set<number>>(new Set());
  const purchaseStatusRef = useRef<Record<number, string>>({});
  const notifiedConfirmationIdsRef = useRef<Set<number>>(new Set());
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [onboardingIntent, setOnboardingIntent] = useState<"purchase" | "deposit">("purchase");
  const [amount, setAmount] = useState("0,01500000");
  const [addAmount, setAddAmount] = useState("1.000,00");
  const [pixDepositAmount, setPixDepositAmount] = useState("500,00");
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("eligibility");
  const [quoteSeconds, setQuoteSeconds] = useState(59);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [eligibility, setEligibility] = useState({ resident: false, cpf: false, pix: false });
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [redemptionStep, setRedemptionStep] = useState<RedemptionStep>("review");
  const [redemptionQuote, setRedemptionQuote] = useState<RedemptionQuoteView | null>(null);
  const [redemptionQuoteSeconds, setRedemptionQuoteSeconds] = useState(0);
  const [redemptionRiskAccepted, setRedemptionRiskAccepted] = useState(false);
  const [completedRedemption, setCompletedRedemption] = useState<{ pixEndToEndId: string | null; netBrl: string } | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(initialPurchases);
  const [legalName, setLegalName] = useState("Alexandre Bastos");
  const [cpfMasked, setCpfMasked] = useState("•••.482.•••-••");
  const [pixAccount, setPixAccount] = useState("Banco Inter •••• 4821");
  const [serverQuote, setServerQuote] = useState<Awaited<ReturnType<typeof createQuoteMutation.mutateAsync>> | null>(null);
  const activeLabel = useMemo(() => navItems.find((item) => item.id === section)?.label ?? "Visão geral", [section]);
  const loginProviderLabel = user?.loginMethod?.toLowerCase().includes("apple") ? "Conta Apple" : user?.loginMethod?.toLowerCase().includes("google") ? "Conta Google" : "Conta autenticada";
  const liveBtcBrl = marketQuoteQuery.data?.priceBrl ?? FALLBACK_BTC_BRL;
  const pendingPixDeposit = isAuthenticated
    ? pixDepositsQuery.data?.deposits.find(item => item.status === "awaiting_payment" && new Date(item.expiresAt).getTime() > dashboardNow) ?? null
    : null;
  useEffect(() => {
    if (!isAuthenticated) {
      notifiedConfirmationIdsRef.current.clear();
      return;
    }
    const confirmations = (notificationsQuery.data?.notifications ?? []).filter(
      notification => notification.kind === "confirmation_required" && !notification.readAt
    );
    confirmations.forEach(notification => {
      if (notifiedConfirmationIdsRef.current.has(notification.id)) return;
      notifiedConfirmationIdsRef.current.add(notification.id);
      toast.info(notification.title, { description: "Abra o sino no topo para conferir com calma." });
    });
  }, [isAuthenticated, notificationsQuery.data?.notifications]);
  const marketQuoteTime = marketQuoteQuery.data ? new Date(marketQuoteQuery.data.marketUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  const localPurchaseQuote = useMemo(() => {
    const amountInBrl = parseBrl(addAmount);
    const serviceFee = amountInBrl * 0.005;
    const executionPrice = liveBtcBrl * 1.0065;
    const applied = Math.max(0, amountInBrl - serviceFee);
    return { amountInBrl, serviceFee, executionPrice, applied, btc: executionPrice > 0 ? applied / executionPrice : 0 };
  }, [addAmount, quoteNonce, liveBtcBrl]);
  const purchaseQuote = serverQuote ? {
    amountInBrl: Number(serverQuote.amountBrl),
    serviceFee: Number(serverQuote.serviceFeeBrl),
    executionPrice: Number(serverQuote.executionBtcBrl),
    applied: Number(serverQuote.amountBrl) - Number(serverQuote.serviceFeeBrl),
    btc: Number(serverQuote.btcAmount),
  } : localPurchaseQuote;
  const isEligible = eligibility.resident && eligibility.cpf && eligibility.pix;

  const saveProfileMutation = trpc.onboarding.save.useMutation();
  const verifyKycMutation = trpc.onboarding.simulateKycApproval.useMutation();
  const createPixDepositMutation = trpc.pixDeposits.create.useMutation();
  const settlePixDepositMutation = trpc.pixDeposits.simulatePayment.useMutation();
  const createQuoteMutation = trpc.purchases.createQuote.useMutation();
  const confirmPurchaseMutation = trpc.purchases.confirm.useMutation();
  const saveStacksWalletMutation = trpc.wallets.save.useMutation({
    onSuccess: async wallet => {
      await Promise.all([
        utils.wallets.list.invalidate(),
        utils.wallets.settlements.invalidate(),
      ]);
      toast.success("Carteira Stacks salva", {
        description: `${wallet.network === "testnet" ? "Testnet" : "Mainnet"} vinculada como endereço público principal.`,
      });
    },
    onError: error => toast.error(error.message),
  });
  const recordXverseConnectionMutation = trpc.wallets.recordXverseConnection.useMutation({
    onSuccess: async () => {
      await utils.wallets.xverseActions.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const recordXverseSignatureMutation = trpc.wallets.recordXverseSignature.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.wallets.xverseActions.invalidate(),
        utils.notifications.list.invalidate(),
      ]);
      toast.success("Tudo certo", {
        description: "Sua confirmação foi registrada. A operação continua em análise antes de qualquer envio.",
      });
    },
    onError: error => toast.error(error.message),
  });
  const markNotificationReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => void utils.notifications.list.invalidate(),
  });
  const markAllNotificationsReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => void utils.notifications.list.invalidate(),
  });
  const [connectingXverse, setConnectingXverse] = useState(false);
  const [xversePermissionGranted, setXversePermissionGranted] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);

  async function connectCustomerXverse() {
    if (!isAuthenticated) {
      setLoginOpen(true);
      return;
    }
    setConnectingXverse(true);
    try {
      const connection = await connectXverse();
      const wallet = await saveStacksWalletMutation.mutateAsync({
        address: connection.address,
        network: connection.network,
        label: "Xverse",
      });
      await recordXverseConnectionMutation.mutateAsync({
        walletId: wallet.id,
        publicKey: connection.publicKey,
        walletType: connection.walletType,
        idempotencyKey: `xverse-connect-${wallet.id}-${connection.network}`,
      });
      setXversePermissionGranted(true);
      toast.success("Xverse conectada", {
        description: "Endereço público Stacks salvo sem custodiar sua chave.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "A conexão Xverse foi cancelada."
      );
    } finally {
      setConnectingXverse(false);
    }
  }

  async function requestCustomerXversePermission() {
    if (!isAuthenticated) {
      setLoginOpen(true);
      return;
    }
    setPermissionLoading(true);
    try {
      await requestXverseReadPermission();
      setXversePermissionGranted(true);
      toast.success("Permissão de leitura confirmada", {
        description: "A RendeBit pode ler sua referência pública, sem tocar nas suas chaves.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A autorização foi cancelada.");
    } finally {
      setPermissionLoading(false);
    }
  }

  async function signCustomerXverseAction(action: {
    id: number;
    actionType: "withdrawal" | "swap" | "yield";
    unsignedTransaction: string;
  }) {
    try {
      const signed = await signStacksTransaction(action.unsignedTransaction, false);
      await recordXverseSignatureMutation.mutateAsync({
        actionId: action.id,
        signedTransaction: signed.transaction,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir sua confirmação.");
      throw error;
    }
  }

  function openNotification(notification: AppNotificationView) {
    if (!notification.readAt) {
      markNotificationReadMutation.mutate({ notificationId: notification.id });
    }
    setNotificationsOpen(false);
    setFocusNotificationActionId(notification.relatedXverseActionId);
    if (notification.actionView === "reservas") {
      navigate("reservas");
    }
  }

  async function revokeCustomerXversePermission() {
    setPermissionLoading(true);
    try {
      await revokeXversePermissions();
      setXversePermissionGranted(false);
      toast.success("Autorização encerrada", {
        description: "A Xverse deixou de compartilhar a referência com a RendeBit.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar a autorização.");
    } finally {
      setPermissionLoading(false);
    }
  }
  const createRedemptionQuoteMutation = trpc.redemptions.createQuote.useMutation();
  const confirmRedemptionMutation = trpc.redemptions.confirm.useMutation();

  useEffect(() => {
    const deposits = pixDepositsQuery.data?.deposits;
    if (!isAuthenticated) {
      pixStatusRef.current = {};
      simulatedPixIdsRef.current.clear();
      return;
    }
    if (!deposits) return;
    const previous = pixStatusRef.current;
    deposits.forEach(item => {
      if (previous[item.id] === "awaiting_payment" && item.status === "paid" && !simulatedPixIdsRef.current.has(item.id)) {
        toast.success("Pix confirmado pelo webhook", { description: `${currency.format(Number(item.amountBrl))} foi conciliado e já está disponível no seu saldo em reais.` });
      }
      if (item.status === "paid") simulatedPixIdsRef.current.delete(item.id);
    });
    pixStatusRef.current = Object.fromEntries(deposits.map(item => [item.id, item.status]));
  }, [isAuthenticated, pixDepositsQuery.data?.deposits]);

  useEffect(() => {
    const purchases = purchasesQuery.data;
    if (!isAuthenticated) {
      purchaseStatusRef.current = {};
      return;
    }
    if (!purchases) return;
    const previous = purchaseStatusRef.current;
    purchases.forEach(item => {
      if (previous[item.id] === "pending" && item.paymentStatus === "approved") {
        toast.success("Pagamento confirmado pelo webhook", { description: "Seu aporte foi validado pelo provedor e seguirá para conciliação." });
      }
    });
    purchaseStatusRef.current = Object.fromEntries(purchases.map(item => [item.id, item.paymentStatus]));
  }, [isAuthenticated, purchasesQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get("auth");
    const provider = params.get("provider");
    if (!authResult) return;

    if (authResult === "success") {
      toast.success("Pronto, sua conta está conectada", {
        description: provider === "apple"
          ? "Você entrou com seu Apple ID. Bem-vindo à RendeBit!"
          : "Você entrou com Google/Gmail. Bem-vindo à RendeBit!",
      });
    } else if (authResult === "provider-mismatch") {
      toast.error("O acesso escolhido foi diferente", {
        description: `Tente novamente e, no portal seguro, escolha ${provider === "apple" ? "Apple" : "Google"}.`,
      });
      setLoginOpen(true);
    } else if (authResult === "provider-unsupported") {
      toast.error("Use Google ou Apple para entrar", {
        description: "Esses são os dois métodos aceitos pela RendeBit neste momento.",
      });
      setLoginOpen(true);
    } else {
      toast.error("Não conseguimos concluir seu acesso", {
        description: "Nada foi alterado. Você pode tentar novamente com calma.",
      });
      setLoginOpen(true);
    }

    params.delete("auth");
    params.delete("provider");
    const cleanQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
  }, []);

  useEffect(() => {
    const livePurchases = purchasesQuery.data;
    if (!livePurchases) return;
    setPurchases(livePurchases.map(item => {
      const invested = Number(item.amountBrl);
      const currentValue = Number(item.btcAmount) * liveBtcBrl;
      const completed = item.status === "settled";
      const status = item.yieldStatus === "active"
        ? "Rendimento ativo"
        : item.paymentStatus === "pending"
          ? "Aguardando pagamento"
          : item.paymentStatus === "rejected"
            ? "Pagamento não aprovado"
            : item.status === "processing"
              ? "Pagamento aprovado · processando"
              : item.status;
      return {
        id: String(item.id),
        date: new Date(item.createdAt).toLocaleDateString("pt-BR"),
        invested,
        btc: Number(item.btcAmount),
        quote: Number(item.executionBtcBrl),
        currentValue,
        gain: currentValue - invested,
        status,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        checkoutUrl: item.checkoutUrl,
        completed,
      };
    }));
  }, [purchasesQuery.data, liveBtcBrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentReturn = params.get("payment");
    const purchaseId = params.get("purchase");
    if (!paymentReturn || !purchaseId) return;

    navigate("lotes");
    void utils.purchases.list.invalidate();
    if (paymentReturn === "success") {
      toast.success("Pagamento enviado para conciliação", { description: "A compra de Bitcoin só começa após a confirmação assinada do Mercado Pago." });
    } else if (paymentReturn === "pending") {
      toast.info("Pagamento em análise", { description: "Você pode acompanhar o status em Meus aportes." });
    } else {
      toast.error("Pagamento não concluído", { description: "Nenhum Bitcoin foi comprado e nenhum rendimento foi ativado." });
    }

    params.delete("payment");
    params.delete("purchase");
    const cleanQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
  }, []);

  useEffect(() => {
    if (!addMoneyOpen || purchaseStep !== "quote" || quoteSeconds <= 0) return;
    const timer = window.setInterval(() => setQuoteSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [addMoneyOpen, purchaseStep, quoteSeconds]);

  useEffect(() => {
    if (!redeemOpen || redemptionStep !== "review" || redemptionQuoteSeconds <= 0) return;
    const timer = window.setInterval(() => setRedemptionQuoteSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [redeemOpen, redemptionStep, redemptionQuoteSeconds]);

  function navigate(next: SectionId) {
    setSection(next);
    setMobileOpen(false);
    window.history.replaceState(null, "", next === "inicio" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requestLogin() {
    setLoginOpen(true);
  }

  async function signOut() {
    try {
      await logout();
      setLoginOpen(false);
      toast.success("Você saiu da sua conta", {
        description: "Quando quiser voltar, é só entrar novamente com Google ou Apple.",
      });
    } catch {
      toast.error("Não conseguimos encerrar a sessão agora", {
        description: "Tente de novo em instantes.",
      });
    }
  }

  async function createPixDeposit() {
    if (!isAuthenticated) { requestLogin(); return; }
    if (profileQuery.data?.verificationStatus !== "verified") {
      setOnboardingIntent("deposit");
      setPurchaseStep("eligibility");
      setEligibility({ resident: false, cpf: false, pix: false });
      setAddMoneyOpen(true);
      return;
    }
    try {
      const deposit = await createPixDepositMutation.mutateAsync({ amountBrl: parseBrl(pixDepositAmount), idempotencyKey: `pix-deposit-${crypto.randomUUID()}` });
      await pixDepositsQuery.refetch();
      toast.success("QR Code Pix gerado", { description: `${currency.format(Number(deposit.amountBrl))} aguardando pagamento no sandbox.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a cobrança Pix.");
    }
  }

  async function settlePixDeposit(depositId: number) {
    simulatedPixIdsRef.current.add(depositId);
    try {
      const deposit = await settlePixDepositMutation.mutateAsync({ depositId, idempotencyKey: `pix-payment-${depositId}-${crypto.randomUUID()}` });
      await Promise.all([
        utils.pixDeposits.summary.invalidate(),
        utils.purchases.ledger.invalidate(),
        user?.role === "admin" ? utils.treasury.ledger.invalidate() : Promise.resolve(),
      ]);
      toast.success("Depósito Pix confirmado no sandbox", { description: `${currency.format(Number(deposit.amountBrl))} agora aparece no saldo em reais.` });
    } catch (error) {
      simulatedPixIdsRef.current.delete(depositId);
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o depósito Pix.");
    }
  }

  async function prepareRedemption() {
    if (!isAuthenticated) {
      toast.info("Entre na sua conta para solicitar um resgate no sandbox.");
      requestLogin();
      return;
    }
    const btcAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(btcAmount) || btcAmount <= 0) {
      toast.error("Informe uma quantidade de Bitcoin maior que zero.");
      return;
    }
    try {
      const quote = await createRedemptionQuoteMutation.mutateAsync({ btcAmount, idempotencyKey: `redemption-quote-${crypto.randomUUID()}` });
      setRedemptionQuote(quote);
      setRedemptionQuoteSeconds(Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
      setRedemptionRiskAccepted(false);
      setCompletedRedemption(null);
      setRedemptionStep("review");
      setRedeemOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a cotação de resgate.");
    }
  }

  async function confirmRedemption() {
    if (!redemptionQuote || !redemptionRiskAccepted || redemptionQuoteSeconds <= 0) return;
    try {
      const result = await confirmRedemptionMutation.mutateAsync({
        quoteId: redemptionQuote.id,
        idempotencyKey: `redemption-${crypto.randomUUID()}`,
        riskAccepted: true,
      });
      await Promise.all([
        utils.redemptions.summary.invalidate(),
        utils.purchases.ledger.invalidate(),
        user?.role === "admin" ? utils.treasury.ledger.invalidate() : Promise.resolve(),
      ]);
      setCompletedRedemption({ pixEndToEndId: result.pixEndToEndId, netBrl: result.netBrl });
      setRedemptionStep("success");
      toast.success("Resgate sandbox concluído", { description: "A trilha completa foi persistida sem enviar um Pix real." });
    } catch (error) {
      await utils.redemptions.summary.invalidate();
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o resgate sandbox.");
    }
  }

  function openPurchase() {
    if (!isAuthenticated) {
      toast.info("Entre na sua conta para registrar compras no sandbox.");
      requestLogin();
      return;
    }
    setOnboardingIntent("purchase");
    setPurchaseStep("eligibility");
    setQuoteSeconds(59);
    setEligibility({ resident: false, cpf: false, pix: false });
    setRiskAccepted(false);
    setServerQuote(null);
    setAddMoneyOpen(true);
  }

  function refreshQuote() {
    setQuoteNonce((value) => value + 1);
    setQuoteSeconds(59);
    setServerQuote(null);
    toast.success("Cotação atualizada", { description: "Novo prazo de 59 segundos iniciado." });
  }

  async function continueToQuote() {
    if (!isEligible) return;
    try {
      await saveProfileMutation.mutateAsync({
        legalName,
        cpfMasked,
        pixBank: pixAccount.split(" •")[0] || "Banco informado",
        pixAccountMasked: pixAccount,
        residentBrazil: true,
        cpfConfirmed: true,
        pixOwnershipConfirmed: true,
      });
      if (profileQuery.data?.verificationStatus !== "verified") {
        await verifyKycMutation.mutateAsync({ idempotencyKey: `kyc-${user?.id}-${crypto.randomUUID()}` });
      }
      if (onboardingIntent === "deposit") {
        const deposit = await createPixDepositMutation.mutateAsync({ amountBrl: parseBrl(pixDepositAmount), idempotencyKey: `pix-deposit-${crypto.randomUUID()}` });
        await Promise.all([utils.onboarding.get.invalidate(), utils.pixDeposits.summary.invalidate()]);
        setAddMoneyOpen(false);
        navigate("depositar");
        toast.success("Conta verificada e QR Code gerado", { description: `${currency.format(Number(deposit.amountBrl))} aguardando pagamento no sandbox.` });
        return;
      }
      const quote = await createQuoteMutation.mutateAsync({ amountBrl: parseBrl(addAmount), idempotencyKey: `quote-${crypto.randomUUID()}` });
      setServerQuote(quote);
      setPurchaseStep("quote");
      setQuoteSeconds(Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
      await utils.onboarding.get.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar a cotação.");
    }
  }

  async function regenerateServerQuote() {
    try {
      const quote = await createQuoteMutation.mutateAsync({ amountBrl: parseBrl(addAmount), idempotencyKey: `quote-${crypto.randomUUID()}` });
      setServerQuote(quote);
      setQuoteSeconds(Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar cotação.");
    }
  }

  async function confirmPurchase() {
    if (!serverQuote) return;
    try {
      const result = await confirmPurchaseMutation.mutateAsync({ quoteId: serverQuote.id, idempotencyKey: `purchase-${crypto.randomUUID()}`, paymentMethod });
      await Promise.all([utils.purchases.list.invalidate(), utils.purchases.ledger.invalidate()]);
      if (result.checkoutUrl) {
        toast.info("Abrindo o checkout seguro do Mercado Pago", { description: "Escolha Pix ou cartão no ambiente do parceiro." });
        window.location.assign(result.checkoutUrl);
        return;
      }
      setPurchaseStep("success");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar a compra sandbox.");
    }
  }

  return (
    <div className="btcbr-app">
      <header className="br-mobile-header">
        <button className="br-mobile-menu" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Abrir menu">{mobileOpen ? <X /> : <Menu />}</button>
        <div className="br-brand"><div className="br-brand-mark"><Bitcoin /></div><div><b>RENDEBIT</b><small>BITCOIN EM REAIS</small></div></div>
        <button className="br-avatar" type="button" onClick={requestLogin} aria-label={isAuthenticated ? "Abrir dados da conta" : "Entrar na conta"}>{user?.name?.slice(0, 2).toUpperCase() || "AB"}</button>
      </header>
      <aside className={`br-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="br-brand"><div className="br-brand-mark"><Bitcoin /></div><div><b>RENDEBIT</b><small>BITCOIN EM REAIS</small></div></div>
        <button className="br-profile" type="button" onClick={requestLogin}><div className="br-avatar">{user?.name?.slice(0, 2).toUpperCase() || "AB"}</div><div><b>Olá, {user?.name?.split(" ")[0] || "Alexandre"}</b><span>{isAuthenticated ? loginProviderLabel : "Modo de leitura"} <BadgeCheck size={13} /></span></div><ChevronDown size={16} /></button>
        <nav>{navItems.map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} key={id} onClick={() => navigate(id)} type="button"><Icon size={19} /><span>{label}</span>{id === "empresas" && <em>B2B</em>}</button>)}</nav>
        <div className="br-sidebar-security"><ShieldCheck /><div><b>Feita para brasileiros</b><span>CPF, Pix, BRL e atendimento em português.</span></div></div>
        <div className="br-sidebar-footer"><button type="button" onClick={() => toast.success("Pode contar com a gente", { description: "O atendimento em português será conectado na próxima etapa." })}>Fale com a gente</button>{user?.role === "admin" && <button type="button" onClick={() => { window.location.href = "/operacao"; }}>Operação</button>}<span>v0.3 Brasil · sandbox</span></div>
      </aside>

      <main className="br-main">
        <div className="br-topbar"><div><span>CONTA PESSOAL</span><b>{activeLabel}</b></div><div className="br-top-actions"><DemoPill />{isAuthenticated && <NotificationCenter open={notificationsOpen} onOpenChange={setNotificationsOpen} notifications={(notificationsQuery.data?.notifications ?? []) as AppNotificationView[]} unreadCount={notificationsQuery.data?.unreadCount ?? 0} onMarkRead={notificationId => markNotificationReadMutation.mutate({ notificationId })} onMarkAllRead={() => markAllNotificationsReadMutation.mutate()} onAction={openNotification} />}<button className="br-account-button" type="button" onClick={requestLogin}><span className="br-account-status"><i /></span> {authLoading ? "Carregando…" : isAuthenticated ? loginProviderLabel : "Entrar"} <ChevronDown size={14} /></button></div></div>
        <div className="br-content">
          {section === "inicio" && <div className="br-stack"><section className="br-welcome"><div><span className="br-eyebrow">BITCOIN DO JEITO BRASILEIRO</span><h1>Acumule BTC.<br /><em>Receba rendimento nativo em BTC.</em></h1><p>Uma experiência feita exclusivamente para residentes no Brasil. Comece com Pix ou cartão, acompanhe o valor em reais e veja seu rendimento nativo em BTC. Quando quiser, peça o resgate via Pix. As estratégias elegíveis podem chegar a <b>até 6% a.a. em BTC</b>, conforme a estratégia, a liquidez e as condições de mercado.</p></div><div className="br-trust-row"><span><BadgeCheck /> Exclusiva para residentes no Brasil</span><span><ShieldCheck /> Seu dinheiro separado</span><span><Sparkles /> Simples e em português</span></div></section><BrazilFirstStrip /><BtcBrlQuoteCard quote={marketQuoteQuery.data} loading={marketQuoteQuery.isLoading} refreshing={marketQuoteQuery.isFetching} onRefresh={() => void marketQuoteQuery.refetch()} /><YieldSummary onRedeem={() => navigate("resgate")} onDeposit={() => navigate("depositar")} onAddMoney={openPurchase} onSimulate={() => navigate("simulador")} btcPriceBrl={liveBtcBrl} quoteSource={marketQuoteQuery.data?.source ?? "Referência temporária"} quoteTime={marketQuoteTime} quoteStale={marketQuoteQuery.data?.stale ?? true} pendingPixDeposit={pendingPixDeposit} /><InnovationGrid setSection={navigate} /><section className="br-panel br-how-card"><div><span className="br-eyebrow">SIMPLES POR FORA. BITCOIN POR DENTRO.</span><h2>Você cuida da sua vida. A RendeBit simplifica o caminho.</h2></div><div className="br-steps"><div><span>01</span><WalletCards /><h3>Comece em reais</h3><p>Use Pix ou cartão, como você já faz no dia a dia.</p></div><ArrowRight /><div><span>02</span><TrendingUp /><h3>Acompanhe com clareza</h3><p>Veja seu Bitcoin, o rendimento nativo em BTC e o valor equivalente em BRL.</p></div><ArrowRight /><div><span>03</span><QrCode /><h3>Receba via Pix</h3><p>Confira o valor líquido e mande para sua conta verificada.</p></div></div></section></div>}
          {section === "depositar" && <PixDepositPage deposits={(pixDepositsQuery.data?.deposits ?? []) as PixDepositRecord[]} availableBrl={pixDepositsQuery.data?.availableBrl ?? 0} amount={pixDepositAmount} setAmount={setPixDepositAmount} authenticated={isAuthenticated} loading={createPixDepositMutation.isPending || settlePixDepositMutation.isPending || pixDepositsQuery.isLoading} onCreate={() => void createPixDeposit()} onPay={depositId => void settlePixDeposit(depositId)} onLogin={requestLogin} />}
          {section === "rendimento" && <YieldPage btcPriceBrl={liveBtcBrl} />}
          {section === "mercado" && <Suspense fallback={<section className="br-panel btc-chart-loading"><RefreshCw className="spinning" /><b>Abrindo o mercado para você…</b></section>}><BtcMarketChart /></Suspense>}
          {section === "simulador" && <FutureCalculator />}
          {section === "lotes" && <LotsPage purchases={purchases} />}
          {section === "resgate" && <RedeemPage amount={amount} setAmount={value => { setAmount(value); setRedemptionQuote(null); }} availableBtc={isAuthenticated ? redemptionsQuery.data?.availableBtc ?? 0 : 0.284215} pixDestination={profileQuery.data?.pixAccountMasked ?? ""} quote={redemptionQuote} quoteSeconds={redemptionQuoteSeconds} redemptions={redemptionsQuery.data?.redemptions ?? []} authenticated={isAuthenticated} loading={createRedemptionQuoteMutation.isPending || redemptionsQuery.isLoading} btcPriceBrl={liveBtcBrl} onQuote={() => void prepareRedemption()} />}
          {section === "fiscal" && <FiscalPage />}
          {section === "reservas" && <ReservesPage wallets={walletsQuery.data ?? []} settlements={walletSettlementsQuery.data ?? []} xverseActions={xverseActionsQuery.data ?? []} authenticated={isAuthenticated} saving={saveStacksWalletMutation.isPending} connectingXverse={connectingXverse} xversePermissionGranted={xversePermissionGranted} permissionLoading={permissionLoading} onSaveWallet={input => saveStacksWalletMutation.mutate(input)} onConnectXverse={() => void connectCustomerXverse()} onRequestPermission={() => void requestCustomerXversePermission()} onRevokePermission={() => void revokeCustomerXversePermission()} onSignAction={signCustomerXverseAction} focusActionId={focusNotificationActionId} onFocusActionConsumed={() => setFocusNotificationActionId(null)} onLogin={requestLogin} />}
          {section === "empresas" && <BusinessPage />}
          {section === "ajuda" && <HelpPage onNavigate={navigate} />}
        </div>
        <RendeBitFooter onNavigate={navigate} />
      </main>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="br-confirm-dialog br-login-dialog">
          {isAuthenticated ? <>
            <div className="br-login-shield"><UserRound /></div>
            <DialogHeader><DialogTitle>Sua conta RendeBit</DialogTitle><DialogDescription>Está tudo certo por aqui. Confira como você entrou e os dados básicos vinculados à sua sessão.</DialogDescription></DialogHeader>
            <div className="br-account-detail">
              <div className={`br-provider-mark ${user?.loginMethod === "apple" ? "apple" : "google"}`}>{user?.loginMethod === "apple" ? "A" : "G"}</div>
              <div><span>Conectada com</span><b>{loginProviderLabel}</b><small>{user?.email || "E-mail protegido pelo provedor"}</small></div>
              <BadgeCheck />
            </div>
            <div className="br-session-detail"><LockKeyhole size={15} /><span>Sessão protegida por cookie seguro e renovada somente após uma nova entrada.</span></div>
            <button className="br-signout-button" type="button" onClick={() => void signOut()} disabled={authLoading}><LogOut size={16} /> {authLoading ? "Saindo…" : "Sair desta conta"}</button>
          </> : <>
            <div className="br-login-shield"><LockKeyhole /></div>
            <DialogHeader><DialogTitle>Que bom ter você por aqui</DialogTitle><DialogDescription>Escolha Google/Gmail ou Apple ID. Na próxima tela, confirme a mesma opção no portal seguro.</DialogDescription></DialogHeader>
            <div className="br-social-login">
              <button type="button" onClick={() => { setLoginOpen(false); startLogin("google"); }}><span className="br-google-mark">G</span><b>Entrar com Google</b><small>Gmail ou Google Workspace</small><ArrowRight size={16} /></button>
              <button type="button" onClick={() => { setLoginOpen(false); startLogin("apple"); }}><span className="br-apple-mark">A</span><b>Entrar com Apple ID</b><small>Use “Continuar com Apple” no portal</small><ArrowRight size={16} /></button>
            </div>
            <div className="br-login-note"><ShieldCheck size={15} /><span>A RendeBit não recebe nem guarda sua senha. O acesso acontece no portal oficial e voltamos apenas com nome, e-mail autorizado e identificador da conta.</span></div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={redeemOpen} onOpenChange={open => { setRedeemOpen(open); if (!open && redemptionStep === "success") { setRedemptionQuote(null); setRedemptionQuoteSeconds(0); setCompletedRedemption(null); } }}>
        <DialogContent className="br-confirm-dialog br-redemption-dialog">
          {redemptionStep === "review" && redemptionQuote && <>
            <div className="br-redemption-progress"><span className="done"><i><Check size={11} /></i> Saldo reservado</span><b /><span className="active"><i>2</i> Sua confirmação</span><b /><span><i>3</i> Pix sandbox</span></div>
            <DialogHeader><DialogTitle>Revise seu resgate via Pix</DialogTitle><DialogDescription>A cotação e a conta de destino foram verificadas. Nenhum ativo ou Pix real será movimentado neste ambiente.</DialogDescription></DialogHeader>
            <div className="br-confirm-summary"><div><span>Quantidade reservada</span><b>₿ {redemptionQuote.btcAmount}</b></div><div><span>Conta Pix verificada</span><b>{redemptionQuote.pixDestinationMasked}</b></div><div><span>Valor bruto</span><b>{currency.format(Number(redemptionQuote.grossBrl))}</b></div><div><span>Taxas totais</span><b>− {currency.format(Number(redemptionQuote.protocolFeeBrl) + Number(redemptionQuote.conversionPixFeeBrl))}</b></div><div className="total"><span>Valor líquido no Pix</span><b>{currency.format(Number(redemptionQuote.netBrl))}</b></div></div>
            <div className={`br-quote-expiry ${redemptionQuoteSeconds === 0 ? "expired" : ""}`}><RefreshCw size={15} /><span>{redemptionQuoteSeconds > 0 ? `Cotação válida por ${redemptionQuoteSeconds} segundos` : "Esta cotação expirou. Gere uma nova para continuar."}</span></div>
            <label className="br-risk-check"><input type="checkbox" checked={redemptionRiskAccepted} onChange={event => setRedemptionRiskAccepted(event.target.checked)} /><span>Confirmo a conta Pix de destino e entendo que preço, liquidez e prazo podem variar em uma operação real.</span></label>
            {redemptionQuoteSeconds === 0 ? <button className="br-outline full" type="button" onClick={() => void prepareRedemption()} disabled={createRedemptionQuoteMutation.isPending}><RefreshCw className={createRedemptionQuoteMutation.isPending ? "animate-spin" : ""} size={15} /> Gerar nova cotação</button> : <button className="br-primary full" type="button" onClick={() => void confirmRedemption()} disabled={!redemptionRiskAccepted || confirmRedemptionMutation.isPending}>{confirmRedemptionMutation.isPending ? <RefreshCw className="animate-spin" size={17} /> : <Check size={17} />} Confirmar resgate sandbox</button>}
            <button className="br-dialog-cancel" type="button" onClick={() => setRedeemOpen(false)}>Voltar sem confirmar</button>
          </>}
          {redemptionStep === "success" && completedRedemption && <div className="br-purchase-success"><div className="br-success-icon"><CircleCheckBig /></div><span className="br-eyebrow">RESGATE CONCLUÍDO NO SANDBOX</span><h2>Seu Pix foi simulado.</h2><p>A saída do rendimento, a conversão e o Pix foram registrados com referências independentes e chaves idempotentes.</p><div className="br-success-values"><div><span>Valor líquido</span><b>{currency.format(Number(completedRedemption.netBrl))}</b></div><div><span>Destino</span><b>{redemptionQuote?.pixDestinationMasked}</b></div><div><span>Referência Pix</span><b className="gain">{completedRedemption.pixEndToEndId || "Simulada"}</b></div></div><button className="br-primary full" type="button" onClick={() => { setRedeemOpen(false); setRedemptionQuote(null); setRedemptionQuoteSeconds(0); setCompletedRedemption(null); navigate("resgate"); }}>Ver histórico de resgates <ArrowRight size={17} /></button><button className="br-dialog-cancel" type="button" onClick={() => { setRedeemOpen(false); setRedemptionQuote(null); setRedemptionQuoteSeconds(0); setCompletedRedemption(null); }}>Voltar para a conta</button></div>}
        </DialogContent>
      </Dialog>
      <Dialog open={addMoneyOpen} onOpenChange={setAddMoneyOpen}>
        <DialogContent className="br-confirm-dialog br-add-money-dialog">
          <div className="br-purchase-progress" aria-label={`Etapa ${purchaseStep === "eligibility" ? 1 : purchaseStep === "quote" ? 2 : 3} de 3`}><span className={purchaseStep !== "success" ? "active" : "done"}><i>{purchaseStep === "success" ? <Check size={11} /> : "1"}</i> Cadastro</span><b /><span className={purchaseStep === "quote" ? "active" : purchaseStep === "success" ? "done" : ""}><i>{purchaseStep === "success" ? <Check size={11} /> : "2"}</i> Cotação</span><b /><span className={purchaseStep === "success" ? "active" : ""}><i>3</i> Conclusão</span></div>

          {purchaseStep === "eligibility" && <>
            <DialogHeader><DialogTitle>{onboardingIntent === "deposit" ? "Vamos preparar seu Pix" : "Vamos preparar sua compra"}</DialogTitle><DialogDescription>{onboardingIntent === "deposit" ? "É rapidinho: confirme que você mora no Brasil, seu CPF e a conta Pix no seu nome." : "É rapidinho: confirme seus dados brasileiros para comprar Bitcoin com reais."} Tudo aqui ainda é demonstrativo.</DialogDescription></DialogHeader>
            <div className="br-eligibility-grid"><label><span>Nome completo</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label><label><span>CPF mascarado</span><input value={cpfMasked} onChange={(event) => setCpfMasked(event.target.value)} /></label><label><span>Residência</span><select defaultValue="BR"><option value="BR">Brasil</option></select></label><label><span>Conta Pix mascarada</span><input value={pixAccount} onChange={(event) => setPixAccount(event.target.value)} /></label></div>
            <div className="br-check-stack"><label><input type="checkbox" checked={eligibility.resident} onChange={(event) => setEligibility((value) => ({ ...value, resident: event.target.checked }))} /><span><b>Moro no Brasil</b><small>A RendeBit será oferecida exclusivamente a residentes no país.</small></span></label><label><input type="checkbox" checked={eligibility.cpf} onChange={(event) => setEligibility((value) => ({ ...value, cpf: event.target.checked }))} /><span><b>Tenho CPF regular</b><small>Vamos confirmar sua identidade antes de movimentar valores reais.</small></span></label><label><input type="checkbox" checked={eligibility.pix} onChange={(event) => setEligibility((value) => ({ ...value, pix: event.target.checked }))} /><span><b>A conta Pix está no meu nome</b><small>Para sua segurança, entradas e saídas usam a mesma titularidade.</small></span></label></div>
            <button className="br-primary full" type="button" disabled={!isEligible || saveProfileMutation.isPending || verifyKycMutation.isPending || createQuoteMutation.isPending || createPixDepositMutation.isPending} onClick={() => void continueToQuote()}>{saveProfileMutation.isPending || verifyKycMutation.isPending || createQuoteMutation.isPending || createPixDepositMutation.isPending ? <RefreshCw className="animate-spin" size={17} /> : <ArrowRight size={17} />} {onboardingIntent === "deposit" ? "Verificar e gerar QR Code" : "Verificar e gerar cotação"}</button>
            <p className="br-dialog-footnote"><ShieldCheck size={13} /> O sandbox persiste apenas dados mascarados e simula a aprovação do provedor KYC.</p>
          </>}

          {purchaseStep === "quote" && <>
            <DialogHeader><DialogTitle>Sua cotação para comprar Bitcoin</DialogTitle><DialogDescription>Veja preço, spread, taxa, prazo e quantidade antes de ativar o rendimento.</DialogDescription></DialogHeader>
            <label className="br-amount-label" htmlFor="add-money-amount">Quanto você quer investir?</label>
            <div className="br-amount-field"><span>R$</span><input id="add-money-amount" inputMode="decimal" value={addAmount} onChange={(event) => { setAddAmount(event.target.value); setQuoteSeconds(0); setServerQuote(null); }} aria-label="Valor da compra em reais" /></div>
            <div className="br-buy-chips"><button type="button" onClick={() => { setAddAmount("500,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 500</button><button type="button" onClick={() => { setAddAmount("1.000,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 1.000</button><button type="button" onClick={() => { setAddAmount("5.000,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 5.000</button></div>
            <section className="br-buy-quote"><div className="br-buy-quote-head"><span><i /> Cotação persistida</span><b className={quoteSeconds === 0 ? "expired" : ""}>{quoteSeconds === 0 ? "Atualize" : `00:${String(quoteSeconds).padStart(2, "0")}`}</b></div><div className="br-kv"><span>Referência BTC/BRL</span><b>{currency.format(serverQuote ? Number(serverQuote.referenceBtcBrl) : liveBtcBrl)}</b></div><div className="br-kv"><span>Preço de execução (spread 0,65%)</span><b>{currency.format(purchaseQuote.executionPrice)}</b></div><div className="br-kv"><span>Taxa de serviço (0,50%)</span><b>-{currency.format(purchaseQuote.serviceFee)}</b></div><div className="br-kv"><span>Valor aplicado</span><b>{currency.format(purchaseQuote.applied)}</b></div><div className="br-buy-total"><span>Você compra aproximadamente</span><strong>₿ {formatBtc(purchaseQuote.btc)}</strong><small>Estratégias elegíveis: até 6% a.a. em BTC</small></div></section>
            <div className="br-payment-methods" role="radiogroup" aria-label="Forma de pagamento"><button className={paymentMethod === "pix" ? "active" : ""} type="button" role="radio" aria-checked={paymentMethod === "pix"} onClick={() => setPaymentMethod("pix")}><Banknote /><span><b>Pix</b><small>Pagamento à vista</small></span><i /></button><button className={paymentMethod === "credit_card" ? "active" : ""} type="button" role="radio" aria-checked={paymentMethod === "credit_card"} onClick={() => setPaymentMethod("credit_card")}><CreditCard /><span><b>Cartão de crédito</b><small>Processado pelo Mercado Pago</small></span><i /></button></div>
            <div className="br-mercado-pago-note"><ShieldCheck size={16} /><span>O Mercado Pago processa o pagamento em BRL. Depois da aprovação, a liquidez BTCBRL é tratada separadamente na conta institucional e a trilha Stacks só continua após os controles de rede, carteira pública e contrato. Dados do cartão não passam pelo backend da RendeBit.</span></div>
            {(!serverQuote || quoteSeconds === 0) && <button className="br-outline full" type="button" onClick={() => void regenerateServerQuote()} disabled={createQuoteMutation.isPending}><RefreshCw className={createQuoteMutation.isPending ? "animate-spin" : ""} size={15} /> Atualizar cotação</button>}
            <label className="br-risk-check"><input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /><span>Entendi que o preço do Bitcoin varia e que o rendimento de até 6% a.a. é uma estimativa variável, não uma promessa ou garantia.</span></label>
            <details className="br-how-it-works"><summary>Como funciona por trás?</summary><p>A conta institucional usa uma fonte de liquidez BTCBRL separada. Depois, o sistema registra a carteira pública Stacks do cliente e só executa as etapas técnicas de sBTC e stBTC após os preflights de rede, contrato, saldo, assinatura e reconciliação. Isso envolve riscos de mercado, protocolo, liquidez e contraparte. Os registros verificáveis ficam em Segurança.</p></details>
            <button className="br-primary full" type="button" disabled={!riskAccepted || !serverQuote || quoteSeconds === 0 || confirmPurchaseMutation.isPending} onClick={() => void confirmPurchase()}>{confirmPurchaseMutation.isPending ? <RefreshCw className="animate-spin" size={17} /> : <ArrowRight size={17} />} {paymentMethod === "pix" ? "Continuar com Pix" : "Continuar com cartão"}</button>
            <button className="br-dialog-cancel" type="button" onClick={() => setPurchaseStep("eligibility")}>Voltar</button>
          </>}

          {purchaseStep === "success" && <div className="br-purchase-success"><div className="br-success-icon"><CircleCheckBig /></div><span className="br-eyebrow">SIMULAÇÃO CONCLUÍDA</span><h2>Bitcoin comprado. Rendimento nativo em BTC ativado.</h2><p>Sua compra demonstrativa foi registrada e já aparece em Meus aportes.</p><div className="br-success-values"><div><span>Investido</span><b>{currency.format(purchaseQuote.amountInBrl)}</b></div><div><span>Bitcoin comprado</span><b>₿ {formatBtc(purchaseQuote.btc)}</b></div><div><span>Status</span><b className="gain">Rendimento nativo em BTC ativo</b></div></div><button className="br-primary full" type="button" onClick={() => { setAddMoneyOpen(false); navigate("lotes"); }}>Ver meus aportes <ArrowRight size={17} /></button><button className="br-dialog-cancel" type="button" onClick={() => setAddMoneyOpen(false)}>Voltar para o início</button></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HelpPage({ onNavigate }: { onNavigate: (section: SectionId) => void }) {
  const faqs = [
    {
      category: "Primeiros passos",
      question: "Quem pode usar a RendeBit?",
      answer: "A RendeBit foi pensada exclusivamente para pessoas que moram no Brasil. Para movimentar valores reais, será necessário ter CPF regular e uma conta Pix da mesma titularidade. Nesta fase, tudo funciona em ambiente demonstrativo.",
    },
    {
      category: "Rendimento",
      question: "Quanto o meu Bitcoin pode render?",
      answer: "O rendimento é nativo em BTC: estratégias elegíveis podem chegar a até 6% ao ano sobre a quantidade de Bitcoin aplicada. É uma estimativa variável, não garantida, e pode mudar conforme a estratégia, o protocolo e a liquidez. A variação do preço do BTC em reais é outro efeito e aparece separadamente.",
    },
    {
      category: "Rendimento",
      question: "Como funciona a calculadora de ganhos futuros?",
      answer: "Você escolhe um valor inicial, os aportes mensais, o prazo e um cenário para o preço do Bitcoin. A calculadora separa o dinheiro colocado, o rendimento nativo estimado em BTC e o efeito da cotação em reais. As premissas completas ficam disponíveis no fim da simulação.",
    },
    {
      category: "Primeiros passos",
      question: "De onde vem a cotação do Bitcoin em reais?",
      answer: "A RendeBit busca primeiro o preço spot público BTC/BRL na Binance e usa Coinbase ou CoinGecko como fontes de reserva se houver instabilidade. O painel mostra a origem e o horário da atualização. Se as fontes estiverem fora do ar, avisamos quando o valor exibido for apenas a última referência disponível.",
    },
    {
      category: "Mercado",
      question: "Como eu leio o gráfico do Bitcoin?",
      answer: "Escolha 24 horas, 7 dias, 30 dias, 90 dias, 1 ano, 10 anos ou Total. A porcentagem compara a primeira cotação com a última no período. Os cartões mostram também o menor e o maior preço. Passe o dedo ou o mouse sobre a linha para conferir um ponto específico.",
    },
    {
      category: "Mercado",
      question: "O gráfico mostra o rendimento da estratégia?",
      answer: "Não. Ele mostra somente quanto o preço do Bitcoin variou em reais. O rendimento nativo da estratégia, com potencial de até 6% ao ano em BTC conforme a estratégia escolhida, aparece separado para você não confundir BTC gerado pelo protocolo com alta ou queda do preço do BTC.",
    },
    {
      category: "Primeiros passos",
      question: "Posso entrar com Gmail ou Apple?",
      answer: "Sim. Escolha Google/Gmail ou Apple ID na RendeBit e confirme a mesma opção no portal seguro. A senha fica com o provedor: recebemos apenas nome, e-mail autorizado e um identificador da conta. A sessão dura até 30 dias e você pode sair quando quiser.",
    },
    {
      category: "Depósitos",
      question: "Como deposito reais via Pix?",
      answer: "Escolha Depositar via Pix, informe o valor e gere a cobrança. Você pode escanear o QR Code ou copiar o código. No sandbox, use o botão de simulação; em produção, o saldo só será creditado depois de um webhook assinado e da conciliação do parceiro Pix.",
    },
    {
      category: "Primeiros passos",
      question: "O que é a Conta RendeBit?",
      answer: "É uma conta simples para acompanhar uma posição em Bitcoin, entender quanto ela vale em reais e solicitar resgates via Pix. Você não precisa conhecer termos técnicos para começar.",
    },
    {
      category: "Primeiros passos",
      question: "Preciso entender de carteiras ou contratos?",
      answer: "Não para usar a experiência principal. A Conta RendeBit esconde a complexidade e mostra o que importa: seu saldo, seu ganho, os riscos e o valor líquido de um eventual resgate. A área Segurança permite consultar os detalhes quando você quiser.",
    },
    {
      category: "Primeiros passos",
      question: "Posso começar sem ter Bitcoin?",
      answer: "Sim. A proposta é permitir uma compra em reais (BRL) dentro da sua Conta RendeBit e, depois da cotação, ativar o acompanhamento do rendimento. Antes de uma operação real, você deverá ver preço, taxas, prazo, riscos e as informações de custódia.",
    },
    {
      category: "Segurança",
      question: "Meu dinheiro está seguro?",
      answer: "Segurança não significa ausência de risco. O plano do produto é manter o patrimônio dos clientes separado do dinheiro da operação, apresentar o lastro de forma verificável e usar parceiros especializados. Mesmo assim, o valor do Bitcoin pode subir ou cair, e a estrutura precisa ser validada antes de operar com dinheiro real.",
    },
    {
      category: "Segurança",
      question: "O meu dinheiro fica misturado com o dinheiro da empresa?",
      answer: "Não deveria. A proposta é usar custódia segregada: o patrimônio dos clientes fica separado das despesas e da liquidez operacional da empresa. No produto real, essa separação precisa estar documentada em contratos, controles e endereços verificáveis.",
    },
    {
      category: "Resgates",
      question: "Posso resgatar quando quiser?",
      answer: "Você pode solicitar um resgate quando quiser, mas a conclusão depende de liquidez, cotação, parceiro de conversão, rede e controles de segurança. Por isso, o produto não deve prometer Pix instantâneo em qualquer situação. Antes da confirmação, você verá o valor líquido estimado e as taxas.",
    },
    {
      category: "Resgates",
      question: "Quanto vou receber no Pix?",
      answer: "O valor depende da quantidade resgatada, do preço do Bitcoin no momento, das taxas do protocolo, da conversão e do parceiro de pagamento. A tela de resgate mostra o valor bruto, cada desconto e o valor líquido antes da confirmação.",
    },
    {
      category: "Rendimento",
      question: "Meu rendimento é garantido?",
      answer: "Não. O rendimento nativo em BTC é variável e pode mudar conforme o protocolo, a liquidez e as condições do mercado. Além disso, a valorização do Bitcoin em reais é diferente do BTC gerado pelo protocolo. Nunca use um cenário demonstrativo como promessa de resultado.",
    },
    {
      category: "Rendimento",
      question: "Vocês oferecem juros reais em BRL?",
      answer: "Não. O rendimento é nativo em BTC, não um juro creditado diretamente em BRL. O valor em reais serve para acompanhamento e, se você pedir um resgate, o BTC pode ser convertido para Pix com cotação e taxas mostradas antes da confirmação. É uma estimativa variável e não garantida.",
    },
    {
      category: "Rendimento",
      question: "Por que meu saldo pode cair mesmo com rendimento?",
      answer: "Porque o rendimento nativo é acumulado em BTC, enquanto o painel também mostra o preço do Bitcoin em reais. O protocolo pode gerar uma evolução positiva em BTC enquanto o Bitcoin perde valor em BRL. O painel separa esses efeitos para tornar a leitura mais honesta.",
    },
    {
      category: "Impostos",
      question: "A RendeBit faz minha declaração de imposto?",
      answer: "A proposta Premium gera um relatório auxiliar com posição, custo por aporte, resgates e taxas. Ele ajuda você e seu contador, mas não substitui orientação tributária nem garante a classificação fiscal correta.",
    },
    {
      category: "Impostos",
      question: "Por que vocês pedem meus dados?",
      answer: "Uma operação real pode exigir identificação, residência, conta de mesma titularidade e controles contra fraude e lavagem de dinheiro. O MVP usa dados demonstrativos e não realiza movimentações reais.",
    },
  ];
  const categories = ["Todas", ...Array.from(new Set(faqs.map((faq) => faq.category)))];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [open, setOpen] = useState<string | null>(faqs[2].question);
  const shortcuts = [
    { icon: Sparkles, title: "Quero começar", text: "Entenda conta, cadastro e sua primeira compra.", category: "Primeiros passos", question: "Posso começar sem ter Bitcoin?" },
    { icon: ShieldCheck, title: "Quero me sentir seguro", text: "Veja como pensamos em custódia e separação de patrimônio.", category: "Segurança", question: "Meu dinheiro está seguro?" },
    { icon: QrCode, title: "Quero receber via Pix", text: "Saiba quando pedir e quanto chega na sua conta.", category: "Resgates", question: "Posso resgatar quando quiser?" },
  ];
  const normalized = query.trim().toLowerCase();
  const filtered = faqs.filter((faq) => {
    const matchesCategory = category === "Todas" || faq.category === category;
    const matchesQuery = !normalized || `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase().includes(normalized);
    return matchesCategory && matchesQuery;
  });

  function openShortcut(item: (typeof shortcuts)[number]) {
    setQuery("");
    setCategory(item.category);
    setOpen(item.question);
  }

  return (
    <div className="br-stack">
      <section className="br-help-hero">
        <div className="br-help-hero-copy">
          <span className="br-eyebrow light">CENTRAL DE AJUDA</span>
          <h1>Chegou com uma dúvida? Vamos juntos.</h1>
          <p>Encontre respostas curtas, exemplos simples e caminhos diretos para resolver o que você precisa. Tudo em português e sem economês.</p>
          <label className="br-help-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite sua dúvida: Pix, rendimento, segurança…" aria-label="Buscar na central de ajuda" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>}</label>
        </div>
        <div className="br-help-orbit"><HelpCircle size={45} /><span>Conte com<br />a gente.</span></div>
      </section>
      <section className="br-help-shortcuts"><div className="br-help-shortcuts-head"><div><span className="br-eyebrow">ATALHOS PARA VOCÊ</span><h2>Por onde quer começar?</h2></div><button type="button" onClick={() => onNavigate("mercado")}>Ver gráfico do Bitcoin <ArrowRight size={15} /></button></div><div className="br-help-shortcut-grid">{shortcuts.map(({ icon: Icon, ...item }) => <button type="button" key={item.title} onClick={() => openShortcut({ icon: Icon, ...item })}><span><Icon size={20} /></span><div><b>{item.title}</b><small>{item.text}</small></div><ArrowRight size={16} /></button>)}</div></section>
      <div className="br-help-layout">
        <aside className="br-help-categories"><span className="br-eyebrow">ESCOLHA UM ASSUNTO</span>{categories.map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}<span>{item === "Todas" ? faqs.length : faqs.filter((faq) => faq.category === item).length}</span></button>)}</aside>
        <section className="br-help-list"><div className="br-help-list-head"><div><span className="br-eyebrow">RESPOSTAS DIRETAS</span><h2>{filtered.length} {filtered.length === 1 ? "resposta para você" : "respostas para você"}</h2></div><span className="br-help-honesty"><HelpCircle size={15} /> Explicado com clareza</span></div>{filtered.length === 0 ? <div className="br-panel br-help-empty"><HelpCircle /><h3>Ainda não achamos essa resposta.</h3><p>Tente usar palavras como Pix, segurança, rendimento ou impostos. Se preferir, fale com a gente.</p><button type="button" className="br-outline" onClick={() => { setQuery(""); setCategory("Todas"); }}>Ver todas as perguntas</button></div> : <div className="br-faq-stack">{filtered.map((faq) => { const isOpen = open === faq.question; return <article className={`br-faq ${isOpen ? "open" : ""}`} key={faq.question}><button type="button" className="br-faq-trigger" onClick={() => setOpen(isOpen ? null : faq.question)} aria-expanded={isOpen}><span><small>{faq.category}</small><b>{faq.question}</b></span><span className="br-faq-plus">{isOpen ? "−" : "+"}</span></button>{isOpen && <div className="br-faq-answer"><p>{faq.answer}</p>{faq.question === "Meu dinheiro está seguro?" && <button type="button" className="br-text-action" onClick={() => onNavigate("reservas")}>Ver como a segurança funciona <ArrowRight size={15} /></button>}{faq.question === "De onde vem a cotação do Bitcoin em reais?" && <button type="button" className="br-text-action" onClick={() => onNavigate("mercado")}>Abrir o gráfico do Bitcoin <ArrowRight size={15} /></button>}</div>}</article>; })}</div>}</section>
      </div>
      <section className="br-panel br-help-contact"><div className="br-help-contact-icon"><MessageCircleIcon /></div><div><span className="br-eyebrow">AINDA COM DÚVIDA?</span><h2>Fale com a gente, do seu jeito.</h2><p>Nosso atendimento será em português e sem pressa. A equipe pode explicar o produto, mas nunca vai prometer retorno nem pedir sua senha.</p></div><button className="br-primary" type="button" onClick={() => toast.success("Estamos por aqui!", { description: "O atendimento em português será conectado na próxima etapa." })}>Conversar com a equipe <ArrowRight size={16} /></button></section>
    </div>
  );
}

function MessageCircleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>;
}
