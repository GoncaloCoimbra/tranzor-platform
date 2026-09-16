import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

class EmailService {
	private transporter: nodemailer.Transporter;

	constructor() {
		const port = Number(env.SMTP_PORT) || 587;
		const transportOptions = {
			host: env.SMTP_HOST || 'smtp.gmail.com',
			port,
			secure: port === 465,
			auth: env.SMTP_USER && env.SMTP_PASS ? {
				user: env.SMTP_USER,
				pass: env.SMTP_PASS
			} : undefined
		} as unknown as nodemailer.TransportOptions;

		this.transporter = nodemailer.createTransport(transportOptions);
	}

	async sendEmail(options: EmailOptions): Promise<void> {
		if (env.EMAIL_PROVIDER === 'console') {
			logger.info(`Email suppressed in console provider: ${options.subject} -> ${options.to}`);
			return;
		}

		try {
			const fromAddress = env.SMTP_FROM || `no-reply@${new URL(env.FRONTEND_URL).hostname}`;
			await this.transporter.sendMail({
				from: `"Tranzor.pt" <${fromAddress}>`,
				to: options.to,
				subject: options.subject,
				html: options.html,
				text: options.text
			});
		} catch (error) {
			logger.error('Email sending failed:', error);
			throw new Error('Falha ao enviar email');
		}
	}

	async sendWelcomeEmail(email: string, name: string): Promise<void> {
		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Bem-vindo ao Tranzor.pt, ${name}!</h2>
				<p>Obrigado por se registar na nossa plataforma.</p>
				<p>Explore os nossos produtos e aproveite as melhores ofertas em materiais de construção.</p>
				<a href="${env.FRONTEND_URL}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Começar a Comprar</a>
				<p style="margin-top: 20px; color: #666; font-size: 12px;">
					Se não se registou nesta conta, ignore este email.
				</p>
			</div>
		`;

		await this.sendEmail({
			to: email,
			subject: 'Bem-vindo ao Tranzor.pt',
			html
		});
	}

	async sendOrderConfirmation(email: string, orderDetails: any): Promise<void> {
		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Confirmação de Encomenda - ${orderDetails.orderNumber}</h2>
				<p>Obrigado pela sua encomenda! Aqui estão os detalhes:</p>
				<div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
					<h3>Produtos:</h3>
					${orderDetails.items.map((item: any) => `
						<div style="border-bottom: 1px solid #eee; padding: 5px 0;">
							<strong>${item.name}</strong> - ${item.quantity}x €${item.price.toFixed(2)}
						</div>
					`).join('')}
					<h3 style="margin-top: 15px;">Total: €${orderDetails.total.toFixed(2)}</h3>
				</div>
				<p>Estado da encomenda: ${orderDetails.status}</p>
				<a href="${env.FRONTEND_URL}/orders/${orderDetails.orderId}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Encomenda</a>
			</div>
		`;

		await this.sendEmail({
			to: email,
			subject: `Confirmação de Encomenda - ${orderDetails.orderNumber}`,
			html
		});
	}

	async sendPasswordReset(email: string, resetToken: string): Promise<void> {
		const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Reset de Password</h2>
				<p>Recebemos um pedido para resetar a sua password.</p>
				<p>Clique no botão abaixo para criar uma nova password:</p>
				<a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Resetar Password</a>
				<p style="margin-top: 20px; color: #666; font-size: 12px;">
					Este link expira em 10 minutos. Se não pediu este reset, ignore este email.
				</p>
			</div>
		`;

		await this.sendEmail({
			to: email,
			subject: 'Reset de Password - Tranzor.pt',
			html
		});
	}
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
	const emailService = new EmailService();
	await emailService.sendEmail(options);
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
	const emailService = new EmailService();
	await emailService.sendWelcomeEmail(email, name);
};

export const sendOrderConfirmation = async (email: string, orderDetails: any): Promise<void> => {
	const emailService = new EmailService();
	await emailService.sendOrderConfirmation(email, orderDetails);
};

export const sendPasswordReset = async (email: string, resetToken: string): Promise<void> => {
	const emailService = new EmailService();
	await emailService.sendPasswordReset(email, resetToken);
};

export default EmailService;