import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bitcoin,
  Building2,
  Check,
  CircleCheckBig,
  ChevronDown,
  CircleDollarSign,
  Copy,
  FileCheck2,
  FileText,
  Fingerprint,
  HelpCircle,
  Gauge,
  Home,
  Landmark,
  Layers3,
  LockKeyhole,
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
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SectionId = "inicio" | "rendimento" | "lotes" | "resgate" | "fiscal" | "reservas" | "empresas" | "ajuda";

type NavItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
};

type PurchaseStep = "eligibility" | "quote" | "success";

type PurchaseRecord = {
  id: string;
  date: string;
  invested: number;
  btc: number;
  quote: number;
  currentValue: number;
  gain: number;
  status: string;
};

const navItems: NavItem[] = [
  { id: "inicio", label: "Visão geral", icon: Home },
  { id: "rendimento", label: "Meu rendimento", icon: TrendingUp },
  { id: "lotes", label: "Meus aportes", icon: Layers3 },
  { id: "resgate", label: "Resgatar via Pix", icon: QrCode },
  { id: "fiscal", label: "Relatório fiscal", icon: FileText },
  { id: "reservas", label: "Segurança", icon: ShieldCheck },
  { id: "empresas", label: "Para empresas", icon: Building2 },
  { id: "ajuda", label: "Central de ajuda", icon: HelpCircle },
];

const wealthPoints = [
  { label: "10 jun", value: 115800 },
  { label: "24 jun", value: 116950 },
  { label: "08 jul", value: 116420 },
  { label: "22 jul", value: 118730 },
  { label: "05 ago", value: 120180 },
  { label: "19 ago", value: 119540 },
  { label: "02 set", value: 122314 },
];

const initialPurchases: PurchaseRecord[] = [];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const btcBrl = 421930;

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

function MiniChart() {
  const width = 760;
  const height = 238;
  const pad = 12;
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
            <stop offset="0" stopColor="#33e6b0" stopOpacity="0.28" />
            <stop offset="1" stopColor="#33e6b0" stopOpacity="0" />
          </linearGradient>
          <filter id="softGlow"><feGaussianBlur stdDeviation="5" result="blur" /></filter>
        </defs>
        {[0.18, 0.5, 0.82].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="#dce6e3" strokeDasharray="5 7" />
        ))}
        <path d={area} fill="url(#wealthArea)" />
        <path d={line} fill="none" stroke="#12c890" strokeWidth="9" opacity="0.12" filter="url(#softGlow)" />
        <path d={line} fill="none" stroke="#0aaa7e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 6 : 3.5} fill="#ffffff" stroke="#0aaa7e" strokeWidth="3" />
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
  return <span className="br-demo-pill"><Sparkles size={13} /> Ambiente demonstrativo</span>;
}

function YieldSummary({ onRedeem, onAddMoney }: { onRedeem: () => void; onAddMoney: () => void }) {
  return (
    <>
      <section className="br-hero-grid">
        <div className="br-balance-card">
          <div className="br-card-head">
            <div>
              <span className="br-eyebrow light">SEU SALDO EM BITCOIN</span>
              <div className="br-btc-value"><span>₿</span> 0,28421500</div>
              <p>Seu rendimento é acompanhado em reais (BRL)</p>
            </div>
            <div className="br-orbit"><Bitcoin size={28} /><i /><i /></div>
          </div>
          <div className="br-brl-badge"><Banknote size={15} /> Rendimento calculado e exibido em reais (BRL)</div>
          <div className="br-balance-brl">
            <div><small>Valor em reais hoje (BRL)</small><strong>R$ 122.314,00</strong></div>
            <span className="br-positive">+5,63%</span>
          </div>
          <div className="br-balance-actions">
            <button type="button" className="br-primary light" onClick={onAddMoney}>Comprar com reais <ArrowRight size={17} /></button>
            <button type="button" className="br-secondary light" onClick={onRedeem}>Resgatar via Pix</button>
          </div>
        </div>

        <div className="br-yield-card br-panel">
          <div className="br-card-headline"><span>Seu rendimento em reais (BRL)</span><span className="br-live"><i /> ATUALIZADO</span></div>
          <strong className="br-yield-number">+R$ 6.514,00</strong>
          <span className="br-yield-btc">+R$ 6.514,00 estimados no período</span>
          <div className="br-divider" />
          <div className="br-kv"><span>Parcela gerada pelo protocolo</span><b>+2,68%</b></div>
          <div className="br-kv"><span>Referência de conversão BTC/BRL</span><b>R$ 421.930,00</b></div>
          <div className="br-kv"><span>Desde o seu primeiro aporte</span><b>90 dias</b></div>
          <button type="button" className="br-text-action" onClick={() => toast.info("Aqui você verá o detalhamento do seu ganho, sem precisar entender a tecnologia por trás.")}>Como esse valor é calculado <ArrowRight size={15} /></button>
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
          <div><small>Valor inicial</small><b>R$ 115.800</b></div>
          <ArrowRight size={19} />
          <div><small>Valor atual</small><b>R$ 122.314</b></div>
          <span className="br-positive">+R$ 6.514</span>
        </div>
        <MiniChart />
        <div className="br-chart-note"><Fingerprint size={15} /> Simulação com quantidades atuais e taxas demonstrativas. Não representa rentabilidade garantida.</div>
      </section>
    </>
  );
}

