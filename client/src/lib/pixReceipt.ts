export type PixReceiptInput = {
  id: number;
  amountBrl: string;
  status:
    | "created"
    | "awaiting_payment"
    | "paid"
    | "expired"
    | "cancelled"
    | "manual_review";
  providerReference: string | null;
  endToEndId: string | null;
  paidAt: Date | string | null;
  createdAt: Date | string;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function pdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/([\\()])/g, "\\$1");
}

export function createPixReceiptPdf(deposit: PixReceiptInput) {
  const issuedAt = new Date(deposit.paidAt ?? deposit.createdAt).toLocaleString(
    "pt-BR"
  );
  const status =
    deposit.status === "paid"
      ? "Pagamento confirmado no sandbox"
      : deposit.status === "awaiting_payment"
        ? "Pix aguardando pagamento"
        : `Status: ${deposit.status}`;
  const lines = [
    "RENDEBIT  |  PIX",
    "Comprovante demonstrativo de deposito",
    "",
    `Valor: ${currency.format(Number(deposit.amountBrl))}`,
    `Status: ${status}`,
    `Emitido em: ${issuedAt}`,
    `Referencia do provedor: ${deposit.providerReference ?? "Aguardando confirmacao"}`,
    `End-to-end ID: ${deposit.endToEndId ?? "Aguardando webhook"}`,
    "",
    "Este documento e demonstrativo. Nenhum Pix real foi movimentado.",
    "A confirmacao depende de webhook assinado e conciliacao do parceiro Pix.",
  ];
  const commands = ["BT", "/F1 20 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push(`0 -${index === 1 ? 34 : 25} Td`);
    commands.push(
      `/F1 ${index === 0 ? 20 : index === 1 ? 12 : 10} Tf (${pdfText(line)}) Tj`
    );
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets[index] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
