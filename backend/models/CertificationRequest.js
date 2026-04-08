const mongoose = require("mongoose");

const certificationRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ["add", "renew"],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    certification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certification",
      default: null
    },
    title: {
      type: String,
      trim: true,
      default: ""
    },
    provider: {
      type: String,
      trim: true,
      default: ""
    },
    issueDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    renewalStatus: {
      type: String,
      trim: true,
      default: "Not Started"
    },
    reminderDays: {
      type: Number,
      default: 30
    },
    certificateCode: {
      type: String,
      trim: true,
      default: ""
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    proofLink: {
      type: String,
      trim: true,
      default: ""
    },
    proofFile: {
      type: String,
      default: ""
    },
    adminNote: {
      type: String,
      trim: true,
      default: ""
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

certificationRequestSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    requestType: this.requestType,
    status: this.status,
    studentId: this.student?._id ? this.student._id.toString() : this.student?.toString() || "",
    studentName: this.student?.name || "",
    studentEmail: this.student?.email || "",
    studentCode: this.student?.userId || "",
    certificationId: this.certification?._id ? this.certification._id.toString() : this.certification?.toString() || "",
    certificationTitle: this.certification?.title || this.title,
    title: this.title,
    provider: this.provider,
    issueDate: this.issueDate ? this.issueDate.toISOString().slice(0, 10) : "",
    expiryDate: this.expiryDate ? this.expiryDate.toISOString().slice(0, 10) : "",
    renewalStatus: this.renewalStatus,
    reminderDays: this.reminderDays,
    certificateCode: this.certificateCode,
    notes: this.notes,
    proofLink: this.proofLink,
    proofFile: this.proofFile,
    adminNote: this.adminNote,
    reviewedAt: this.reviewedAt ? this.reviewedAt.toISOString().slice(0, 10) : "",
    createdAt: this.createdAt ? this.createdAt.toISOString().slice(0, 10) : ""
  };
};

module.exports = mongoose.model("CertificationRequest", certificationRequestSchema);