function InnovationGrid({ setSection }: { setSection: (section: SectionId) => void }) {
  const items = [
    { icon: Bitcoin, title: "Rendimento em Bitcoin", text: "O valor do seu Bitcoin evolui dentro do protocolo, sem você precisar operar nada.", tone: "lime" },
    { icon: QrCode, title: "Liquidação via Pix", text: "Cotação transparente antes da confirmação, com destino para conta de mesma titularidade.", tone: "cyan" },
    { icon: ReceiptText, title: "Histórico de aportes", text: "Veja quanto colocou, quando colocou e como cada aporte evoluiu em reais.", tone: "violet" },
    { icon: FileCheck2, title: "Relatório fiscal brasileiro", text: "Resumo em reais pronto para compartilhar com o seu contador.", tone: "orange" },
    { icon: Network, title: "Prova pública das reservas", text: "Uma forma simples de conferir que existe lastro por trás da operação.", tone: "green" },
    { icon: LockKeyhole, title: "Seu patrimônio separado", text: "O dinheiro dos clientes fica separado da operação da empresa.", tone: "blue" },
  ];
  return (
    <section className="br-innovation">
      <div className="br-section-head">
        <div><span className="br-eyebrow">A INOVAÇÃO REAL</span><h2>Bitcoin útil para a vida financeira no Brasil.</h2></div>
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

function YieldPage() {
  return (
    <div className="br-stack">
      <section className="br-page-hero compact"><div><span className="br-eyebrow">MEU RENDIMENTO EM BRL</span><h1>Rendimento em reais, com origem em Bitcoin.</h1><p>Veja quanto o seu saldo pode representar em reais e separe o que veio do protocolo do que veio da variação do Bitcoin.</p></div><div className="br-big-icon"><TrendingUp /></div></section>
      <div className="br-metric-grid">
        <div className="br-panel br-metric"><small>Crescimento do saldo</small><strong>+2,684%</strong><span>gerado pelo protocolo</span></div>
        <div className="br-panel br-metric"><small>Variação do Bitcoin</small><strong>+2,87%</strong><span>desde o primeiro aporte</span></div>
        <div className="br-panel br-metric"><small>Retorno combinado</small><strong>+5,63%</strong><span>R$ 6.514,00</span></div>
      </div>
      <section className="br-panel br-formula-card">
        <div><span className="br-eyebrow">TRANSPARÊNCIA SEM COMPLICAÇÃO</span><h2>Como chegamos ao seu valor</h2></div>
        <div className="br-formula"><span>Bitcoin comprado</span><i>+</i><span>rendimento acumulado</span><i>×</i><span>cotação em reais</span><i>=</i><b>R$ 122.314</b></div>
        <p>O painel combina seu saldo em Bitcoin, o rendimento acumulado e a cotação em BRL. Custos e diferenças de execução aparecem separadamente antes da compra ou do resgate.</p>
      </section>
      <section className="br-panel br-breakdown">
        <div className="br-section-head"><div><span className="br-eyebrow">HISTÓRICO</span><h2>Evolução do rendimento acumulado</h2></div><span className="br-positive">+2,684%</span></div>
        <MiniChart />
      </section>
    </div>
  );
}

function LotsPage({ purchases }: { purchases: PurchaseRecord[] }) {
  const totals = purchases.reduce((acc, purchase) => ({ invested: acc.invested + purchase.invested, current: acc.current + purchase.currentValue, gain: acc.gain + purchase.gain }), { invested: 0, current: 0, gain: 0 });
  return (
    <div className="br-stack">
      <section className="br-page-hero compact"><div><span className="br-eyebrow">HISTÓRICO DE COMPRAS</span><h1>Cada aporte, do Pix ao rendimento.</h1><p>Acompanhe quanto você investiu em reais, quanto Bitcoin foi comprado e quando o rendimento foi ativado.</p></div><div className="br-big-icon"><Layers3 /></div></section>
      <div className="br-purchase-summary"><div className="br-panel"><small>Total investido</small><b>{currency.format(totals.invested)}</b><span>{purchases.length} compras</span></div><div className="br-panel"><small>Valor atual</small><b>{currency.format(totals.current)}</b><span>estimado em BRL</span></div><div className="br-panel"><small>Resultado estimado</small><b className={totals.gain >= 0 ? "gain" : "loss"}>{formatSignedCurrency(totals.gain)}</b><span>não garantido</span></div></div>
      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><h2>Compras e ativações</h2><p>Valores demonstrativos atualizados em 08/09/2026.</p></div><button className="br-outline" type="button" onClick={() => toast.success("CSV demonstrativo preparado")}>Exportar CSV <ArrowDownToLine size={16} /></button></div>
        <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Aporte em BRL</th><th>Bitcoin comprado</th><th>Cotação BTC/BRL</th><th>Valor atual</th><th>Resultado</th><th>Status</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td><b>{purchase.date}</b></td><td>{currency.format(purchase.invested)}</td><td className="mono">₿ {formatBtc(purchase.btc)}</td><td>{currency.format(purchase.quote)}</td><td>{currency.format(purchase.currentValue)}</td><td className={purchase.gain >= 0 ? "gain" : "loss"}>{formatSignedCurrency(purchase.gain)}</td><td><span className="br-status"><i />{purchase.status}</span></td></tr>)}</tbody></table></div>
        <div className="br-history-disclosure"><ShieldCheck size={17} /><div><b>Rendimento ativado nos bastidores</b><span>A tela mostra a experiência em reais e Bitcoin. A trilha técnica de conversão e aplicação permanece verificável na área Segurança.</span></div></div>
      </section>
    </div>
  );
}

