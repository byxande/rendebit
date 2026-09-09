import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Check,
  CircleDollarSign,
  FileCheck2,
  Gauge,
  Globe2,
  Landmark,
  LockKeyhole,
  Network,
  PieChart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
  Webhook,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BusinessTab = "private" | "corporativo" | "white-label";

type BusinessTabItem = {
  id: BusinessTab;
  label: string;
  kicker: string;
  icon: typeof UsersRound;
};

const tabs: BusinessTabItem[] = [
  {
    id: "private",
    label: "Private",
    kicker: "Patrimônio e família",
    icon: UsersRound,
  },
  {
    id: "corporativo",
    label: "Corporativo",
    kicker: "Tesouraria e equipes",
    icon: Building2,
  },
  {
    id: "white-label",
    label: "White-label",
    kicker: "Sua marca, nossa infraestrutura",
    icon: Globe2,
  },
];

const tabCopy: Record<
  BusinessTab,
  { eyebrow: string; title: string; description: string }
> = {
  private: {
    eyebrow: "SOLUÇÕES PARA PRIVATE",
    title: "Uma visão patrimonial que conversa com o cliente e com o contador.",
    description:
      "Organize posições em Bitcoin, lotes, rendimentos estimados e resgates em reais com uma experiência feita para famílias, escritórios e assessorias Private.",
  },
  corporativo: {
    eyebrow: "SOLUÇÕES CORPORATIVAS",
    title: "Bitcoin em reais, com governança para a rotina da empresa.",
    description:
      "Dê contexto para a tesouraria, defina permissões, acompanhe liquidez e consolide relatórios sem transformar cada operação em um projeto de infraestrutura.",
  },
  "white-label": {
    eyebrow: "RENDEBIT WHITE-LABEL B2B",
    title: "Lance uma experiência de patrimônio digital com o seu nome.",
    description:
      "A RendeBit entrega a camada de produto, APIs, Pix e controles operacionais para fintechs, exchanges, bancos digitais e plataformas de benefícios.",
  },
};

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  tag,
}: {
  icon: typeof UsersRound;
  eyebrow: string;
  title: string;
  text: string;
  tag: string;
}) {
  return (
    <article className="br-business-feature">
      <div className="br-business-feature-icon">
        <Icon size={19} />
      </div>
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <b>{tag}</b>
    </article>
  );
}

