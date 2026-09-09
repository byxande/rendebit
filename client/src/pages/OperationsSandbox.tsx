import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bitcoin,
  CheckCircle2,
  Database,
  KeyRound,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationsSandbox() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const settingsQuery = trpc.treasury.settings.useQuery(undefined, { enabled: isAdmin });
  const distributionsQuery = trpc.treasury.distributions.useQuery(undefined, { enabled: isAdmin });
  const ledgerQuery = trpc.treasury.ledger.useQuery(undefined, { enabled: isAdmin });
  const pixDepositsQuery = trpc.pixDeposits.operationalList.useQuery(undefined, { enabled: isAdmin });
  const purchasesQuery = trpc.purchases.list.useQuery(undefined, { enabled: isAuthenticated });
  const redemptionsQuery = trpc.redemptions.operationalList.useQuery(undefined, { enabled: isAdmin });
  const mercadoPagoQuery = trpc.integrations.mercadoPago.useQuery(undefined, { enabled: isAdmin });
  const [organizationName, setOrganizationName] = useState("Organização RendeBit");
  const [wallet, setWallet] = useState("");
  const [asset, setAsset] = useState<"STX" | "sBTC" | "stBTC">("sBTC");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [approvalMode, setApprovalMode] = useState<"manual" | "multisig" | "automatic">("manual");
  const [taxReserve, setTaxReserve] = useState(15);
  const [operationalReserve, setOperationalReserve] = useState(10);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setOrganizationName(settings.organizationName);
    setWallet(settings.stacksWalletAddress ?? "");
    setAsset(settings.distributionAsset);
    setNetwork(settings.network);
    setCadence(settings.cadence);
    setApprovalMode(settings.approvalMode);
    setTaxReserve(settings.taxReserveBps / 100);
    setOperationalReserve(settings.operationalReserveBps / 100);
  }, [settingsQuery.data]);

  const saveSettings = trpc.treasury.updateSettings.useMutation({
    onSuccess: async data => {
      await utils.treasury.settings.invalidate();
      toast.success(data.status === "ready" ? "Tesouraria pronta no sandbox" : "Configuração salva como rascunho");
    },
    onError: error => toast.error(error.message),
  });
  const closePeriod = trpc.treasury.closePeriod.useMutation({
    onSuccess: async data => {
      await utils.treasury.distributions.invalidate();
      toast.success(data.status === "blocked" ? "Fechamento criado e bloqueado" : "Fechamento aguardando aprovação");
    },
    onError: error => toast.error(error.message),
  });
  const approve = trpc.treasury.approveSandbox.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.treasury.distributions.invalidate(), utils.treasury.ledger.invalidate()]);
      toast.success("Repasse simulado registrado", { description: "Nenhuma transação on-chain real foi enviada." });
    },
    onError: error => toast.error(error.message),
  });

  if (loading) return <div className="br-ops-gate"><Loader2 className="animate-spin" /> Carregando ambiente seguro…</div>;
  if (!isAuthenticated) return <div className="br-ops-gate"><KeyRound /><h2>Entre para acessar a operação sandbox</h2><p>O painel usa autenticação e separa dados por usuário.</p><button className="br-primary" type="button" onClick={() => startLogin()}>Entrar na conta <ArrowRight size={16} /></button></div>;
  if (!isAdmin) return <div className="br-ops-gate"><ShieldCheck /><h2>Acesso restrito</h2><p>Somente o administrador da organização pode configurar ou aprovar repasses.</p></div>;

  const settings = settingsQuery.data;
  const entries = ledgerQuery.data ?? [];
  const pixDeposits = pixDepositsQuery.data ?? [];
  const redemptions = redemptionsQuery.data ?? [];
  const distributions = distributionsQuery.data ?? [];
  const grossRevenue = entries.filter(item => item.entryType === "fee_revenue" && item.currency === "BRL").reduce((sum, item) => sum + Number(item.amount), 0);
  const providerCosts = entries.filter(item => item.entryType === "provider_cost" && item.currency === "BRL").reduce((sum, item) => sum + Number(item.amount), 0);
  const estimatedNet = Math.max(0, grossRevenue - providerCosts) * (1 - taxReserve / 100 - operationalReserve / 100);

  function submitSettings() {
    saveSettings.mutate({
      organizationName,
      stacksWalletAddress: wallet.trim() || null,
      distributionAsset: asset,
      cadence,
      approvalMode,
      network,
      taxReserveBps: Math.round(taxReserve * 100),
      operationalReserveBps: Math.round(operationalReserve * 100),
    });
  }

  function createClosing() {
    const periodKey = new Date().toISOString().slice(0, 7);
    closePeriod.mutate({ periodKey, idempotencyKey: `close-${periodKey}-${crypto.randomUUID()}` });
  }

  return (
    <div className="br-stack br-ops-page">
      <section className="br-page-hero compact br-ops-hero">
        <div><span className="br-eyebrow light">OPERAÇÃO CONTROLADA</span><h1>Sandbox financeiro com trilha auditável.</h1><p>KYC, Pix, custódia e Stacks são simulados. Banco, idempotência, ledger e aprovações já são persistentes.</p></div>
        <div className="br-big-icon"><Database /></div>
      </section>

      <div className="br-sandbox-warning"><AlertTriangle size={18} /><div><b>Nenhum dinheiro ou criptoativo é movimentado.</b><span>Chaves privadas nunca são solicitadas. Ativação real exige contratos, credenciais em secrets, revisão jurídica e controles de produção.</span></div></div>

      <div className="br-ops-status-grid">
        <article className="br-panel"><Database /><small>Persistência</small><b>Banco ativo</b><span>{purchasesQuery.data?.length ?? 0} compras registradas</span></article>
        <article className="br-panel"><BadgeCheck /><small>KYC</small><b>Adaptador sandbox</b><span>Webhook idempotente</span></article>
        <article className="br-panel"><Landmark /><small>Mercado Pago</small><b>{mercadoPagoQuery.data?.configured ? `Conectado · ${mercadoPagoQuery.data.mode}` : "Aguardando credencial"}</b><span>Pix e cartão · compra de BTC separada</span></article>
        <article className="br-panel"><WalletCards /><small>Tesouraria</small><b>{settings?.status === "ready" ? "Pronta" : "Bloqueada"}</b><span>{settings?.stacksWalletAddress ? `${settings.stacksWalletAddress.slice(0, 8)}…` : "Carteira não informada"}</span></article>
      </div>

      <div className="br-ops-layout">
        <section className="br-panel br-ops-form-card">
          <div className="br-section-head"><div><span className="br-eyebrow">POLÍTICA DE TESOURARIA</span><h2>Destino do lucro distribuível</h2></div><span className={`br-ops-state ${settings?.status === "ready" ? "ready" : ""}`}>{settings?.status === "ready" ? "Configurada" : "Rascunho"}</span></div>
          <div className="br-ops-form">
            <label><span>Organização</span><input value={organizationName} onChange={event => setOrganizationName(event.target.value)} /></label>
            <label className="wide"><span>Carteira Stacks da organização</span><input value={wallet} onChange={event => setWallet(event.target.value.toUpperCase())} placeholder={network === "mainnet" ? "SP… ou SM…" : "ST… ou SN…"} /></label>
            <label><span>Rede</span><select value={network} onChange={event => setNetwork(event.target.value as "testnet" | "mainnet")}><option value="testnet">Testnet</option><option value="mainnet">Mainnet (somente configuração)</option></select></label>
            <label><span>Ativo do repasse</span><select value={asset} onChange={event => setAsset(event.target.value as typeof asset)}><option value="sBTC">sBTC</option><option value="stBTC">stBTC</option><option value="STX">STX</option></select></label>
            <label><span>Periodicidade</span><select value={cadence} onChange={event => setCadence(event.target.value as typeof cadence)}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="daily">Diária</option></select></label>
            <label><span>Aprovação</span><select value={approvalMode} onChange={event => setApprovalMode(event.target.value as typeof approvalMode)}><option value="manual">Manual</option><option value="multisig">Multisig</option><option value="automatic">Automática (bloqueada em sandbox)</option></select></label>
            <label><span>Provisão tributária (%)</span><input type="number" min="0" max="50" value={taxReserve} onChange={event => setTaxReserve(Number(event.target.value))} /></label>
            <label><span>Reserva operacional (%)</span><input type="number" min="0" max="50" value={operationalReserve} onChange={event => setOperationalReserve(Number(event.target.value))} /></label>
          </div>
          <button className="br-primary full" type="button" onClick={submitSettings} disabled={saveSettings.isPending}>{saveSettings.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck size={16} />} Salvar política</button>
          <p className="br-dialog-footnote"><KeyRound size={13} /> Informe apenas o endereço público. Assinatura real deverá usar cofre de chaves ou multisig no backend.</p>
        </section>

        <section className="br-panel br-profit-card">
          <span className="br-eyebrow">LUCRO DISTRIBUÍVEL</span><h2>Somente após conciliação e reservas.</h2>
          <div className="br-profit-formula"><div><span>Receitas realizadas</span><b>{currency.format(grossRevenue)}</b></div><div><span>Custos de parceiros</span><b>− {currency.format(providerCosts)}</b></div><div><span>Provisão tributária</span><b>− {taxReserve}%</b></div><div><span>Reserva operacional</span><b>− {operationalReserve}%</b></div><div className="total"><span>Estimativa distribuível</span><strong>{currency.format(estimatedNet)}</strong></div></div>
          <div className="br-safety-note"><ShieldCheck /><p><b>Fundos de clientes nunca entram neste cálculo.</b> A distribuição usa apenas receita realizada, líquida de custos e reservas.</p></div>
          <button className="br-outline full" type="button" onClick={createClosing} disabled={closePeriod.isPending}><RefreshCw size={15} /> Fechar período atual</button>
        </section>
      </div>

      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><span className="br-eyebrow">APROVAÇÕES</span><h2>Repasses simulados</h2></div><span className="br-help-honesty"><CheckCircle2 size={15} /> Aprovação explícita</span></div>
        {distributions.length === 0 ? <div className="br-ops-empty">Nenhum fechamento criado ainda.</div> : <div className="br-table-scroll"><table><thead><tr><th>Período</th><th>Receita</th><th>Reservas</th><th>Distribuível</th><th>Destino</th><th>Status</th><th>Ação</th></tr></thead><tbody>{distributions.map(item => <tr key={item.id}><td><b>{item.periodKey}</b></td><td>{currency.format(Number(item.grossRevenueBrl))}</td><td>{currency.format(Number(item.taxReserveBrl) + Number(item.operationalReserveBrl))}</td><td><b>{currency.format(Number(item.distributableProfitBrl))}</b><small className="br-asset-estimate">≈ {item.estimatedAssetAmount} {item.distributionAsset}</small></td><td className="mono">{item.stacksWalletAddress ? `${item.stacksWalletAddress.slice(0, 9)}…${item.stacksWalletAddress.slice(-5)}` : "Não configurado"}</td><td><span className={`br-ops-state ${item.status === "simulated_sent" ? "ready" : ""}`}>{item.status === "blocked" ? "Bloqueado" : item.status === "pending_approval" ? "Aguardando" : "Simulado"}</span></td><td>{item.status === "pending_approval" ? <button className="br-small-action" type="button" onClick={() => approve.mutate({ distributionId: item.id })}>Aprovar simulação</button> : item.transactionId ?? "—"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><span className="br-eyebrow">DEPÓSITOS VIA PIX</span><h2>Cobranças e conciliação</h2></div><span className="br-help-honesty"><ArrowRight size={15} /> {pixDeposits.length} registros</span></div>
        {pixDeposits.length === 0 ? <div className="br-ops-empty">Nenhum depósito Pix registrado ainda.</div> : <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Cliente</th><th>Valor BRL</th><th>Status</th><th>Cobrança</th><th>EndToEndId</th></tr></thead><tbody>{pixDeposits.map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td>#{item.userId}</td><td><b>{currency.format(Number(item.amountBrl))}</b></td><td><span className={`br-ops-state ${item.status === "paid" ? "ready" : ""}`}>{item.status}</span></td><td className="mono">{item.providerReference || "—"}</td><td className="mono">{item.endToEndId || "—"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><span className="br-eyebrow">RESGATES VIA PIX</span><h2>Fila operacional e reconciliação</h2></div><span className="br-help-honesty"><Landmark size={15} /> {redemptions.length} solicitações</span></div>
        {redemptions.length === 0 ? <div className="br-ops-empty">Nenhum resgate solicitado ainda.</div> : <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Cliente</th><th>BTC</th><th>Líquido BRL</th><th>Etapa</th><th>Status</th><th>Referência Pix</th></tr></thead><tbody>{redemptions.map(item => <tr key={item.id}><td>{new Date(item.requestedAt).toLocaleString("pt-BR")}</td><td>#{item.userId}</td><td className="mono">{item.btcAmount}</td><td>{currency.format(Number(item.netBrl))}</td><td>{item.stage}</td><td><span className={`br-ops-state ${item.status === "settled" ? "ready" : ""}`}>{item.status}</span></td><td className="mono">{item.pixEndToEndId || "—"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head"><div><span className="br-eyebrow">LEDGER</span><h2>Trilha contábil persistida</h2></div><span>{entries.length} lançamentos</span></div>
        <div className="br-table-scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Conta</th><th>Direção</th><th>Valor</th><th>Chave idempotente</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString("pt-BR")}</td><td>{entry.entryType}</td><td>{entry.account}</td><td>{entry.direction}</td><td>{entry.currency} {entry.amount}</td><td className="mono">{entry.idempotencyKey}</td></tr>)}</tbody></table></div>
      </section>

      <footer className="br-ops-footer"><Bitcoin size={17} /><span>Política configurada: 100% do <b>lucro distribuível</b> vai para a carteira Stacks definida — nunca o principal do cliente.</span><Banknote size={17} /></footer>
    </div>
  );
}
