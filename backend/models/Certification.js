const mongoose = require("mongoose");

const certificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    provider: {
      type: String,
      required: true,
      trim: true
    },
    issueDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true
    },
    renewalStatus: {
      type: String,
      enum: ["Not Started", "Scheduled", "Pending Submission", "Action Required", "Renewed"],
      default: "Not Started"
    },
    reminderDays: {
      type: Number,
      default: 30
    },
    certificateCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    certificateFile: {
      type: String,
      default: ""
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    lastRenewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

certificationSchema.methods.toCard = function toCard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(this.expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const daysRemaining = Math.round((expiry - today) / (1000 * 60 * 60 * 24));

  let status = "Active";
  if (daysRemaining < 0) {
    status = "Expired";
  } else if (daysRemaining <= this.reminderDays) {
    status = "Expiring Soon";
  }

  return {
    id: this._id.toString(),
    userId: this.user?._id ? this.user._id.toString() : this.user.toString(),
    userCode: this.user?.userId || "",
    userName: this.user?.name || "",
    userEmail: this.user?.email || "",
    title: this.title,
    provider: this.provider,
    issueDate: this.issueDate.toISOString().slice(0, 10),
    expiryDate: this.expiryDate.toISOString().slice(0, 10),
    renewalStatus: this.renewalStatus,
    reminderDays: this.reminderDays,
    certificateCode: this.certificateCode,
    certificateFile: this.certificateFile,
    notes: this.notes,
    lastRenewedAt: this.lastRenewedAt ? this.lastRenewedAt.toISOString().slice(0, 10) : "",
    daysRemaining,
    status
  };
};

module.exports = mongoose.model("Certification", certificationSchema);
