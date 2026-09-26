import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";

const toPdfText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\\()]/g, (character) => `\\${character}`);

const createPdf = (lines: string[]) => {
  const content = [
    "BT",
    "/F1 20 Tf",
    "50 790 Td",
    `(${toPdfText("Synoflow")}) Tj`,
    "/F1 16 Tf",
    "0 -34 Td",
    `(${toPdfText("Payment Statement")}) Tj`,
    "/F1 10 Tf",
    ...lines.flatMap((line) => ["0 -22 Td", `(${toPdfText(line)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ];

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "ascii"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "ascii");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");

  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(chunks.join(""), "ascii");
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);

const sendPaymentStatement = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      transactionId: true,
      provider: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          name: true,
          subscription: {
            select: {
              plan: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
            },
          },
        },
      },
    },
  });

  if (!payment || payment.status !== "SUCCESS") {
    return { sent: false, reason: "payment_not_successful" } as const;
  }

  const subscription = payment.organization.subscription;
  const period =
    subscription?.currentPeriodStart && subscription.currentPeriodEnd
      ? `${formatDate(subscription.currentPeriodStart)} - ${formatDate(subscription.currentPeriodEnd)}`
      : "Not available";

  const lines = [
    "",
    "Payment Information",
    `Payment ID: ${payment.id}`,
    `Transaction ID: ${payment.transactionId}`,
    "Payment Status: SUCCESS",
    `Payment Method: ${payment.provider}`,
    `Payment Date: ${formatDate(payment.createdAt)}`,
    "",
    "Customer Information",
    `Name: ${payment.user.name}`,
    `Email: ${payment.user.email}`,
    "",
    "Organization",
    `Organization: ${payment.organization.name}`,
    "",
    "Subscription",
    `Plan: ${subscription?.plan ?? "Not available"}`,
    `Billing Period: ${period}`,
    "",
    `Payment Amount: ${payment.amount.toString()} ${payment.currency}`,
    "",
    "Thank you for using Synoflow.",
    "This is a system-generated payment statement.",
  ];

  const pdf = createPdf(lines);

  await transporter.sendMail({
    from: `"Synoflow" <${config.email_sender}>`,
    to: payment.user.email,
    subject: `Synoflow Payment Statement - ${subscription?.plan ?? "Payment"}`,
    text: [
      `Hello ${payment.user.name},`,
      "",
      `Your payment for the Synoflow ${subscription?.plan ?? "subscription"} subscription has been successfully completed.`,
      `Payment ID: ${payment.id}`,
      `Transaction ID: ${payment.transactionId}`,
      `Amount: ${payment.amount.toString()} ${payment.currency}`,
      `Payment Date: ${formatDate(payment.createdAt)}`,
      "",
      "Please find your payment statement attached to this email.",
      "",
      "Thank you for using Synoflow.",
      "",
      "Regards,",
      "Synoflow Team",
    ].join("\n"),
    attachments: [
      {
        filename: `synoflow-payment-statement-${payment.id}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return { sent: true, paymentId: payment.id } as const;
};

export const PaymentStatementService = {
  createPdf,
  sendPaymentStatement,
};
