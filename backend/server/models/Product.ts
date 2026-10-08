import { Schema, model, Document, Model } from 'mongoose';
import { applyDiscount, roundMoney } from '../utils/money';
import { softDeleteAuditPlugin } from '../utils/mongoosePlugins';

interface IVolumeDiscount {
	minQuantity: number;
	discountPercent: number;
}

interface IProduct extends Document {
	name: string;
	slug: string;
	description: string;
	shortDescription: string;
	price: number;
	salePrice?: number;
	category: Schema.Types.ObjectId;
	subcategory?: string;
	brand?: string;
	sku: string;
	images: string[];
	variants: {
		name: string;
		value: string;
		priceModifier?: number;
	}[];
	specifications: Record<string, any>;
	tags: string[];
	inStock: boolean;
	stockQuantity: number;
	lowStockThreshold: number;
	volumeDiscounts?: IVolumeDiscount[];
	authorizedB2BCompanies?: Schema.Types.ObjectId[];
	weight?: number;
	dimensions?: {
		length: number;
		width: number;
		height: number;
	};
	seo: {
		metaTitle?: string;
		metaDescription?: string;
		keywords?: string[];
	};
	rating: {
		average: number;
		count: number;
	};
	isActive: boolean;
	isFeatured: boolean;
	isNew: boolean;
	salesCount: number;
	viewCount: number;
	createdBy: Schema.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	currentPrice: number;
	discountPercentage: number;
}

interface IProductModel extends Model<IProduct> {
	findFeatured(limit?: number): Promise<IProduct[]>;
}

const ProductSchema = new Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		minlength: 2,
		maxlength: 200
	},
	slug: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true
	},
	description: {
		type: String,
		required: true,
		minlength: 10
	},
	shortDescription: {
		type: String,
		maxlength: 300
	},
	price: {
		type: Number,
		required: true,
		min: 0
	},
	salePrice: {
		type: Number,
		min: 0,
		validate: {
			validator: function(this: IProduct, value: number) {
				return !value || value < this.price;
			},
			message: 'Sale price must be less than regular price'
		}
	},
	category: {
		type: Schema.Types.ObjectId,
		ref: 'Category',
		required: true
	},
	subcategory: String,
	brand: String,
	sku: {
		type: String,
		required: true,
		unique: true,
		uppercase: true
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
	variants: [{
		name: { type: String, required: true },
		value: { type: String, required: true },
		priceModifier: { type: Number, default: 0 }
	}],
	specifications: {
		type: Map,
		of: Schema.Types.Mixed
	},
	tags: [String],
	inStock: {
		type: Boolean,
		default: true
	},
	stockQuantity: {
		type: Number,
		default: 0,
		min: 0
	},
	lowStockThreshold: {
		type: Number,
		default: 5,
		min: 0
	},
	weight: {
		type: Number,
		min: 0
	},
	dimensions: {
		length: { type: Number, min: 0 },
		width: { type: Number, min: 0 },
		height: { type: Number, min: 0 }
	},
	seo: {
		metaTitle: { type: String, maxlength: 60 },
		metaDescription: { type: String, maxlength: 160 },
		keywords: [String]
	},
	rating: {
		average: { type: Number, default: 0, min: 0, max: 5 },
		count: { type: Number, default: 0, min: 0 }
	},
	isActive: {
		type: Boolean,
		default: true
	},
	isFeatured: {
		type: Boolean,
		default: false
	},
	salesCount: {
		type: Number,
		default: 0,
		min: 0
	},
	viewCount: {
		type: Number,
		default: 0,
		min: 0
	},
	createdBy: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	volumeDiscounts: [{
		minQuantity: {
			type: Number,
			required: true,
			min: 1
		},
		discountPercent: {
			type: Number,
			required: true,
			min: 0,
			max: 100
		}
	}],
	authorizedB2BCompanies: [{
		type: Schema.Types.ObjectId,
		ref: 'User'
	}]
}, {
	timestamps: true
});

// Indexes for performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ 'rating.average': -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ isActive: 1, isDeleted: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, isDeleted: 1, category: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, isDeleted: 1, isFeatured: 1, createdAt: -1 });

// Virtual for current price (sale price or regular price)
ProductSchema.virtual('currentPrice').get(function() {
	return this.salePrice || this.price;
});

// Method to calculate price based on quantity (volume discount)
ProductSchema.methods.calculateDynamicPrice = function(quantity: number = 1, b2bDiscountRate: number = 0): number {
	const basePrice = this.currentPrice || this.price;

	let volumeDiscount = 0;
	if (this.volumeDiscounts && this.volumeDiscounts.length > 0) {
		const applicableDiscount = this.volumeDiscounts
			.filter((tier: IVolumeDiscount) => quantity >= tier.minQuantity)
			.sort((a: IVolumeDiscount, b: IVolumeDiscount) => b.minQuantity - a.minQuantity)
			.shift();

		if (applicableDiscount) {
			volumeDiscount = applicableDiscount.discountPercent;
		}
	}

	const totalDiscount = Math.max(volumeDiscount, b2bDiscountRate);
	const discountedPrice = applyDiscount(basePrice, totalDiscount);

	return roundMoney(discountedPrice);
};

// Virtual for discount percentage
ProductSchema.virtual('discountPercentage').get(function() {
	if (!this.salePrice) return 0;
	return Math.round(((this.price - this.salePrice) / this.price) * 100);
});

// Pre-save middleware to generate slug
ProductSchema.plugin(softDeleteAuditPlugin);

ProductSchema.pre('save', function() {
	if (this.isModified('name') && !this.slug) {
		this.slug = this.name
			.toLowerCase()
			.replace(/[^a-zA-Z0-9 ]/g, '')
			.replace(/\s+/g, '-')
			.substring(0, 50);
	}
});

// Static method to find featured products
ProductSchema.statics.findFeatured = function(limit = 10) {
	return this.find({ isActive: true, isFeatured: true })
		.limit(limit)
		.sort({ createdAt: -1 });
};

// Instance method to update rating
ProductSchema.methods.updateRating = async function(newRating: number) {
	const totalRating = this.rating.average * this.rating.count + newRating;
	this.rating.count += 1;
	this.rating.average = totalRating / this.rating.count;
	await this.save();
};

export default model<IProduct, IProductModel>('Product', ProductSchema);