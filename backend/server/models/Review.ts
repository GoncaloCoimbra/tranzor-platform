import mongoose, { Schema, model, Document, Model } from 'mongoose';

interface IReview extends Document {
	user: Schema.Types.ObjectId;
	product: Schema.Types.ObjectId;
	order?: Schema.Types.ObjectId;
	rating: number;
	title: string;
	comment: string;
	images?: string[];
	isVerified: boolean;
	isApproved: boolean;
	helpful: {
		count: number;
		votedBy: Schema.Types.ObjectId[];
	};
	reported: {
		count: number;
		reasons: string[];
		reportedBy: Schema.Types.ObjectId[];
	};
	response?: {
		comment: string;
		respondedBy: Schema.Types.ObjectId;
		respondedAt: Date;
	};
	createdAt: Date;
	updatedAt: Date;
}

interface IReviewModel extends Model<IReview> {
	getProductReviews(productId: string | mongoose.Types.ObjectId, approvedOnly?: boolean): Promise<IReview[]>;
	getAverageRating(productId: string | mongoose.Types.ObjectId): Promise<{ averageRating: number; totalReviews: number }>;
}

const ReviewSchema = new Schema<IReview, IReviewModel>({
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	product: {
		type: Schema.Types.ObjectId,
		ref: 'Product',
		required: true
	},
	order: {
		type: Schema.Types.ObjectId,
		ref: 'Order'
	},
	rating: {
		type: Number,
		required: true,
		min: 1,
		max: 5
	},
	title: {
		type: String,
		required: true,
		trim: true,
		minlength: 5,
		maxlength: 100
	},
	comment: {
		type: String,
		required: true,
		minlength: 10,
		maxlength: 1000
	},
	images: [{
		type: String,
		validate: {
			validator: function(v: string) {
				return /^https?:\/\/.+/.test(v);
			},
			message: 'Image URL must be valid'
		}
	}],
	isVerified: {
		type: Boolean,
		default: false
	},
	isApproved: {
		type: Boolean,
		default: true
	},
	helpful: {
		count: { type: Number, default: 0 },
		votedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
	},
	reported: {
		count: { type: Number, default: 0 },
		reasons: [String],
		reportedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
	},
	response: {
		comment: { type: String, maxlength: 500 },
		respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
		respondedAt: Date
	}
}, {
	timestamps: true
});

// Indexes
ReviewSchema.index({ product: 1, createdAt: -1 });
ReviewSchema.index({ product: 1, isApproved: 1, createdAt: -1 });
ReviewSchema.index({ user: 1 });
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ isApproved: 1 });
ReviewSchema.index({ isVerified: 1 });

// Compound index for unique reviews per user per product
ReviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Virtual for helpful percentage
ReviewSchema.virtual('helpfulPercentage').get(function() {
	const totalVotes = this.helpful.votedBy.length;
	return totalVotes > 0 ? (this.helpful.count / totalVotes) * 100 : 0;
});

// Instance method to mark as helpful
ReviewSchema.methods.markHelpful = async function(userId: string) {
	if (!this.helpful.votedBy.includes(userId)) {
		this.helpful.votedBy.push(userId);
		this.helpful.count += 1;
		await this.save();
	}
};

// Instance method to report review
ReviewSchema.methods.report = async function(userId: string, reason: string) {
	if (!this.reported.reportedBy.includes(userId)) {
		this.reported.reportedBy.push(userId);
		this.reported.reasons.push(reason);
		this.reported.count += 1;
		await this.save();
	}
};

// Instance method to add response
ReviewSchema.methods.addResponse = async function(comment: string, respondedBy: string) {
	this.response = {
		comment,
		respondedBy,
		respondedAt: new Date()
	};
	await this.save();
};

// Static method to get product reviews
ReviewSchema.statics.getProductReviews = function(productId: string | mongoose.Types.ObjectId, approvedOnly = true) {
	const query: any = { product: productId };
	if (approvedOnly) query.isApproved = true;

	return this.find(query)
		.populate('user', 'name')
		.sort({ createdAt: -1 });
};

// Static method to get average rating
ReviewSchema.statics.getAverageRating = async function(productId: string | mongoose.Types.ObjectId) {
	const matchProductId = typeof productId === 'string'
		? new mongoose.Types.ObjectId(productId)
		: productId;

	const result = await this.aggregate([
		{ $match: { product: matchProductId, isApproved: true } },
		{
			$group: {
				_id: '$product',
				averageRating: { $avg: '$rating' },
				totalReviews: { $sum: 1 }
			}
		}
	]);

	return result[0] || { averageRating: 0, totalReviews: 0 };
};

export default model<IReview, IReviewModel>('Review', ReviewSchema);