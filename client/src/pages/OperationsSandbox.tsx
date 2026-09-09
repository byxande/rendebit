import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import RendeBitFooter from "@/components/RendeBitFooter";
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

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function OperationsSandbox() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const settingsQuery = trpc.treasury.settings.useQuery(undefined, {
    enabled: isAdmin,
  });
  const distributionsQuery = trpc.treasury.distributions.useQuery(undefined, {
    enabled: isAdmin,
  });
  const capitalSweepsQuery = trpc.treasury.capitalSweeps.useQuery(undefined, {
    enabled: isAdmin,
  });
  const approvalsQuery = trpc.treasury.approvals.useQuery(undefined, {
    enabled: isAdmin,
  });
  const reconciliationsQuery = trpc.treasury.reconciliations.useQuery(undefined, {
    enabled: isAdmin,
  });
  const btcLiquidityQuery = trpc.treasury.btcLiquiditySettlements.useQuery(
    undefined,
    { enabled: isAdmin, refetchInterval: isAdmin ? 15_000 : false }
  );
  const ledgerQuery = trpc.treasury.ledger.useQuery(undefined, {
    enabled: isAdmin,
  });
  const pixDepositsQuery = trpc.pixDeposits.operationalList.useQuery(
    undefined,
    { enabled: isAdmin }
  );
  const purchasesQuery = trpc.purchases.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const redemptionsQuery = trpc.redemptions.operationalList.useQuery(
    undefined,
    { enabled: isAdmin }
  );
  const mercadoPagoQuery = trpc.integrations.mercadoPago.useQuery(undefined, {
    enabled: isAdmin,
  });
  const [organizationName, setOrganizationName] = useState(
    "Organização RendeBit"
  );
  const [wallet, setWallet] = useState("");
  const [profitWallet, setProfitWallet] = useState("");
  const [conversionPartner, setConversionPartner] = useState("not_selected");
  const [conversionPartnerStatus, setConversionPartnerStatus] = useState<
    "not_selected" | "due_diligence" | "contracted" | "active"
  >("not_selected");
  const [asset, setAsset] = useState<"STX" | "sBTC" | "stBTC">("sBTC");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">(
    "monthly"
  );
  const [approvalMode, setApprovalMode] = useState<
    "manual" | "multisig" | "automatic"
  >("manual");
  const [taxReserve, setTaxReserve] = useState(15);
  const [operationalReserve, setOperationalReserve] = useState(10);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setOrganizationName(settings.organizationName);
    setWallet(settings.stacksWalletAddress ?? "");
    setProfitWallet(settings.personalProfitWalletAddress ?? "");
    setConversionPartner(settings.conversionPartner);
    setConversionPartnerStatus(settings.conversionPartnerStatus);
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
      toast.success(
        data.status === "ready"
          ? "Tesouraria pronta no sandbox"
          : "Configuração salva como rascunho"
      );
    },
    onError: error => toast.error(error.message),
  });
  const closePeriod = trpc.treasury.closePeriod.useMutation({
    onSuccess: async data => {
      await utils.treasury.distributions.invalidate();
      toast.success(
        data.status === "blocked"
          ? "Fechamento criado e bloqueado"
          : "Fechamento aguardando aprovação"
      );
    },
    onError: error => toast.error(error.message),
  });
  const proposeSweep = trpc.treasury.proposeStbtcSweep.useMutation({
    onSuccess: async data => {
      await capitalSweepsQuery.refetch();
      toast.success(
        data.status === "pending_approval"
          ? "Sweep stBTC proposto"
          : "Sweep stBTC bloqueado",
        { description: data.blockerReason ?? "Aguardando aprovação explícita." }
      );
    },
    onError: error => toast.error(error.message),
  });
  const approveSweep = trpc.treasury.approveStbtcSweep.useMutation({
    onSuccess: async data => {
      await Promise.all([
        utils.treasury.distributions.invalidate(),
        utils.treasury.capitalSweeps.invalidate(),
        utils.treasury.approvals.invalidate(),
        utils.treasury.ledger.invalidate(),
      ]);
      toast.success(
        data.status === "blocked"
          ? "Sweep bloqueado por cotação expirada"
          : data.status === "simulated_sent"
          ? "Sweep stBTC simulado registrado"
          : "Primeira aprovação registrada",
        {
          description:
            data.status === "blocked"
              ? "Gere uma nova proposta com uma cotação válida antes de revisar novamente."
              : data.status === "simulated_sent"
              ? "A conta de lucros foi atualizada somente no ledger sandbox; nenhuma transação on-chain real foi enviada."
              : "Uma segunda aprovação, de outro administrador, ainda é necessária.",
        }
      );
    },
    onError: error => toast.error(error.message),
  });
  const reconcileDaily = trpc.treasury.reconcileDaily.useMutation({
    onSuccess: async data => {
      await utils.treasury.reconciliations.invalidate();
      toast.success(
        data.status === "balanced"
          ? "Reconciliação diária sem divergências"
          : "Reconciliação concluída com atenção",
        {
          description: data.exceptions
            ? "Há itens para revisar antes de qualquer liquidação real."
            : "Ledger e sweeps conferidos no sandbox.",
        }
      );
    },
    onError: error => toast.error(error.message),
  });
  const enableDailyReconciliation =
    trpc.treasury.enableDailyReconciliation.useMutation({
      onSuccess: async () => {
        await utils.treasury.settings.invalidate();
        toast.success("Reconciliação diária automática ativada", {
          description: "O heartbeat confere o ledger todos os dias às 03:00 UTC.",
        });
      },
      onError: error => toast.error(error.message),
    });

  if (loading)
    return (
      <div className="br-ops-gate">
        <Loader2 className="animate-spin" /> Carregando ambiente seguro…
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="br-ops-gate">
        <KeyRound />
        <h2>Entre para acessar a operação sandbox</h2>
        <p>O painel usa autenticação e separa dados por usuário.</p>
        <button
          className="br-primary"
          type="button"
          onClick={() => startLogin("google")}
        >
          Entrar com Google <ArrowRight size={16} />
        </button>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="br-ops-gate">
        <ShieldCheck />
        <h2>Acesso restrito</h2>
        <p>
          Somente o administrador da organização pode configurar ou aprovar
          repasses.
        </p>
      </div>
    );

  const settings = settingsQuery.data;
  const entries = ledgerQuery.data ?? [];
  const pixDeposits = pixDepositsQuery.data ?? [];
  const redemptions = redemptionsQuery.data ?? [];
  const distributions = distributionsQuery.data ?? [];
  const capitalSweeps = capitalSweepsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const reconciliations = reconciliationsQuery.data ?? [];
  const btcLiquiditySettlements = btcLiquidityQuery.data ?? [];
  const grossRevenue = entries
    .filter(item => item.entryType === "fee_revenue" && item.currency === "BRL")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const providerCosts = entries
    .filter(
      item => item.entryType === "provider_cost" && item.currency === "BRL"
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const estimatedNet =
    Math.max(0, grossRevenue - providerCosts) *
    (1 - taxReserve / 100 - operationalReserve / 100);

  function submitSettings() {
    saveSettings.mutate({
      organizationName,
      stacksWalletAddress: wallet.trim() || null,
      personalProfitWalletAddress: profitWallet.trim() || null,
      conversionPartner,
      conversionPartnerStatus,
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
    closePeriod.mutate({
      periodKey,
      idempotencyKey: `close-${periodKey}-${crypto.randomUUID()}`,
    });
  }

  return (
    <div className="br-stack br-ops-page">
      <section className="br-page-hero compact br-ops-hero">
        <div>
          <span className="br-eyebrow light">OPERAÇÃO CONTROLADA</span>
          <h1>Sandbox financeiro com trilha auditável.</h1>
          <p>
            KYC, Pix, custódia e Stacks são simulados. Banco, idempotência,
            ledger e aprovações já são persistentes.
          </p>
        </div>
        <div className="br-big-icon">
          <Database />
        </div>
      </section>

      <div className="br-sandbox-warning">
        <AlertTriangle size={18} />
        <div>
          <b>Nenhum dinheiro ou criptoativo é movimentado.</b>
          <span>
            Chaves privadas nunca são solicitadas. Ativação real exige
            contratos, credenciais em secrets, revisão jurídica e controles de
            produção.
          </span>
        </div>
      </div>

      <div className="br-ops-status-grid">
        <article className="br-panel">
          <Database />
          <small>Persistência</small>
          <b>Banco ativo</b>
          <span>{purchasesQuery.data?.length ?? 0} compras registradas</span>
        </article>
        <article className="br-panel">
          <BadgeCheck />
          <small>KYC</small>
          <b>Adaptador sandbox</b>
          <span>Webhook idempotente</span>
        </article>
        <article className="br-panel">
          <Landmark />
          <small>Mercado Pago</small>
          <b>
            {mercadoPagoQuery.data?.configured
              ? `Conectado · ${mercadoPagoQuery.data.mode}`
              : "Aguardando credencial"}
          </b>
          <span>Pix e cartão · compra de BTC separada</span>
        </article>
        <article className="br-panel">
          <WalletCards />
          <small>Tesouraria</small>
          <b>
            {settings?.personalProfitWalletAddress
              ? "Lucro stBTC separado"
              : "Conta de lucro pendente"}
          </b>
          <span>
            {settings?.personalProfitWalletAddress
              ? `${settings.personalProfitWalletAddress.slice(0, 8)}…`
              : "Carteira dedicada não informada"}
          </span>
        </article>
      </div>

      <div className="br-ops-layout">
        <section className="br-panel br-ops-form-card">
          <div className="br-section-head">
            <div>
              <span className="br-eyebrow">POLÍTICA DE TESOURARIA</span>
              <h2>Destino do lucro distribuível</h2>
            </div>
            <span
              className={`br-ops-state ${settings?.status === "ready" ? "ready" : ""}`}
            >
              {settings?.status === "ready" ? "Configurada" : "Rascunho"}
            </span>
          </div>
          <div className="br-ops-form">
            <label>
              <span>Organização</span>
              <input
                value={organizationName}
                onChange={event => setOrganizationName(event.target.value)}
              />
            </label>
            <label className="wide">
              <span>Carteira Stacks da organização</span>
              <input
                value={wallet}
                onChange={event => setWallet(event.target.value.toUpperCase())}
                placeholder={
                  network === "mainnet" ? "SP… ou SM…" : "ST… ou SN…"
                }
              />
            </label>
            <label className="wide">
              <span>Carteira dedicada da conta pessoal de lucros stBTC</span>
              <input
                value={profitWallet}
                onChange={event =>
                  setProfitWallet(event.target.value.toUpperCase())
                }
                placeholder={
                  network === "mainnet" ? "SP… ou SM…" : "ST… ou SN…"
                }
              />
            </label>
            <label>
              <span>Parceiro BRL → BTC</span>
              <select
                value={conversionPartner}
                onChange={event => setConversionPartner(event.target.value)}
              >
                <option value="not_selected">Ainda não selecionado</option>
                <option value="Binance">Binance · liquidez BTCBRL</option>
                <option value="Bitso Brasil">Bitso Brasil</option>
                <option value="Mercado Bitcoin">Mercado Bitcoin</option>
                <option value="Foxbit">Foxbit</option>
                <option value="Mercado Pago">Mercado Pago · somente Pix</option>
              </select>
            </label>
            <label>
              <span>Status da diligência</span>
              <select
                value={conversionPartnerStatus}
                onChange={event =>
                  setConversionPartnerStatus(
                    event.target.value as typeof conversionPartnerStatus
                  )
                }
              >
                <option value="not_selected">Não iniciado</option>
                <option value="due_diligence">Em diligência</option>
                <option value="contracted">Contrato assinado</option>
                <option value="active">Ativo em produção</option>
              </select>
            </label>
            <label>
              <span>Rede</span>
              <select
                value={network}
                onChange={event =>
                  setNetwork(event.target.value as "testnet" | "mainnet")
                }
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet (somente configuração)</option>
              </select>
            </label>
            <label>
              <span>Ativo do repasse</span>
              <select
                value={asset}
                onChange={event => setAsset(event.target.value as typeof asset)}
              >
                <option value="sBTC">sBTC</option>
                <option value="stBTC">stBTC</option>
                <option value="STX">STX</option>
              </select>
            </label>
            <label>
              <span>Periodicidade</span>
              <select
                value={cadence}
                onChange={event =>
                  setCadence(event.target.value as typeof cadence)
                }
              >
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="daily">Diária</option>
              </select>
            </label>
            <label>
              <span>Aprovação</span>
              <select
                value={approvalMode}
                onChange={event =>
                  setApprovalMode(event.target.value as typeof approvalMode)
                }
              >
                <option value="manual">Manual</option>
                <option value="multisig">Multisig</option>
                <option value="automatic">
                  Automática (bloqueada em sandbox)
                </option>
              </select>
            </label>
            <label>
              <span>Provisão tributária (%)</span>
              <input
                type="number"
                min="0"
                max="50"
                value={taxReserve}
                onChange={event => setTaxReserve(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Reserva operacional (%)</span>
              <input
                type="number"
                min="0"
                max="50"
                value={operationalReserve}
                onChange={event =>
                  setOperationalReserve(Number(event.target.value))
                }
              />
            </label>
          </div>
          <button
            className="br-primary full"
            type="button"
            onClick={submitSettings}
            disabled={saveSettings.isPending}
          >
            {saveSettings.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ShieldCheck size={16} />
            )}{" "}
            Salvar política
          </button>
          <p className="br-dialog-footnote">
            <KeyRound size={13} /> Use uma carteira pública dedicada, diferente
            da operacional. Assinatura real deverá usar cofre de chaves ou
            multisig no backend.
          </p>
          <p className="br-dialog-footnote">
            <ShieldCheck size={13} /> Registrar um parceiro não libera compra
            real. Binance, Bitso Brasil e Mercado Bitcoin seguem em diligência;
            API, conta institucional, autorização regulatória, allowlist de IP e
            reconciliação são gates obrigatórios.
          </p>
        </section>

        <section className="br-panel br-profit-card">
          <span className="br-eyebrow">LUCRO DISTRIBUÍVEL</span>
          <h2>Somente após conciliação e reservas.</h2>
          <div className="br-profit-formula">
            <div>
              <span>Receitas realizadas</span>
              <b>{currency.format(grossRevenue)}</b>
            </div>
            <div>
              <span>Custos de parceiros</span>
              <b>− {currency.format(providerCosts)}</b>
            </div>
            <div>
              <span>Provisão tributária</span>
              <b>− {taxReserve}%</b>
            </div>
            <div>
              <span>Reserva operacional</span>
              <b>− {operationalReserve}%</b>
            </div>
            <div className="total">
              <span>Estimativa distribuível</span>
              <strong>{currency.format(estimatedNet)}</strong>
            </div>
          </div>
          <div className="br-safety-note">
            <ShieldCheck />
            <p>
              <b>Fundos de clientes nunca entram neste cálculo.</b> A
              distribuição usa apenas receita realizada, líquida de custos e
              reservas.
            </p>
          </div>
          <button
            className="br-outline full"
            type="button"
            onClick={createClosing}
            disabled={closePeriod.isPending}
          >
            <RefreshCw size={15} /> Fechar período atual
          </button>
        </section>
      </div>

      <section className="br-panel br-table-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">APROVAÇÕES</span>
            <h2>Repasses simulados</h2>
          </div>
          <span className="br-help-honesty">
            <CheckCircle2 size={15} /> Aprovação explícita
          </span>
        </div>
        {distributions.length === 0 ? (
          <div className="br-ops-empty">Nenhum fechamento criado ainda.</div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Receita</th>
                  <th>Reservas</th>
                  <th>Distribuível</th>
                  <th>Destino</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(item => {
                  const sweep = capitalSweeps.find(
                    entry => entry.profitDistributionId === item.id
                  );
                  return (
                    <tr key={item.id}>
                      <td>
                        <b>{item.periodKey}</b>
                      </td>
                      <td>{currency.format(Number(item.grossRevenueBrl))}</td>
                      <td>
                        {currency.format(
                          Number(item.taxReserveBrl) +
                            Number(item.operationalReserveBrl)
                        )}
                      </td>
                      <td>
                        <b>
                          {currency.format(Number(item.distributableProfitBrl))}
                        </b>
                        <small className="br-asset-estimate">
                          ≈ {item.estimatedAssetAmount} {item.distributionAsset}
                        </small>
                      </td>
                      <td className="mono">
                        {item.stacksWalletAddress
                          ? `${item.stacksWalletAddress.slice(0, 9)}…${item.stacksWalletAddress.slice(-5)}`
                          : "Não configurado"}
                      </td>
                      <td>
                        <span
                          className={`br-ops-state ${item.status === "simulated_sent" ? "ready" : ""}`}
                        >
                          {sweep?.status === "simulated_sent"
                            ? "stBTC simulado"
                            : sweep?.status === "pending_approval"
                              ? "Sweep aguardando"
                              : item.status === "blocked"
                                ? "Bloqueado"
                                : item.status === "pending_approval"
                                  ? "Fechado"
                                  : "Simulado"}
                        </span>
                      </td>
                      <td>
                        {sweep?.status === "pending_approval" ? (
                          <button
                            className="br-small-action"
                            type="button"
                            onClick={() =>
                              approveSweep.mutate({
                                sweepId: sweep.id,
                                comment: "Aprovação administrativa registrada no sandbox.",
                                idempotencyKey: `sweep-approval-${sweep.id}-${item.id}-${user?.id ?? "admin"}`,
                              })
                            }
                          >
                            {approvals.filter(
                              approval => approval.sweepId === sweep.id
                            ).length === 0
                              ? "Registrar 1ª aprovação"
                              : "Registrar 2ª aprovação"}
                          </button>
                        ) : item.status === "pending_approval" &&
                          !sweep &&
                          item.distributionAsset === "stBTC" ? (
                          <button
                            className="br-small-action"
                            type="button"
                            onClick={() =>
                              proposeSweep.mutate({
                                distributionId: item.id,
                                idempotencyKey: `profit-sweep-${item.id}`,
                              })
                            }
                          >
                            Propor stBTC
                          </button>
                        ) : item.status === "pending_approval" && !sweep ? (
                          <span className="br-table-muted">
                            Fechamento em {item.distributionAsset}
                          </span>
                        ) : sweep?.status === "blocked" ? (
                          <span className="br-table-muted">Bloqueado</span>
                        ) : (
                          (sweep?.transactionId ?? item.transactionId ?? "—")
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="br-panel br-profit-account-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">CONTA PESSOAL DE LUCROS · stBTC</span>
            <h2>Capital da organização, separado dos clientes.</h2>
          </div>
          <span className="br-help-honesty">
            <WalletCards size={15} /> {capitalSweeps.length} sweeps
          </span>
        </div>
        <div className="br-profit-account-grid">
          <div>
            <small>Origem</small>
            <b>organization_distributable_profit_brl</b>
            <span>Receita realizada − custos − reservas</span>
          </div>
          <div>
            <small>Rota metodológica</small>
            <b>BRL → BTC → sBTC → stBTC</b>
            <span>Conversão com cotação registrada e slippage de 0,50%</span>
          </div>
          <div>
            <small>Destino contábil</small>
            <b>owner_personal_profit_stbtc</b>
            <span>Carteira pública configurada; nunca o saldo do cliente</span>
          </div>
        </div>
        {capitalSweeps.length === 0 ? (
          <div className="br-ops-empty">
            Feche um período e proponha um sweep para criar a primeira trilha de
            lucro em stBTC.
          </div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Criado</th>
                  <th>Origem BRL</th>
                  <th>Estimativa</th>
                  <th>Mínimo protegido</th>
                  <th>Cotação</th>
                  <th>Aprovações</th>
                  <th>Rede</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {capitalSweeps.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                    <td>
                      <b>{currency.format(Number(item.sourceAmountBrl))}</b>
                    </td>
                    <td className="mono">{item.estimatedAssetAmount} stBTC</td>
                    <td className="mono">{item.minimumAssetAmount} stBTC</td>
                    <td>
                      <b>{item.quoteStatus === "consumed" ? "Consumida" : item.quoteStatus === "active" ? "Ativa" : "Expirada"}</b>
                      <small className="br-table-muted">
                        {item.quoteExpiresAt
                          ? new Date(item.quoteExpiresAt).toLocaleTimeString("pt-BR")
                          : "Sem validade"}
                      </small>
                    </td>
                    <td>
                      <b>
                        {approvals.filter(approval => approval.sweepId === item.id).length}/
                        {item.approvalRequired}
                      </b>
                      <small className="br-table-muted">Administradores distintos</small>
                    </td>
                    <td>{item.network}</td>
                    <td>
                      <span
                        className={`br-ops-state ${item.status === "simulated_sent" ? "ready" : ""}`}
                      >
                        {item.status === "blocked"
                          ? "Bloqueado"
                          : item.status === "pending_approval"
                            ? "Aguardando aprovação"
                            : "Simulado"}
                      </span>
                      {item.blockerReason && item.status === "blocked" && (
                        <small className="br-table-muted">
                          {item.blockerReason}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="br-safety-note">
          <ShieldCheck />
          <p>
            <b>Gate de produção:</b> esta conta só poderá receber stBTC real com
            bridge/issuer verificável, liquidez, cotação assinada, cofre ou
            multisig, dupla aprovação e reconciliação independente.
          </p>
        </div>
      </section>

      <section className="br-panel br-table-card br-btc-liquidity-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">LIQUIDEZ E TRILHA ON-CHAIN</span>
            <h2>Binance BTCBRL → Stacks</h2>
            <p>Binance serve somente à liquidez BTCBRL institucional. O endereço público Stacks do cliente e os passos sBTC/stBTC ficam separados e auditáveis.</p>
          </div>
          <span className="br-help-honesty"><Bitcoin size={15} /> {btcLiquiditySettlements.length} liquidações</span>
        </div>
        {btcLiquiditySettlements.length === 0 ? (
          <div className="br-ops-empty">Nenhuma compra chegou à trilha de liquidez ainda.</div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead><tr><th>Compra</th><th>Liquidez</th><th>BTC</th><th>Rede</th><th>Próxima etapa</th><th>Referência</th></tr></thead>
              <tbody>{btcLiquiditySettlements.slice(0, 20).map(item => (
                <tr key={item.id}>
                  <td>#{item.purchaseId}<span className="br-table-muted">cliente #{item.userId}</span></td>
                  <td><b>{item.provider === "binance" ? "Binance" : "Binance sandbox"}</b><span className="br-table-muted">{currency.format(Number(item.amountBrl))}</span></td>
                  <td className="mono">₿ {item.btcAmount}</td>
                  <td>{item.network}</td>
                  <td><span className={`br-ops-state ${item.status === "confirmed" ? "ready" : item.status === "blocked" || item.status === "failed" ? "warning" : ""}`}>{item.status === "stacks_pending" ? "Aguardando Stacks" : item.status === "blocked" ? "Carteira necessária" : item.status}</span><span className="br-table-muted">{item.blockerReason || item.failureReason || "Preflight Stacks antes da próxima transmissão."}</span></td>
                  <td className="mono">{item.stacksTxId || item.externalOrderId || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="br-dialog-footnote"><ShieldCheck size={13} /> Nenhum saque Binance é automatizado. O modo real segue bloqueado sem secrets, allowlist de IP, conta institucional aprovada, execução reconciliada e política de assinatura Stacks.</p>
      </section>
      <section className="br-panel br-reconciliation-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">CONTROLE DIÁRIO</span>
            <h2>Reconciliação diária</h2>
          </div>
          <div className="br-reconciliation-actions">
            {!settings?.dailyReconciliationTaskUid ? (
              <button
                className="br-small-action"
                type="button"
                onClick={() => enableDailyReconciliation.mutate()}
                disabled={enableDailyReconciliation.isPending}
              >
                {enableDailyReconciliation.isPending ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
                Ativar diariamente
              </button>
            ) : (
              <span className="br-ops-state ready">Diária ativada</span>
            )}
            <button
              className="br-outline"
              type="button"
              onClick={() => reconcileDaily.mutate({})}
              disabled={reconcileDaily.isPending}
            >
              {reconcileDaily.isPending ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <RefreshCw size={15} />
              )}
              Conferir hoje
            </button>
          </div>
        </div>
        <p className="br-dialog-footnote">
          Confere lançamentos do dia, aprovações, cotação ativa e os dois lados
          do ledger do sweep. Uma divergência impede qualquer evolução para
          produção.
        </p>
        {reconciliations.length === 0 ? (
          <div className="br-ops-empty">Nenhuma reconciliação executada ainda.</div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Lançamentos</th>
                  <th>Sweeps</th>
                  <th>Divergências</th>
                  <th>Conferido em</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.slice(0, 10).map(item => (
                  <tr key={item.id}>
                    <td className="mono">{item.dateKey}</td>
                    <td>
                      <span
                        className={`br-ops-state ${item.status === "balanced" ? "ready" : ""}`}
                      >
                        {item.status === "balanced" ? "Sem divergências" : "Atenção"}
                      </span>
                    </td>
                    <td>{item.totalLedgerEntries}</td>
                    <td>
                      {item.approvedSweepCount} aprovados · {item.pendingSweepCount} pendentes
                    </td>
                    <td>{item.exceptions ? "Revisar" : "—"}</td>
                    <td>{new Date(item.reconciledAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">DEPÓSITOS VIA PIX</span>
            <h2>Cobranças e conciliação</h2>
          </div>
          <span className="br-help-honesty">
            <ArrowRight size={15} /> {pixDeposits.length} registros
          </span>
        </div>
        {pixDeposits.length === 0 ? (
          <div className="br-ops-empty">
            Nenhum depósito Pix registrado ainda.
          </div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Valor BRL</th>
                  <th>Status</th>
                  <th>Cobrança</th>
                  <th>EndToEndId</th>
                </tr>
              </thead>
              <tbody>
                {pixDeposits.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                    <td>#{item.userId}</td>
                    <td>
                      <b>{currency.format(Number(item.amountBrl))}</b>
                    </td>
                    <td>
                      <span
                        className={`br-ops-state ${item.status === "paid" ? "ready" : ""}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="mono">{item.providerReference || "—"}</td>
                    <td className="mono">{item.endToEndId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">RESGATES VIA PIX</span>
            <h2>Fila operacional e reconciliação</h2>
          </div>
          <span className="br-help-honesty">
            <Landmark size={15} /> {redemptions.length} solicitações
          </span>
        </div>
        {redemptions.length === 0 ? (
          <div className="br-ops-empty">Nenhum resgate solicitado ainda.</div>
        ) : (
          <div className="br-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>BTC</th>
                  <th>Líquido BRL</th>
                  <th>Etapa</th>
                  <th>Status</th>
                  <th>Referência Pix</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map(item => (
                  <tr key={item.id}>
                    <td>
                      {new Date(item.requestedAt).toLocaleString("pt-BR")}
                    </td>
                    <td>#{item.userId}</td>
                    <td className="mono">{item.btcAmount}</td>
                    <td>{currency.format(Number(item.netBrl))}</td>
                    <td>{item.stage}</td>
                    <td>
                      <span
                        className={`br-ops-state ${item.status === "settled" ? "ready" : ""}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="mono">{item.pixEndToEndId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="br-panel br-table-card">
        <div className="br-section-head">
          <div>
            <span className="br-eyebrow">LEDGER</span>
            <h2>Trilha contábil persistida</h2>
          </div>
          <span>{entries.length} lançamentos</span>
        </div>
        <div className="br-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Conta</th>
                <th>Direção</th>
                <th>Valor</th>
                <th>Chave idempotente</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("pt-BR")}</td>
                  <td>{entry.entryType}</td>
                  <td>{entry.account}</td>
                  <td>{entry.direction}</td>
                  <td>
                    {entry.currency} {entry.amount}
                  </td>
                  <td className="mono">{entry.idempotencyKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="br-ops-footer">
        <Bitcoin size={17} />
        <span>
          Política configurada: 100% do <b>lucro distribuível</b> pode seguir
          para a conta dedicada em stBTC — nunca o principal do cliente.
        </span>
        <Banknote size={17} />
      </footer>
      <RendeBitFooter />
    </div>
  );
}
