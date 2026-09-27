import PDFDocument from "pdfkit";
import type { SubscriptionPlan } from "../../generated/prisma/enums";

export interface InvoiceData {
	invoiceNumber: string;
	organizationName: string;
	customerName: string;
	plan?: SubscriptionPlan;
	amount: number;
	currency: string;
	paidAt: Date;
	transactionId: string;
}

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: "A4", margin: 50 });
		const chunks: Buffer[] = [];

		doc.on("data", (chunk) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		doc.fontSize(20).text("Invoice", { align: "right" });
		doc.moveDown(0.5);

		doc
			.fontSize(10)
			.text(`Invoice #: ${data.invoiceNumber}`, { align: "right" })
			.text(`Date: ${data.paidAt.toDateString()}`, { align: "right" });

		doc.moveDown(2);

		doc.fontSize(12).text(`Billed to: ${data.customerName}`);
		doc.text(`Organization: ${data.organizationName}`);

		doc.moveDown();

		const tableTop = doc.y;
		doc.fontSize(11).text("Description", 50, tableTop);
		doc.text("Amount", 400, tableTop, { width: 145, align: "right" });
		doc
			.moveTo(50, doc.y + 5)
			.lineTo(545, doc.y + 5)
			.stroke();

		doc.moveDown();
		const rowTop = doc.y;
		doc
			.fontSize(11)
			.text(
				data.plan ? `${data.plan} plan subscription` : "Payment",
				50,
				rowTop,
				{ width: 300 },
			);
		doc.text(`${data.amount.toFixed(2)} ${data.currency}`, 400, rowTop, {
			width: 145,
			align: "right",
		});

		doc.moveDown(3);
		doc.fontSize(10).text(`Transaction ID: ${data.transactionId}`);
		doc.text("Status: Paid");

		doc.end();
	});
};
