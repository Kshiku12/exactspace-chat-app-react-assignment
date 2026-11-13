import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    officeLocation: { type: String, required: true },
    phone: { type: String, default: "" },
    about: {
      type: String,
      default: "Hey there! I am using ExactSpace Workspace.",
    },
    initials: { type: String, required: true },
    avatarColor: { type: String, default: "#00a884" },
    isBot: { type: Boolean, default: false },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
  },
  { timestamps: true }
);

const MessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    channelId: { type: String, required: true, index: true },
    user: { type: String, required: true },
    senderEmployeeId: { type: String, required: true },
    senderRole: { type: String, default: "" },
    initials: { type: String, required: true },
    avatarColor: { type: String, default: "#00a884" },
    text: { type: String, default: "" },
    timestamp: { type: String, required: true },
    createdAtMs: { type: Number, default: () => Date.now() },
    // Requirement 1: One person can only like a message once
    likes: { type: Number, default: 0 },
    likedBy: {
      type: [
        {
          employeeId: String,
          name: String,
        },
      ],
      default: [],
    },
    reactions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pinned: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    isFollowUp: { type: Boolean, default: false },
    replyTo: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    attachment: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export const EmployeeModel =
  mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

export const MessageModel =
  mongoose.models.Message || mongoose.model("Message", MessageSchema);

