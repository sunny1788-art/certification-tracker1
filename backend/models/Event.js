const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["registered", "approved", "attended", "cancelled"],
      default: "registered"
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
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
    category: {
      type: String,
      trim: true,
      default: "Skill Event"
    },
    mode: {
      type: String,
      enum: ["online", "offline", "hybrid"],
      default: "online"
    },
    location: {
      type: String,
      trim: true,
      default: ""
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    registrationDeadline: {
      type: Date,
      required: true
    },
    capacity: {
      type: Number,
      default: 100
    },
    status: {
      type: String,
      enum: ["open", "closed", "completed"],
      default: "open"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    registrations: {
      type: [registrationSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

eventSchema.methods.toCard = function toCard(currentUserId = "") {
  const currentReg = this.registrations.find((item) => item.user?.toString() === currentUserId);
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    category: this.category,
    mode: this.mode,
    location: this.location,
    startDate: this.startDate.toISOString().slice(0, 10),
    endDate: this.endDate.toISOString().slice(0, 10),
    registrationDeadline: this.registrationDeadline.toISOString().slice(0, 10),
    capacity: this.capacity,
    status: this.status,
    registrationCount: this.registrations.length,
    seatsLeft: Math.max(0, this.capacity - this.registrations.length),
    isRegistered: Boolean(currentReg),
    registrationStatus: currentReg?.status || "",
    createdAt: this.createdAt ? this.createdAt.toISOString().slice(0, 10) : ""
  };
};

module.exports = mongoose.model("Event", eventSchema);
