const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ["admin", "student"],
      default: "student"
    },
    department: {
      type: String,
      trim: true,
      default: "General"
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    profilePhoto: {
      type: String,
      default: ""
    },
    emailVerified: {
      type: Boolean,
      default: true
    },
    phoneVerified: {
      type: Boolean,
      default: true
    },
    verificationPending: {
      type: Boolean,
      default: false
    },
    signupEmailOtp: {
      type: String,
      default: ""
    },
    signupPhoneOtp: {
      type: String,
      default: ""
    },
    signupOtpExpiresAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    blockedReason: {
      type: String,
      trim: true,
      default: ""
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    suspiciousScore: {
      type: Number,
      default: 0
    },
    suspiciousReason: {
      type: String,
      trim: true,
      default: ""
    },
    loginCount: {
      type: Number,
      default: 0
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    resetOtpCode: {
      type: String,
      default: ""
    },
    resetOtpExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    next();
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    userId: this.userId || "",
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    phone: this.phone,
    profilePhoto: this.profilePhoto,
    emailVerified: this.emailVerified !== false,
    phoneVerified: this.phone ? this.phoneVerified !== false : true,
    verificationPending: Boolean(this.verificationPending),
    isActive: this.isActive,
    blockedReason: this.blockedReason,
    failedLoginAttempts: this.failedLoginAttempts || 0,
    suspiciousScore: this.suspiciousScore || 0,
    suspiciousReason: this.suspiciousReason || "",
    loginCount: this.loginCount || 0,
    lastLoginAt: this.lastLoginAt ? this.lastLoginAt.toISOString() : "",
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model("User", userSchema);
