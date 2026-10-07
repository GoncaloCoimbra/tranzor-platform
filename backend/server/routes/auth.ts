import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User';
import { sendEmail } from '../services/emailService';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/handlers';
import { loginSchema, registerSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/authSchema';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
	UnauthorizedError,
	ConflictError,
	BadRequestError
} from '../utils/errors';
import { generateToken, isB2BRole, optionalAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

const cookieOptions = {
	httpOnly: true,
	sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
	secure: env.NODE_ENV === 'production',
	path: '/',
	maxAge: 24 * 60 * 60 * 1000
};

function setAuthCookie(res: Response, token: string) {
	res.cookie('token', token, cookieOptions);
}

function clearAuthCookie(res: Response) {
	res.clearCookie('token', cookieOptions);
}

function buildUserPayload(user: typeof User.prototype) {
	return {
		id: user._id.toString(),
		name: user.name,
		email: user.email,
		role: user.role,
		emailVerified: user.emailVerified,
		loyaltyPoints: user.loyaltyPoints ?? 0,
		b2bDiscountRate: user.b2bDiscountRate ?? 0,
		pricingTier: user.pricingTier ?? 'starter',
		paymentTerms: user.paymentTerms ?? 'prepaid',
		creditLimit: user.creditLimit ?? 0,
		customPricingEnabled: user.b2bCompanyInfo?.customPricingEnabled ?? false,
		profile: {
			company: user.profile?.company,
			taxId: user.profile?.taxId,
			phone: user.profile?.phone,
			address: user.profile?.address
		}
	};
}

// GET /auth/me
router.get('/me', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
	if (!req.user) {
		throw new UnauthorizedError('Usuário não autenticado');
	}

	const user = await User.findById(req.user.userId);
	if (!user) {
		throw new UnauthorizedError('Usuário não encontrado');
	}
	if (!user.isActive) {
		clearAuthCookie(res);
		throw new UnauthorizedError('Conta desativada');
	}

	res.json({
		success: true,
		data: {
			user: buildUserPayload(user)
		}
	});
}));

// POST /auth/login
router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
	const { email, password } = req.body;

	logger.info(`Login attempt for email: ${email}`);

	const user = await User.findOne({ email }).select('+password');
	if (!user) {
		logger.warn(`Login failed: user not found for email: ${email}`);
		throw new UnauthorizedError('Credenciais inválidas');
	}

	if (!user.isActive) {
		logger.warn(`Login failed: account inactive for email: ${email}`);
		throw new UnauthorizedError('Conta desativada');
	}

	const isValidPassword = await user.comparePassword(password);
	if (!isValidPassword) {
		logger.warn(`Login failed: invalid password for email: ${email}`);
		throw new UnauthorizedError('Credenciais inválidas');
	}

	user.lastLogin = new Date();
	await user.save();

	const token = generateToken(user._id.toString(), user.email, user.role);

	setAuthCookie(res, token);

	logger.info(`User logged in successfully: ${email}`);

	res.json({
		success: true,
		data: {
			user: buildUserPayload(user),
			token
		}
	});
}));

// POST /auth/register
router.post('/register', validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
	const { name, email, password, role = 'user', company, taxId, phone } = req.body;
	if (process.env.DEBUG) {
		console.log('DEBUG POST /auth/register body:', JSON.stringify(req.body));
	}
	logger.info(`Register attempt for email: ${email}`);

	try {
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			if (process.env.DEBUG) {
				console.log(`DEBUG Register failed: email already exists: ${email}`);
			}
			logger.warn(`Register failed: email already exists: ${email}`);
			throw new ConflictError('Email já registado');
		}

		const bcryptCost = process.env.NODE_ENV === 'test' ? 6 : 12;
		const hashedPassword = await bcrypt.hash(password, bcryptCost);
		const emailVerificationToken = crypto.randomBytes(32).toString('hex');

		const user = new User({
			name,
			email,
			password: hashedPassword,
			role,
			b2bDiscountRate: isB2BRole(role) ? 10 : 0,
			emailVerificationToken,
			profile: {
				company,
				taxId,
				phone
			}
		});

		await user.save();

		if (env.SKIP_EMAIL_VERIFICATION || env.EMAIL_PROVIDER === 'console') {
			logger.info(`Email verification skipped for: ${email}`);
		} else {
			try {
				await sendEmail({
					to: email,
					subject: 'Verifique seu email - Tranzor.pt',
					html: `
						<h2>Bem-vindo ao Tranzor.pt!</h2>
						<p>Clique no link abaixo para verificar seu email:</p>
						<a href="${env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}">Verificar Email</a>
						<p>Este link expira em 24 horas.</p>
					`
				});
			} catch (emailError) {
				logger.warn(`Email sending failed for: ${email}`, emailError);
			}
		}

		const token = generateToken(user._id.toString(), user.email, user.role);

		setAuthCookie(res, token);
		logger.info(`User registered successfully: ${email}`);

		res.status(201).json({
			success: true,
			data: {
				user: buildUserPayload(user),
				token
			},
			message: 'Conta criada com sucesso. Verifique seu email para ativar a conta.'
		});
	} catch (err: any) {
		// Temporary detailed logging to capture root-cause stack traces during E2E runs
		try {
			logger.error('Register handler error:', err && (err.stack || err));
		} catch (logErr) {
			// swallow logging errors
		}

		// Do not write log files here (user requested). Re-throw after logging.
		throw err;
	}
}));

// POST /auth/verify-email
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(async (req: Request, res: Response) => {
	const { token } = req.body;

	const user = await User.findOne({ emailVerificationToken: token });
	if (!user) {
		throw new BadRequestError('Token inválido ou expirado');
	}

	user.emailVerified = true;
	user.emailVerificationToken = undefined;
	await user.save();

	logger.info(`Email verified for user: ${user.email}`);

	res.json({
		success: true,
		message: 'Email verificado com sucesso'
	});
}));

// POST /auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
	const { email } = req.body;
	const user = await User.findOne({ email });

	if (!user) {
		return res.json({
			success: true,
			message: 'Se o email existir, você receberá instruções para resetar a password'
		});
	}

	const resetToken = crypto.randomBytes(32).toString('hex');
	const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

	user.passwordResetToken = resetToken;
	user.passwordResetExpires = resetExpires;
	await user.save();

	try {
		await sendEmail({
			to: email,
			subject: 'Reset de Password - Tranzor.pt',
			html: `
				<h2>Reset de Password</h2>
				<p>Clique no link abaixo para resetar sua password:</p>
				<a href="${env.FRONTEND_URL}/reset-password?token=${resetToken}">Resetar Password</a>
				<p>Este link expira em 10 minutos.</p>
			`
		});
	} catch (emailError) {
		logger.warn(`Password reset email failed for: ${email}`, emailError);
	}

	res.json({
		success: true,
		message: 'Se o email existir, você receberá instruções para resetar a password'
	});
}));

// POST /auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
	const { token, password } = req.body;

	const user = await User.findOne({
		passwordResetToken: token,
		passwordResetExpires: { $gt: new Date() }
	});

	if (!user) {
		throw new BadRequestError('Token inválido ou expirado');
	}

	const bcryptCost = process.env.NODE_ENV === 'test' ? 6 : 12;
	user.password = await bcrypt.hash(password, bcryptCost);
	user.passwordResetToken = undefined;
	user.passwordResetExpires = undefined;
	await user.save();

	res.json({
		success: true,
		message: 'Password alterada com sucesso'
	});
}));

// POST /auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
	clearAuthCookie(res);

	res.json({
		success: true,
		message: 'Logout realizado com sucesso'
	});
}));

export default router;