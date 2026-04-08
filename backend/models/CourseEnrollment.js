const mongoose = require("mongoose");

const courseEnrollmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true
    },
    status: {
      type: String,
      enum: ["registered", "in_progress", "pending_approval", "approved", "rejected"],
      default: "registered"
    },
    progressPercent: {
      type: Number,
      default: 0
    },
    quizScore: {
      type: Number,
      default: 0
    },
    assignmentScore: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    stars: {
      type: Number,
      default: 0
    },
    assignmentLink: {
      type: String,
      trim: true,
      default: ""
    },
    assignmentNotes: {
      type: String,
      trim: true,
      default: ""
    },
    submittedAt: {
      type: Date,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    adminNote: {
      type: String,
      trim: true,
      default: ""
    },
    certification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certification",
      default: null
    }
  },
  {
    timestamps: true
  }
);

courseEnrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

courseEnrollmentSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    userId: this.user?._id ? this.user._id.toString() : this.user?.toString() || "",
    userName: this.user?.name || "",
    userEmail: this.user?.email || "",
    userCode: this.user?.userId || "",
    courseId: this.course?._id ? this.course._id.toString() : this.course?.toString() || "",
    courseTitle: this.course?.title || "",
    certificationTitle: this.course?.certificationTitle || this.course?.title || "",
    skillCategory: this.course?.skillCategory || "General",
    status: this.status,
    progressPercent: this.progressPercent,
    quizScore: this.quizScore,
    assignmentScore: this.assignmentScore,
    averageScore: this.averageScore,
    stars: this.stars,
    assignmentLink: this.assignmentLink,
    assignmentNotes: this.assignmentNotes,
    adminNote: this.adminNote,
    certificationId: this.certification?._id ? this.certification._id.toString() : this.certification?.toString() || "",
    submittedAt: this.submittedAt ? this.submittedAt.toISOString().slice(0, 10) : "",
    approvedAt: this.approvedAt ? this.approvedAt.toISOString().slice(0, 10) : "",
    createdAt: this.createdAt ? this.createdAt.toISOString().slice(0, 10) : ""
  };
};

module.exports = mongoose.model("CourseEnrollment", courseEnrollmentSchema);