function PrivateTab() {
  return (
    <div className="br-business-tab-content">
      <div className="br-business-intro">
        <span className="br-eyebrow">{tabCopy.private.eyebrow}</span>
        <h2>{tabCopy.private.title}</h2>
        <p>{tabCopy.private.description}</p>
      </div>
      <div className="br-business-feature-grid">
        <FeatureCard
          icon={PieChart}
          eyebrow="VISÃO CONSOLIDADA"
          title="Painel por família e por cliente"
          text="Veja patrimônio, exposição em BTC, valor em BRL e distribuição por lote em uma leitura que não exige conhecimento técnico."
          tag="Conta, família ou carteira"
        />
        <FeatureCard
          icon={ReceiptText}
          eyebrow="CONTABILIDADE"
          title="Lotes e relatório fiscal"
          text="Organize custo, aportes, resgates, taxas e referências para compartilhar com o cliente e seu contador."
          tag="Exportação preparada"
        />
        <FeatureCard
          icon={ShieldCheck}
          eyebrow="GOVERNANÇA"
          title="Permissões e custódia segregada"
          text="Separe quem consulta, quem aprova e quem executa. A política operacional fica visível e auditável."
          tag="Acesso por função"
        />
      </div>
      <div className="br-business-split-card">
        <div>
          <span className="br-eyebrow">JORNADA PRIVATE</span>
          <h3>
            Menos ruído operacional. Mais tempo para a conversa patrimonial.
          </h3>
          <p>
            O cliente acompanha a posição em reais; o time Private acessa as
            camadas de lotes, liquidez e eventos quando precisar.
          </p>
          <button
            className="br-outline"
            type="button"
            onClick={() =>
              toast.info("Demonstração Private em preparação", {
                description:
                  "A equipe pode apresentar a jornada no ambiente demonstrativo.",
              })
            }
          >
            Ver jornada demonstrativa <ArrowRight size={15} />
          </button>
        </div>
        <div className="br-business-stack-visual">
          <div>
            <UsersRound />
            <span>Família</span>
            <b>3 perfis</b>
          </div>
          <div>
            <WalletCards />
            <span>Patrimônio</span>
            <b>BRL + BTC</b>
          </div>
          <div>
            <FileCheck2 />
            <span>Relatório</span>
            <b>Pronto para compartilhar</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function CorporateTab() {
  return (
    <div className="br-business-tab-content">
      <div className="br-business-intro">
        <span className="br-eyebrow">{tabCopy.corporativo.eyebrow}</span>
        <h2>{tabCopy.corporativo.title}</h2>
        <p>{tabCopy.corporativo.description}</p>
      </div>
      <div className="br-business-feature-grid">
        <FeatureCard
          icon={Landmark}
          eyebrow="TESOURARIA"
          title="Políticas para caixa estratégico"
          text="Configure limites, periodicidade, aprovação e carteira de destino sem misturar o principal dos clientes com a receita da operação."
          tag="Política configurável"
        />
        <FeatureCard
          icon={UsersRound}
          eyebrow="EQUIPES"
          title="Acesso por área e responsabilidade"
          text="Direcione uma visão para financeiro, compliance, atendimento e liderança com o nível de detalhe certo para cada pessoa."
          tag="Papéis e permissões"
        />
        <FeatureCard
          icon={Gauge}
          eyebrow="GESTÃO"
          title="Indicadores que ajudam a decidir"
          text="Acompanhe captação, saldo aplicado, resgates, custos de parceiro e eventos relevantes em uma rotina de gestão simples."
          tag="Painel operacional"
        />
      </div>
      <div className="br-business-corporate-grid">
        <article className="br-panel">
          <Banknote />
          <span>Entradas e saídas em BRL</span>
          <b>Pix com conciliação</b>
          <small>Do primeiro depósito ao relatório de liquidação.</small>
        </article>
        <article className="br-panel">
          <LockKeyhole />
          <span>Controle financeiro</span>
          <b>Segregação por finalidade</b>
          <small>
            Cliente, operação, reservas e distribuição com trilha própria.
          </small>
        </article>
        <article className="br-panel">
          <Network />
          <span>Integração</span>
          <b>API e webhooks</b>
          <small>
            Eventos normalizados para os sistemas que sua empresa já usa.
          </small>
        </article>
      </div>
      <div className="br-business-note">
        <Sparkles size={17} />
        <p>
          <b>Para quem precisa começar com cuidado:</b> a implantação pode
          iniciar em ambiente demonstrativo, com dados de teste e aprovação
          manual antes de qualquer discussão de produção.
        </p>
      </div>
    </div>
  );
}

function WhiteLabelTab({ onRequest }: { onRequest: () => void }) {
  const modules = [
    {
      icon: Globe2,
      title: "Experiência com a sua marca",
      text: "Nome, domínio, cores e mensagens para a jornada do seu cliente.",
    },
    {
      icon: Network,
      title: "API de patrimônio",
      text: "Quotes, posições, lotes, resgates e eventos em contratos claros.",
    },
    {
      icon: Webhook,
      title: "Webhooks e conciliação",
      text: "Atualizações assinadas para pagamentos, KYC, custódia e rendimento.",
    },
    {
      icon: ShieldCheck,
      title: "Governança operacional",
      text: "Papéis, limites, aprovações, ledger e carteira organizacional.",
    },
  ];
  return (
    <div className="br-business-tab-content br-white-label-content">
      <div className="br-business-intro">
        <span className="br-eyebrow">{tabCopy["white-label"].eyebrow}</span>
        <h2>{tabCopy["white-label"].title}</h2>
        <p>{tabCopy["white-label"].description}</p>
      </div>
      <div className="br-white-label-layout">
        <section className="br-white-label-console">
          <div className="br-white-label-console-head">
            <div>
              <span className="br-eyebrow light">RENDEBIT PLATFORM</span>
              <b>private-bank.br</b>
            </div>
            <span className="br-white-label-live">
              <i /> SANDBOX
            </span>
          </div>
          <div className="br-white-label-console-body">
            <div className="br-white-label-mini-nav">
              <span className="active">Overview</span>
              <span>Clientes</span>
              <span>Liquidez</span>
              <span>Relatórios</span>
            </div>
            <div className="br-white-label-console-main">
              <span className="br-eyebrow">PATRIMÔNIO CONSOLIDADO</span>
              <strong>R$ 8.420.560,00</strong>
              <div className="br-white-label-metrics">
                <span>
                  <small>Clientes ativos</small>
                  <b>126</b>
                </span>
                <span>
                  <small>BTC sob acompanhamento</small>
                  <b>4,82 BTC</b>
                </span>
                <span>
                  <small>Eventos hoje</small>
                  <b>18</b>
                </span>
              </div>
              <div className="br-white-label-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </section>
        <div className="br-white-label-module-list">
          {modules.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <div>
                <Icon size={18} />
              </div>
              <span>
                <b>{title}</b>
                <small>{text}</small>
              </span>
              <Check size={15} />
            </article>
          ))}
        </div>
      </div>
      <div className="br-white-label-api">
        <div className="br-code-head">
          <span />
          <span />
          <span />
          <b>POST /v1/portfolios/quote</b>
        </div>
        <pre>{`{
  "brand": "sua-marca",
  "settlement": "BRL_PIX",
  "client_scope": "private",
  "webhook": "signed"
}`}</pre>
        <div className="br-api-result">
          <Check /> Contrato pronto para sandbox
        </div>
      </div>
      <div className="br-white-label-roadmap">
        <div>
          <span className="br-eyebrow">IMPLANTAÇÃO MODULAR</span>
          <h3>Da primeira conversa ao piloto com sua marca.</h3>
        </div>
        <div className="br-white-label-steps">
          <div className="active">
            <b>01</b>
            <span>Descoberta</span>
            <small>Produto, compliance e jornada</small>
          </div>
          <div>
            <b>02</b>
            <span>Integração</span>
            <small>API, webhooks e identidade</small>
          </div>
          <div>
            <b>03</b>
            <span>Piloto</span>
            <small>Grupo controlado em sandbox</small>
          </div>
          <div>
            <b>04</b>
            <span>Escala</span>
            <small>Operação e suporte contínuos</small>
          </div>
        </div>
      </div>
      <div className="br-business-cta">
        <div>
          <span className="br-eyebrow">
            PARA FINTECHS, EXCHANGES E BANCOS DIGITAIS
          </span>
          <h3>Vamos desenhar uma RendeBit com a sua cara?</h3>
          <p>
            Conte o que você já tem, o que quer lançar e quais controles são
            indispensáveis para o seu negócio.
          </p>
        </div>
        <button className="br-primary" type="button" onClick={onRequest}>
          Solicitar conversa B2B <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function BusinessSolutions() {
  const [activeTab, setActiveTab] = useState<BusinessTab>("private");
  const [contactOpen, setContactOpen] = useState(false);
  const [sent, setSent] = useState(false);

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
    toast.success("Pedido registrado no sandbox", {
      description:
        "A próxima etapa é conectar este formulário ao CRM comercial.",
    });
  }

  return (
    <div className="br-stack br-business-page">
      <section className="br-business-hero">
        <div>
          <span className="br-eyebrow light">
            RENDEBIT PARA EMPRESAS BRASILEIRAS
          </span>
          <h1>Patrimônio digital com a experiência que sua marca merece.</h1>
          <p>
            Uma camada de produto para clientes Private e corporativos — com
            Bitcoin, BRL, Pix, relatórios e governança em uma jornada simples.
          </p>
          <div className="br-business-actions">
            <button
              className="br-primary light"
              type="button"
              onClick={() => setContactOpen(true)}
            >
              Quero conversar <ArrowRight />
            </button>
            <button
              className="br-secondary light"
              type="button"
              onClick={() => setActiveTab("white-label")}
            >
              Conhecer white-label <Globe2 size={16} />
            </button>
          </div>
        </div>
        <div className="br-business-hero-side">
          <div className="br-business-hero-stat">
            <span>MODELO B2B</span>
            <strong>
              Private +<br />
              corporativo
            </strong>
            <small>Uma infraestrutura, várias experiências.</small>
          </div>
          <div className="br-api-visual">
            <div className="br-code-head">
              <span />
              <span />
              <span />
              <b>POST /v1/portfolios/quote</b>
            </div>
            <pre>{`{
  "settlement": "BRL_PIX",
  "client_scope": "private",
  "brand": "sua-marca"
}`}</pre>
            <div className="br-api-result">
              <Check /> Sandbox conectado
            </div>
          </div>
        </div>
      </section>
      <div className="br-business-proof-row">
        <span>
          <BadgeCheck /> Feita para o Brasil
        </span>
        <span>
          <ShieldCheck /> Patrimônio organizado
        </span>
        <span>
          <Webhook /> Eventos integráveis
        </span>
        <span>
          <LockKeyhole /> Governança por função
        </span>
      </div>
      <div
        className="br-business-tabs"
        role="tablist"
        aria-label="Soluções para empresas"
      >
        {tabs.map(({ id, label, kicker, icon: Icon }) => (
          <button
            key={id}
            className={activeTab === id ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            <span>
              <Icon size={17} />
            </span>
            <b>{label}</b>
            <small>{kicker}</small>
          </button>
        ))}
      </div>
      {activeTab === "private" && <PrivateTab />}
      {activeTab === "corporativo" && <CorporateTab />}
      {activeTab === "white-label" && (
        <WhiteLabelTab onRequest={() => setContactOpen(true)} />
      )}
      <section className="br-partner-strip br-business-footer-cta">
        <div>
          <span className="br-eyebrow">PRONTO PARA CONSTRUIR?</span>
          <h2>Seu produto. Nossa infraestrutura de patrimônio em Bitcoin.</h2>
        </div>
        <div className="br-partner-types">
          <span>
            <Building2 /> Fintechs
          </span>
          <span>
            <CircleDollarSign /> Exchanges
          </span>
          <span>
            <Landmark /> Tesourarias
          </span>
        </div>
        <button
          className="br-outline"
          type="button"
          onClick={() => setContactOpen(true)}
        >
          Falar com especialista <ArrowRight size={15} />
        </button>
      </section>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="br-confirm-dialog br-business-dialog">
          <button
            className="br-dialog-close"
            type="button"
            onClick={() => setContactOpen(false)}
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
          {sent ? (
            <div className="br-business-success">
              <div className="br-success-icon">
                <Check />
              </div>
              <span className="br-eyebrow">PEDIDO RECEBIDO</span>
              <h2>Obrigado por abrir essa conversa.</h2>
              <p>
                O formulário é demonstrativo nesta fase. A estrutura já está
                pronta para receber o CRM e a agenda comercial da RendeBit.
              </p>
              <button
                className="br-primary full"
                type="button"
                onClick={() => {
                  setSent(false);
                  setContactOpen(false);
                }}
              >
                Voltar para soluções B2B
              </button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Vamos desenhar sua operação B2B</DialogTitle>
                <DialogDescription>
                  Conte um pouco sobre a empresa. Neste sandbox, nenhum contato
                  externo será enviado.
                </DialogDescription>
              </DialogHeader>
              <form
                className="br-business-contact-form"
                onSubmit={submitContact}
              >
                <label>
                  <span>Nome</span>
                  <input name="name" required placeholder="Seu nome" />
                </label>
                <label>
                  <span>E-mail corporativo</span>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="voce@empresa.com.br"
                  />
                </label>
                <label>
                  <span>Empresa</span>
                  <input
                    name="company"
                    required
                    placeholder="Nome da empresa"
                  />
                </label>
                <label>
                  <span>O que você quer lançar?</span>
                  <select name="interest" defaultValue={activeTab}>
                    <option value="private">
                      Solução para clientes Private
                    </option>
                    <option value="corporativo">Solução corporativa</option>
                    <option value="white-label">White-label B2B</option>
                  </select>
                </label>
                <button className="br-primary full" type="submit">
                  Enviar interesse <ArrowRight size={16} />
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
