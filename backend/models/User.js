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
    isActive: {
      type: Boolean,
      default: true
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
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model("User", userSchema);
