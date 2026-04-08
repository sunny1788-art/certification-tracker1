const express = require("express");
const Event = require("../models/Event");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`${fieldName} must be a valid date.`);
  }
  return parsed;
}

function parseEventPayload(req, existing = null) {
  const source = req.body || {};
  const title = String(source.title ?? existing?.title ?? "").trim();
  if (!title) {
    throw validationError("Event title is required.");
  }

  const startDate = parseDate(source.startDate ?? existing?.startDate, "Start date");
  const endDate = parseDate(source.endDate ?? existing?.endDate, "End date");
  const registrationDeadline = parseDate(source.registrationDeadline ?? existing?.registrationDeadline, "Registration deadline");

  return {
    title,
    description: String(source.description ?? existing?.description ?? "").trim(),
    category: String(source.category ?? existing?.category ?? "Skill Event").trim() || "Skill Event",
    mode: ["online", "offline", "hybrid"].includes(String(source.mode ?? existing?.mode ?? "online")) ? String(source.mode ?? existing?.mode ?? "online") : "online",
    location: String(source.location ?? existing?.location ?? "").trim(),
    startDate,
    endDate,
    registrationDeadline,
    capacity: Math.max(1, Number(source.capacity ?? existing?.capacity ?? 100) || 100),
    status: ["open", "closed", "completed"].includes(String(source.status ?? existing?.status ?? "open")) ? String(source.status ?? existing?.status ?? "open") : "open"
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    return res.json({
      events: events.map((event) => event.toCard(req.user._id.toString()))
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch events.", details: error.message });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const event = await Event.create({
      ...parseEventPayload(req),
      createdBy: req.user._id
    });

    return res.status(201).json({
      message: "Event created successfully.",
      event: event.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to create event." });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    Object.assign(event, parseEventPayload(req, event));
    await event.save();

    return res.json({
      message: "Event updated successfully.",
      event: event.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to update event." });
  }
});

router.post("/:id/register", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== "open") {
      return res.status(404).json({ message: "Event is not open for registration." });
    }

    if (event.registrationDeadline.getTime() < Date.now()) {
      throw validationError("Registration deadline has already passed.");
    }

    if (event.registrations.some((item) => item.user.toString() === req.user._id.toString())) {
      throw validationError("You are already registered for this event.");
    }

    if (event.registrations.length >= event.capacity) {
      throw validationError("Event capacity is full.");
    }

    event.registrations.push({
      user: req.user._id,
      status: "registered"
    });
    await event.save();

    return res.status(201).json({
      message: "Event registration completed.",
      event: event.toCard(req.user._id.toString())
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to register for event." });
  }
});

module.exports = router;
