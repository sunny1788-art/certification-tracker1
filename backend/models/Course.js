const mongoose = require("mongoose");

const quizQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      trim: true,
      required: true
    },
    options: {
      type: [String],
      default: []
    },
    answerIndex: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    skillCategory: {
      type: String,
      trim: true,
      default: "General"
    },
    level: {
      type: String,
      trim: true,
      default: "Beginner"
    },
    durationHours: {
      type: Number,
      default: 6
    },
    certificationTitle: {
      type: String,
      trim: true,
      default: ""
    },
    issuer: {
      type: String,
      trim: true,
      default: "Skill Certification Tracking Portal"
    },
    passingScore: {
      type: Number,
      default: 70
    },
    expiryMonths: {
      type: Number,
      default: 24
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active"
    },
    modules: {
      type: [String],
      default: []
    },
    assignments: {
      type: [String],
      default: []
    },
    quizQuestions: {
      type: [quizQuestionSchema],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    ratingAverage: {
      type: Number,
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

courseSchema.methods.toCard = function toCard(extra = {}) {
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    skillCategory: this.skillCategory,
    level: this.level,
    durationHours: this.durationHours,
    certificationTitle: this.certificationTitle || this.title,
    issuer: this.issuer,
    passingScore: this.passingScore,
    expiryMonths: this.expiryMonths,
    status: this.status,
    modules: this.modules,
    assignments: this.assignments,
    quizQuestionCount: this.quizQuestions.length,
    ratingAverage: Number(this.ratingAverage || 0).toFixed(1),
    ratingCount: this.ratingCount || 0,
    createdAt: this.createdAt ? this.createdAt.toISOString().slice(0, 10) : "",
    ...extra
  };
};

module.exports = mongoose.model("Course", courseSchema);
