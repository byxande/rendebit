import { useEffect, useState } from "react";
import { ArrowUpRight, Bitcoin, ExternalLink, Landmark, LifeBuoy, Mail, QrCode, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

type FooterTarget = "inicio" | "depositar" | "rendimento" | "mercado" | "simulador" | "lotes" | "resgate" | "fiscal" | "reservas" | "empresas" | "ajuda";

type FooterProps = {
  onNavigate?: (target: FooterTarget) => void;
  variant?: "product" | "portfolio";
};

type FooterLink = {
  label: string;
  target?: FooterTarget;
  href?: string;
  soon?: boolean;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const footerColumns: FooterColumn[] = [
  {
    title: "Pessoal",
    links: [
      { label: "Visão geral", target: "inicio" },
      { label: "Depositar via Pix", target: "depositar" },
      { label: "Comprar Bitcoin", target: "depositar" },
      { label: "Simular o futuro", target: "simulador" },
      { label: "Meus aportes", target: "lotes" },
      { label: "Receber via Pix", target: "resgate" },
    ],
  },
  {
    title: "Mercado",
    links: [
      { label: "Mercado BTC", target: "mercado" },
      { label: "Rendimentos", target: "rendimento" },
      { label: "Cotação BTC/BRL", target: "mercado" },
      { label: "Histórico do Bitcoin", target: "mercado" },
      { label: "Reservas", target: "reservas" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Para empresas", target: "empresas" },
      { label: "White-label", target: "empresas" },
      { label: "Integrações Pix", target: "empresas" },
      { label: "Fale com a equipe", soon: true },
      { label: "Central de ajuda", target: "ajuda" },
    ],
  },
  {
    title: "Jurídico",
    links: [
      { label: "Termos de serviço", soon: true },
      { label: "Política de privacidade", soon: true },
      { label: "Política de cookies", soon: true },
      { label: "Relatório fiscal", target: "fiscal" },
      { label: "Informações de risco", target: "ajuda" },
    ],
  },
];

function AppBadge({ store, onClick }: { store: "App Store" | "Google Play"; onClick: () => void }) {
  return (
    <button className="rendebit-footer-app-badge" type="button" onClick={onClick} aria-label={`${store}, disponível em breve`}>
      <span className="rendebit-footer-app-icon">{store === "App Store" ? "●" : "▶"}</span>
      <span><small>{store === "App Store" ? "Disponível na" : "Baixe no"}</small><b>{store}</b></span>
    </button>
  );
}

function FooterLinkItem({ link, onNavigate }: { link: FooterLink; onNavigate?: FooterProps["onNavigate"] }) {
  const handleSoon = () => toast.info("Em breve na RendeBit", { description: "Estamos preparando esta área com o mesmo cuidado." });
  if (link.soon) {
    return <button type="button" className="rendebit-footer-link" onClick={handleSoon}>{link.label}</button>;
  }
  if (link.target && onNavigate) {
    return <button type="button" className="rendebit-footer-link" onClick={() => onNavigate(link.target!)}>{link.label}</button>;
  }
  if (link.target) {
    return <a className="rendebit-footer-link" href={link.target === "inicio" ? "/" : `/?view=${link.target}`}>{link.label}</a>;
  }
  return <a className="rendebit-footer-link" href={link.href ?? "/"}>{link.label}</a>;
}

export default function RendeBitFooter({ onNavigate, variant = "product" }: FooterProps) {
  const [email, setEmail] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const destination = typeof window === "undefined" ? "https://stackfolio-leon65cb.manus.space/" : window.location.origin;
    void QRCode.toDataURL(destination, { width: 150, margin: 1, color: { dark: "#2a211b", light: "#fffaf2" } }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, []);

  function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Confira seu e-mail", { description: "Digite um endereço válido para receber as novidades." });
      return;
    }
    toast.success("E-mail anotado", { description: "A lista de novidades da RendeBit será conectada em uma próxima etapa." });
    setEmail("");
  }

  const footerClass = `rendebit-footer rendebit-footer--${variant}`;

  return (
    <footer className={footerClass}>
      <div className="rendebit-footer-top">
        <section className="rendebit-footer-newsletter">
          <span className="rendebit-footer-kicker">RENDEBIT / EM PORTUGUÊS</span>
          <h2>Receba atualizações, insights e relatórios sobre as últimas tendências do Bitcoin.</h2>
          <form onSubmit={subscribe}>
            <label className="sr-only" htmlFor={`footer-email-${variant}`}>Seu e-mail</label>
            <input id={`footer-email-${variant}`} value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Informe seu e-mail" autoComplete="email" />
            <button type="submit">Assinar <Mail size={16} /></button>
          </form>
        </section>
        <section className="rendebit-footer-app">
          <div>
            <span className="rendebit-footer-kicker">EXPERIÊNCIA MOBILE</span>
            <h2>Leve a RendeBit com você no dia a dia.</h2>
            <p>Escaneie para abrir a experiência web. O aplicativo nativo está em preparação.</p>
          </div>
          <div className="rendebit-footer-app-download">
            <div className="rendebit-footer-qr">{qrDataUrl ? <img src={qrDataUrl} alt="QR Code para abrir a RendeBit" /> : <QrCode size={76} />}</div>
            <div className="rendebit-footer-badges">
              <AppBadge store="App Store" onClick={() => toast.info("Aplicativo iOS em breve", { description: "Por enquanto, você pode abrir a RendeBit pelo navegador." })} />
              <AppBadge store="Google Play" onClick={() => toast.info("Aplicativo Android em breve", { description: "Por enquanto, você pode abrir a RendeBit pelo navegador." })} />
            </div>
          </div>
        </section>
      </div>

      <div className="rendebit-footer-trust" aria-label="Compromissos da RendeBit">
        <div><LifeBuoy size={26} strokeWidth={1.4} /><span><b>Suporte em português</b><small>Ajuda clara para a sua jornada</small></span></div>
        <div><Landmark size={26} strokeWidth={1.4} /><span><b>Operação transparente</b><small>Ambiente demonstrativo e rastreável</small></span></div>
        <div><ShieldCheck size={26} strokeWidth={1.4} /><span><b>Segurança por design</b><small>Controles e dados tratados com cuidado</small></span></div>
      </div>

      <div className="rendebit-footer-links">
        {footerColumns.map((column) => <section key={column.title}><h3>{column.title}</h3>{column.links.map((link) => <FooterLinkItem key={link.label} link={link} onNavigate={onNavigate} />)}</section>)}
        <section className="rendebit-footer-network"><h3>Stacks</h3><a className="rendebit-footer-link" href="https://docs.stacks.co" target="_blank" rel="noreferrer">Documentação <ExternalLink size={12} /></a><a className="rendebit-footer-link" href="https://explorer.hiro.so" target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a><a className="rendebit-footer-link" href="/portfolio">Portfolio on-chain</a><div className="rendebit-footer-social-label">Siga a RendeBit</div><div className="rendebit-footer-social"><button type="button" aria-label="RendeBit no X" onClick={() => toast.info("Perfil no X em breve")}>𝕏</button><button type="button" aria-label="RendeBit no YouTube" onClick={() => toast.info("Canal no YouTube em breve")}>▶</button><button type="button" aria-label="RendeBit no Instagram" onClick={() => toast.info("Perfil no Instagram em breve")}>◎</button></div></section>
      </div>

      <div className="rendebit-footer-bottom"><span><Bitcoin size={14} /> RendeBit — Bitcoin em reais</span><span>Feita para residentes no Brasil · © 2026</span></div>
    </footer>
  );
}

export type { FooterTarget };
