import config from "../config";
import { transporter } from "../lib/nodemailer";

export interface MailAttachment {
	filename: string;
	content: Buffer | string;
	contentType?: string;
}

export interface SendMailPayload {
	to: string;
	subject: string;
	text?: string;
	html?: string;
	attachments?: MailAttachment[];
}

export const sendMail = async (payload: SendMailPayload) => {
	await transporter.sendMail({
		from: config.email_sender,
		to: payload.to,
		subject: payload.subject,
		text: payload.text,
		html: payload.html,
		attachments: payload.attachments,
	});
};