function RedeemPage({ amount, setAmount, onConfirm }: { amount: string; setAmount: (value: string) => void; onConfirm: () => void }) {
  const numericAmount = Number(amount.replace(",", ".")) || 0;
  const gross = numericAmount * btcBrl;
  const protocolFee = gross * 0.0015;
  const fxFee = gross * 0.0045;
  const net = Math.max(0, gross - protocolFee - fxFee);
  return (
    <div className="br-stack">
      <section className="br-page-hero compact pix"><div><span className="br-eyebrow">RENDIMENTO REALIZADO EM BRL</span><h1>Do seu rendimento em reais para o Pix.</h1><p>Quando você realiza o rendimento, ele é convertido para BRL. Você confere a cotação, todas as taxas e o valor líquido antes de confirmar.</p></div><div className="br-big-icon"><QrCode /></div></section>
      <div className="br-redeem-grid">
        <section className="br-panel br-quote-form">
          <span className="br-eyebrow">QUANTO DESEJA RESGATAR?</span>
          <label className="br-amount-input"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" aria-label="Quantidade de Bitcoin" /><span>BTC</span></label>
          <div className="br-chips"><button type="button" onClick={() => setAmount("0,07105375")}>25%</button><button type="button" onClick={() => setAmount("0,14210750")}>50%</button><button type="button" onClick={() => setAmount("0,28421500")}>Máximo</button></div>
          <div className="br-pix-account"><div className="br-bank-icon"><Landmark size={20} /></div><div><small>Conta Pix de destino</small><b>Banco Inter •••• 4821</b><span>Alexandre Bastos — mesma titularidade</span></div><BadgeCheck size={21} /></div>
          <button type="button" className="br-primary full" onClick={onConfirm}>Revisar e continuar <ArrowRight size={17} /></button>
        </section>
        <section className="br-panel br-live-quote">
          <div className="br-card-headline"><h2>Cotação transparente</h2><span className="br-live"><i /> 58s</span></div>
          <div className="br-quote-value"><small>Você receberá</small><strong>{currency.format(net)}</strong><span>via Pix após a liquidação</span></div>
          <div className="br-divider" />
          <div className="br-kv"><span>Valor bruto</span><b>{currency.format(gross)}</b></div>
          <div className="br-kv"><span>Resgate do protocolo (0,15%)</span><b>-{currency.format(protocolFee)}</b></div>
          <div className="br-kv"><span>Conversão e Pix (0,45%)</span><b>-{currency.format(fxFee)}</b></div>
          <div className="br-kv total"><span>Valor líquido</span><b>{currency.format(net)}</b></div>
          <div className="br-warning"><ShieldCheck size={18} /><p><b>Sem taxa escondida.</b> O valor só é confirmado depois da sua revisão final.</p></div>
        </section>
      </div>
    </div>
  );
}

