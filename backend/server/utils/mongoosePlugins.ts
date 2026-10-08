import { Schema, Types } from 'mongoose';

export interface AuditEntry {
  action: string;
  user?: Types.ObjectId;
  timestamp: Date;
  changes?: Record<string, any>;
}

export function softDeleteAuditPlugin(schema: Schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    auditLog: [{
      action: { type: String, required: true },
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: () => new Date() },
      changes: Schema.Types.Mixed
    }]
  });

  schema.methods.setCurrentUser = function(userId: string) {
    (this as any)._currentUser = userId;
    return this;
  };

  schema.methods.logAudit = function(action: string, userId?: string, changes?: any) {
    const entry = {
      action,
      user: userId ? new Types.ObjectId(userId) : undefined,
      timestamp: new Date(),
      changes: changes || {}
    };

    this.auditLog = this.auditLog || [];
    this.auditLog.push(entry);
    return this;
  };

  schema.methods.softDelete = async function(userId?: string) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (userId) {
      this.deletedBy = new Types.ObjectId(userId);
    }
    this.logAudit('softDelete', userId, { isDeleted: true });
    return this.save();
  };

  const saveHook: any = function(this: any) {
    const doc = this as any;
    const currentUser = doc._currentUser;

    if (currentUser) {
      doc.updatedBy = new Types.ObjectId(currentUser);
      const action = doc.isNew ? 'create' : 'update';
      const changes = doc.modifiedPaths().reduce((acc: Record<string, any>, path: string) => {
        acc[path] = doc.get(path);
        return acc;
      }, {});
      doc.logAudit(action, currentUser, changes);
    }

    if (doc.isModified('isDeleted') && doc.isDeleted && !doc.deletedAt) {
      doc.deletedAt = new Date();
    }

  };

  schema.pre('save', saveHook);
}