function FiscalPage() {
  return (
    <div className="br-stack">
      <section className="br-page-hero compact fiscal"><div><span className="br-eyebrow">ANO-CALENDÁRIO 2026</span><h1>Um relatório que fala a língua do seu contador.</h1><p>Posição patrimonial, custo por lote e eventos de realização organizados em reais.</p></div><div className="br-big-icon"><FileCheck2 /></div></section>
      <div className="br-fiscal-grid">
        <section className="br-panel br-report-preview">
          <div className="br-report-top"><div className="br-report-mark"><Bitcoin /> <b>NEXO</b></div><span>RELATÓRIO FISCAL 2026</span></div>
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

function ReservesPage() {
  const reserveItems = [
    { label: "stBTC em circulação", value: "142,8047 stBTC", detail: "Contrato do token" },
    { label: "sBTC em reservas e bonds", value: "146,6239 sBTC", detail: "Lastro verificável" },
    { label: "Índice de cobertura", value: "102,67%", detail: "Atualizado no bloco 612.842" },
  ];
  return (
    <div className="br-stack">
      <section className="br-page-hero compact reserves"><div><span className="br-eyebrow">PROVA ON-CHAIN</span><h1>Confiança que pode ser verificada.</h1><p>A interface organiza contratos, lastro e segregação. Os números abaixo são demonstrativos para o MVP.</p></div><div className="br-big-icon"><ShieldCheck /></div></section>
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
    </div>
  );
}

function BusinessPage() {
  return (
    <div className="br-stack">
      <section className="br-business-hero"><div><span className="br-eyebrow light">NEXO PARA EMPRESAS</span><h1>Leve rendimento em Bitcoin aos seus clientes.</h1><p>Uma camada white-label em português para fintechs, exchanges e tesourarias — da posição em stBTC ao resgate em reais.</p><div className="br-business-actions"><button className="br-primary light" type="button" onClick={() => toast.success("Solicitação de demonstração registrada")}>Solicitar demonstração <ArrowRight /></button><button className="br-secondary light" type="button" onClick={() => toast.info("Documentação da API disponível na próxima etapa")}>Ver documentação</button></div></div><div className="br-api-visual"><div className="br-code-head"><span /><span /><span /><b>POST /v1/quotes/pix</b></div><pre>{`{
  "asset": "stBTC",
  "amount": "0.025",
  "settlement": "BRL_PIX",
  "customer": "verified"
}`}</pre><div className="br-api-result"><Check /> Cotação criada em 184ms</div></div></section>
      <div className="br-b2b-grid">
        <div className="br-panel br-b2b-card"><div className="br-feature-icon lime"><Zap /></div><h3>API de rendimento</h3><p>Saldos, lotes, taxa stBTC/sBTC e eventos de protocolo normalizados.</p><span>REST + webhooks</span></div>
        <div className="br-panel br-b2b-card"><div className="br-feature-icon cyan"><QrCode /></div><h3>Orquestração Pix</h3><p>Cotação, liquidação e conciliação com parceiros adequados ao fluxo brasileiro.</p><span>BRL settlement</span></div>
        <div className="br-panel br-b2b-card"><div className="br-feature-icon violet"><Gauge /></div><h3>Painel white-label</h3><p>Marca, domínio, limites, taxas e jornadas configuráveis para cada distribuidor.</p><span>Go-live modular</span></div>
      </div>
      <section className="br-panel br-partner-strip"><div><span className="br-eyebrow">PRONTO PARA INTEGRAR</span><h2>Seu produto. Nossa infraestrutura Bitcoin.</h2></div><div className="br-partner-types"><span><Building2 /> Fintechs</span><span><CircleDollarSign /> Exchanges</span><span><Landmark /> Tesourarias</span></div><button className="br-outline" type="button" onClick={() => toast.success("Contato comercial demonstrativo iniciado")}>Falar com especialista</button></section>
    </div>
  );
}

export default function BitcoinYield() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const profileQuery = trpc.onboarding.get.useQuery(undefined, { enabled: isAuthenticated });
  const purchasesQuery = trpc.purchases.list.useQuery(undefined, { enabled: isAuthenticated });
  const [section, setSection] = useState<SectionId>("inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [amount, setAmount] = useState("0,01500000");
  const [addAmount, setAddAmount] = useState("1.000,00");
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("eligibility");
  const [quoteSeconds, setQuoteSeconds] = useState(59);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [eligibility, setEligibility] = useState({ resident: false, cpf: false, pix: false });
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(initialPurchases);
  const [legalName, setLegalName] = useState("Alexandre Bastos");
  const [cpfMasked, setCpfMasked] = useState("•••.482.•••-••");
  const [pixAccount, setPixAccount] = useState("Banco Inter •••• 4821");
  const [serverQuote, setServerQuote] = useState<Awaited<ReturnType<typeof createQuoteMutation.mutateAsync>> | null>(null);
  const activeLabel = useMemo(() => navItems.find((item) => item.id === section)?.label ?? "Visão geral", [section]);
  const localPurchaseQuote = useMemo(() => {
    const amountInBrl = parseBrl(addAmount);
    const serviceFee = amountInBrl * 0.005;
    const executionPrice = btcBrl * 1.0065;
    const applied = Math.max(0, amountInBrl - serviceFee);
    return { amountInBrl, serviceFee, executionPrice, applied, btc: executionPrice > 0 ? applied / executionPrice : 0 };
  }, [addAmount, quoteNonce]);
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
  const createQuoteMutation = trpc.purchases.createQuote.useMutation();
  const confirmPurchaseMutation = trpc.purchases.confirm.useMutation();

  useEffect(() => {
    const livePurchases = purchasesQuery.data;
    if (!livePurchases) return;
    setPurchases(livePurchases.map(item => {
      const invested = Number(item.amountBrl);
      const currentValue = Number(item.btcAmount) * btcBrl;
      return {
        id: String(item.id),
        date: new Date(item.createdAt).toLocaleDateString("pt-BR"),
        invested,
        btc: Number(item.btcAmount),
        quote: Number(item.executionBtcBrl),
        currentValue,
        gain: currentValue - invested,
        status: item.yieldStatus === "active" ? "Rendimento ativo" : item.status,
      };
    }));
  }, [purchasesQuery.data]);

  useEffect(() => {
    if (!addMoneyOpen || purchaseStep !== "quote" || quoteSeconds <= 0) return;
    const timer = window.setInterval(() => setQuoteSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [addMoneyOpen, purchaseStep, quoteSeconds]);

  function navigate(next: SectionId) {
    setSection(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmRedeem() {
    setRedeemOpen(false);
    toast.success("Simulação concluída", { description: "Nenhuma transação real foi realizada neste MVP." });
  }

  function openPurchase() {
    if (!isAuthenticated) {
      toast.info("Entre na sua conta para registrar compras no sandbox.");
      startLogin();
      return;
    }
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
      await confirmPurchaseMutation.mutateAsync({ quoteId: serverQuote.id, idempotencyKey: `purchase-${crypto.randomUUID()}` });
      await Promise.all([utils.purchases.list.invalidate(), utils.purchases.ledger.invalidate()]);
      setPurchaseStep("success");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar a compra sandbox.");
    }
  }

  return (
    <div className="btcbr-app">
      <header className="br-mobile-header">
        <button className="br-mobile-menu" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Abrir menu">{mobileOpen ? <X /> : <Menu />}</button>
        <div className="br-brand"><div className="br-brand-mark"><Bitcoin /></div><div><b>NEXO</b><small>BITCOIN EM REAIS</small></div></div>
        <button className="br-avatar" type="button">AB</button>
      </header>
      <aside className={`br-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="br-brand"><div className="br-brand-mark"><Bitcoin /></div><div><b>NEXO</b><small>BITCOIN EM REAIS</small></div></div>
        <div className="br-profile"><div className="br-avatar">{user?.name?.slice(0, 2).toUpperCase() || "AB"}</div><div><b>Olá, {user?.name?.split(" ")[0] || "Alexandre"}</b><span>{isAuthenticated ? "Conta autenticada" : "Modo de leitura"} <BadgeCheck size={13} /></span></div><ChevronDown size={16} /></div>
        <nav>{navItems.map(({ id, label, icon: Icon }) => <button className={section === id ? "active" : ""} key={id} onClick={() => navigate(id)} type="button"><Icon size={19} /><span>{label}</span>{id === "empresas" && <em>B2B</em>}</button>)}</nav>
        <div className="br-sidebar-security"><ShieldCheck /><div><b>Ambiente protegido</b><span>Seus dados e posições são demonstrativos.</span></div></div>
        <div className="br-sidebar-footer"><button type="button" onClick={() => toast.success("Atendimento demonstrativo iniciado")}>Atendimento</button>{user?.role === "admin" && <button type="button" onClick={() => { window.location.href = "/operacao"; }}>Operação</button>}<span>v0.2 sandbox</span></div>
      </aside>

      <main className="br-main">
        <div className="br-topbar"><div><span>CONTA PESSOAL</span><b>{activeLabel}</b></div><div className="br-top-actions"><DemoPill /><button className="br-account-button" type="button" onClick={() => isAuthenticated ? toast.success("Conta e dados sincronizados com o sandbox.") : startLogin()}><span className="br-account-status"><i /></span> {authLoading ? "Carregando…" : isAuthenticated ? "Conta conectada" : "Entrar"} <ChevronDown size={14} /></button></div></div>
        <div className="br-content">
          {section === "inicio" && <div className="br-stack"><section className="br-welcome"><div><span className="br-eyebrow">8 DE SETEMBRO DE 2026</span><h1>Seu Bitcoin trabalhando.<br /><em>Seu rendimento em reais.</em></h1><p>Uma conta simples para acompanhar seu Bitcoin, ver o rendimento estimado em reais (BRL) e resgatar via Pix — sem precisar entender carteiras ou contratos.</p></div><div className="br-trust-row"><span><BadgeCheck /> Conta protegida</span><span><ShieldCheck /> Patrimônio separado</span><span><Sparkles /> Você não precisa entender a tecnologia</span></div></section><YieldSummary onRedeem={() => setRedeemOpen(true)} onAddMoney={openPurchase} /><InnovationGrid setSection={navigate} /><section className="br-panel br-how-card"><div><span className="br-eyebrow">SIMPLES POR FORA. BITCOIN POR DENTRO.</span><h2>Do seu dinheiro ao Pix em três etapas.</h2></div><div className="br-steps"><div><span>01</span><Bitcoin /><h3>Compre com reais</h3><p>Você escolhe quanto quer colocar e vê tudo explicado em BRL.</p></div><ArrowRight /><div><span>02</span><TrendingUp /><h3>Ative o rendimento</h3><p>A estratégia é aplicada nos bastidores e o resultado aparece em reais.</p></div><ArrowRight /><div><span>03</span><QrCode /><h3>Resgate via Pix</h3><p>Confira o valor líquido e confirme quando quiser.</p></div></div></section></div>}
          {section === "rendimento" && <YieldPage />}
          {section === "lotes" && <LotsPage purchases={purchases} />}
          {section === "resgate" && <RedeemPage amount={amount} setAmount={setAmount} onConfirm={() => setRedeemOpen(true)} />}
          {section === "fiscal" && <FiscalPage />}
          {section === "reservas" && <ReservesPage />}
          {section === "empresas" && <BusinessPage />}
          {section === "ajuda" && <HelpPage />}
        </div>
      </main>

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="br-confirm-dialog">
          <DialogHeader><DialogTitle>Confirmar simulação de resgate</DialogTitle><DialogDescription>Este é um MVP frontend. Nenhum ativo será movimentado e nenhum Pix será enviado.</DialogDescription></DialogHeader>
          <div className="br-confirm-summary"><div><span>Quantidade</span><b>{amount} BTC</b></div><div><span>Conta de destino</span><b>Banco Inter •••• 4821</b></div><div><span>Valor líquido estimado</span><b>{currency.format((Number(amount.replace(",", ".")) || 0) * btcBrl * 0.994)}</b></div></div>
          <button className="br-primary full" type="button" onClick={confirmRedeem}>Concluir demonstração <Check size={17} /></button>
          <button className="br-dialog-cancel" type="button" onClick={() => setRedeemOpen(false)}>Voltar</button>
        </DialogContent>
      </Dialog>
      <Dialog open={addMoneyOpen} onOpenChange={setAddMoneyOpen}>
        <DialogContent className="br-confirm-dialog br-add-money-dialog">
          <div className="br-purchase-progress" aria-label={`Etapa ${purchaseStep === "eligibility" ? 1 : purchaseStep === "quote" ? 2 : 3} de 3`}><span className={purchaseStep !== "success" ? "active" : "done"}><i>{purchaseStep === "success" ? <Check size={11} /> : "1"}</i> Cadastro</span><b /><span className={purchaseStep === "quote" ? "active" : purchaseStep === "success" ? "done" : ""}><i>{purchaseStep === "success" ? <Check size={11} /> : "2"}</i> Cotação</span><b /><span className={purchaseStep === "success" ? "active" : ""}><i>3</i> Conclusão</span></div>

          {purchaseStep === "eligibility" && <>
            <DialogHeader><DialogTitle>Vamos preparar sua compra</DialogTitle><DialogDescription>Confirme seus dados básicos para comprar Bitcoin com reais. Tudo abaixo é demonstrativo.</DialogDescription></DialogHeader>
            <div className="br-eligibility-grid"><label><span>Nome completo</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label><label><span>CPF mascarado</span><input value={cpfMasked} onChange={(event) => setCpfMasked(event.target.value)} /></label><label><span>Residência</span><select defaultValue="BR"><option value="BR">Brasil</option></select></label><label><span>Conta Pix mascarada</span><input value={pixAccount} onChange={(event) => setPixAccount(event.target.value)} /></label></div>
            <div className="br-check-stack"><label><input type="checkbox" checked={eligibility.resident} onChange={(event) => setEligibility((value) => ({ ...value, resident: event.target.checked }))} /><span><b>Sou residente no Brasil</b><small>Produto demonstrado apenas para residentes no país.</small></span></label><label><input type="checkbox" checked={eligibility.cpf} onChange={(event) => setEligibility((value) => ({ ...value, cpf: event.target.checked }))} /><span><b>Meu CPF está regular e verificado</b><small>Identificação necessária antes de movimentar valores reais.</small></span></label><label><input type="checkbox" checked={eligibility.pix} onChange={(event) => setEligibility((value) => ({ ...value, pix: event.target.checked }))} /><span><b>A conta Pix é da minha titularidade</b><small>Compras e resgates usam uma conta com o mesmo titular.</small></span></label></div>
            <button className="br-primary full" type="button" disabled={!isEligible || saveProfileMutation.isPending || verifyKycMutation.isPending || createQuoteMutation.isPending} onClick={() => void continueToQuote()}>{saveProfileMutation.isPending || verifyKycMutation.isPending || createQuoteMutation.isPending ? <RefreshCw className="animate-spin" size={17} /> : <ArrowRight size={17} />} Verificar e gerar cotação</button>
            <p className="br-dialog-footnote"><ShieldCheck size={13} /> O sandbox persiste apenas dados mascarados e simula a aprovação do provedor KYC.</p>
          </>}

          {purchaseStep === "quote" && <>
            <DialogHeader><DialogTitle>Sua cotação para comprar Bitcoin</DialogTitle><DialogDescription>Veja preço, spread, taxa, prazo e quantidade antes de ativar o rendimento.</DialogDescription></DialogHeader>
            <label className="br-amount-label" htmlFor="add-money-amount">Quanto você quer investir?</label>
            <div className="br-amount-field"><span>R$</span><input id="add-money-amount" inputMode="decimal" value={addAmount} onChange={(event) => { setAddAmount(event.target.value); setQuoteSeconds(0); setServerQuote(null); }} aria-label="Valor da compra em reais" /></div>
            <div className="br-buy-chips"><button type="button" onClick={() => { setAddAmount("500,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 500</button><button type="button" onClick={() => { setAddAmount("1.000,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 1.000</button><button type="button" onClick={() => { setAddAmount("5.000,00"); setServerQuote(null); setQuoteSeconds(0); }}>R$ 5.000</button></div>
            <section className="br-buy-quote"><div className="br-buy-quote-head"><span><i /> Cotação persistida</span><b className={quoteSeconds === 0 ? "expired" : ""}>{quoteSeconds === 0 ? "Atualize" : `00:${String(quoteSeconds).padStart(2, "0")}`}</b></div><div className="br-kv"><span>Referência BTC/BRL</span><b>{currency.format(serverQuote ? Number(serverQuote.referenceBtcBrl) : btcBrl)}</b></div><div className="br-kv"><span>Preço de execução (spread 0,65%)</span><b>{currency.format(purchaseQuote.executionPrice)}</b></div><div className="br-kv"><span>Taxa de serviço (0,50%)</span><b>-{currency.format(purchaseQuote.serviceFee)}</b></div><div className="br-kv"><span>Valor aplicado</span><b>{currency.format(purchaseQuote.applied)}</b></div><div className="br-buy-total"><span>Você compra aproximadamente</span><strong>₿ {formatBtc(purchaseQuote.btc)}</strong><small>Liquidação sandbox persistida no ledger</small></div></section>
            {(!serverQuote || quoteSeconds === 0) && <button className="br-outline full" type="button" onClick={() => void regenerateServerQuote()} disabled={createQuoteMutation.isPending}><RefreshCw className={createQuoteMutation.isPending ? "animate-spin" : ""} size={15} /> Atualizar cotação</button>}
            <label className="br-risk-check"><input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /><span>Entendi que o preço do Bitcoin e o rendimento variam, e que este MVP não realiza uma compra real.</span></label>
            <details className="br-how-it-works"><summary>Como funciona por trás?</summary><p>Após a compra, a posição pode passar por conversões técnicas para os ativos de liquidez do protocolo e ser aplicada na estratégia de rendimento. Isso envolve riscos de mercado, protocolo, liquidez e contraparte. Os registros verificáveis ficam em Segurança.</p></details>
            <button className="br-primary full" type="button" disabled={!riskAccepted || !serverQuote || quoteSeconds === 0 || confirmPurchaseMutation.isPending} onClick={() => void confirmPurchase()}>{confirmPurchaseMutation.isPending ? <RefreshCw className="animate-spin" size={17} /> : <ArrowRight size={17} />} Confirmar no sandbox</button>
            <button className="br-dialog-cancel" type="button" onClick={() => setPurchaseStep("eligibility")}>Voltar</button>
          </>}

          {purchaseStep === "success" && <div className="br-purchase-success"><div className="br-success-icon"><CircleCheckBig /></div><span className="br-eyebrow">SIMULAÇÃO CONCLUÍDA</span><h2>Bitcoin comprado. Rendimento ativado.</h2><p>Sua compra demonstrativa foi registrada e já aparece em Meus aportes.</p><div className="br-success-values"><div><span>Investido</span><b>{currency.format(purchaseQuote.amountInBrl)}</b></div><div><span>Bitcoin comprado</span><b>₿ {formatBtc(purchaseQuote.btc)}</b></div><div><span>Status</span><b className="gain">Rendimento ativo</b></div></div><button className="br-primary full" type="button" onClick={() => { setAddMoneyOpen(false); navigate("lotes"); }}>Ver meus aportes <ArrowRight size={17} /></button><button className="br-dialog-cancel" type="button" onClick={() => setAddMoneyOpen(false)}>Voltar para o início</button></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HelpPage() {
  const faqs = [
    {
      category: "Primeiros passos",
      question: "O que é a Conta Nexo?",
      answer: "É uma conta simples para acompanhar uma posição em Bitcoin, entender quanto ela vale em reais e solicitar resgates via Pix. Você não precisa conhecer termos técnicos para começar.",
    },
    {
      category: "Primeiros passos",
      question: "Preciso entender de carteiras ou contratos?",
      answer: "Não para usar a experiência principal. A Conta Nexo esconde a complexidade e mostra o que importa: seu saldo, seu ganho, os riscos e o valor líquido de um eventual resgate. A área Segurança permite consultar os detalhes quando você quiser.",
    },
    {
      category: "Primeiros passos",
      question: "Posso começar sem ter Bitcoin?",
      answer: "Sim. A proposta é permitir uma compra em reais (BRL) dentro da sua Conta Nexo e, depois da cotação, ativar o acompanhamento do rendimento. Antes de uma operação real, você deverá ver preço, taxas, prazo, riscos e as informações de custódia.",
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
      answer: "Não. O rendimento é variável e pode mudar conforme o protocolo, a liquidez e as condições do mercado. Além disso, a valorização do Bitcoin em reais é diferente do rendimento gerado pelo protocolo. Nunca use um cenário demonstrativo como promessa de resultado.",
    },
    {
      category: "Rendimento",
      question: "Vocês oferecem juros reais em BRL?",
      answer: "A proposta é que o rendimento realizado seja convertido e pago em reais (BRL), com a cotação e as taxas mostradas antes do resgate. Isso não é juro fixo nem rendimento garantido: o valor pode mudar conforme o Bitcoin, o protocolo, a liquidez e as condições do mercado.",
    },
    {
      category: "Rendimento",
      question: "Por que meu saldo pode cair mesmo com rendimento?",
      answer: "Porque o rendimento do protocolo e o preço do Bitcoin são coisas diferentes. O protocolo pode gerar uma evolução positiva enquanto o Bitcoin perde valor em reais. O painel separa esses efeitos para tornar a leitura mais honesta.",
    },
    {
      category: "Impostos",
      question: "A Nexo faz minha declaração de imposto?",
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
  const normalized = query.trim().toLowerCase();
  const filtered = faqs.filter((faq) => {
    const matchesCategory = category === "Todas" || faq.category === category;
    const matchesQuery = !normalized || `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase().includes(normalized);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="br-stack">
      <section className="br-help-hero">
        <div className="br-help-hero-copy">
          <span className="br-eyebrow light">CENTRAL DE AJUDA</span>
          <h1>Respostas claras para decisões tranquilas.</h1>
          <p>Não encontrou o que procura? Comece por uma pergunta simples. A gente explica o produto sem esconder riscos ou usar palavras difíceis.</p>
          <label className="br-help-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque uma dúvida, como “resgate”" aria-label="Buscar na central de ajuda" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={15} /></button>}</label>
        </div>
        <div className="br-help-orbit"><HelpCircle size={45} /><span>Estamos aqui<br />para explicar.</span></div>
      </section>
      <div className="br-help-layout">
        <aside className="br-help-categories"><span className="br-eyebrow">NAVEGAR POR TEMA</span>{categories.map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}<span>{item === "Todas" ? faqs.length : faqs.filter((faq) => faq.category === item).length}</span></button>)}</aside>
        <section className="br-help-list"><div className="br-help-list-head"><div><span className="br-eyebrow">PERGUNTAS FREQUENTES</span><h2>{filtered.length} {filtered.length === 1 ? "resposta encontrada" : "respostas encontradas"}</h2></div><span className="br-help-honesty"><ShieldCheck size={15} /> Sem promessa escondida</span></div>{filtered.length === 0 ? <div className="br-panel br-help-empty"><HelpCircle /><h3>Não encontramos essa resposta ainda.</h3><p>Tente usar palavras como Pix, segurança, rendimento ou impostos.</p><button type="button" className="br-outline" onClick={() => { setQuery(""); setCategory("Todas"); }}>Ver todas as perguntas</button></div> : <div className="br-faq-stack">{filtered.map((faq) => { const isOpen = open === faq.question; return <article className={`br-faq ${isOpen ? "open" : ""}`} key={faq.question}><button type="button" className="br-faq-trigger" onClick={() => setOpen(isOpen ? null : faq.question)}><span><small>{faq.category}</small><b>{faq.question}</b></span><span className="br-faq-plus">{isOpen ? "−" : "+"}</span></button>{isOpen && <div className="br-faq-answer"><p>{faq.answer}</p>{faq.question === "Meu dinheiro está seguro?" && <button type="button" className="br-text-action" onClick={() => toast.info("A área Segurança mostra o fluxo de custódia e a prova pública das reservas.")}>Ver como a segurança funciona <ArrowRight size={15} /></button>}</div>}</article>; })}</div>}</section>
      </div>
      <section className="br-panel br-help-contact"><div className="br-help-contact-icon"><MessageCircleIcon /></div><div><span className="br-eyebrow">AINDA COM DÚVIDA?</span><h2>Fale com uma pessoa, não com um robô.</h2><p>O atendimento pode orientar sobre o produto, mas nunca vai prometer retorno ou pedir sua senha.</p></div><button className="br-primary" type="button" onClick={() => toast.success("Atendimento demonstrativo iniciado")}>Iniciar atendimento <ArrowRight size={16} /></button></section>
    </div>
  );
}

function MessageCircleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>;
}
