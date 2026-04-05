const certifications = [
  {
    id: "cert-1001",
    userId: "user-1",
    userName: "Arjun Patel",
    title: "AWS Solutions Architect Associate",
    provider: "Amazon Web Services",
    issueDate: "2024-06-12",
    expiryDate: "2026-06-12",
    status: "Active",
    renewalStatus: "Scheduled",
    reminderDays: 45,
    certificateUrl: "https://example.com/certificates/aws-arjun",
    certificateCode: "AWS-ARJ-2241",
    notes: "Renewal learning path assigned by admin."
  },
  {
    id: "cert-1002",
    userId: "user-2",
    userName: "Neha Singh",
    title: "Certified Ethical Hacker",
    provider: "EC-Council",
    issueDate: "2023-09-02",
    expiryDate: "2026-05-15",
    status: "Expiring Soon",
    renewalStatus: "Pending Submission",
    reminderDays: 30,
    certificateUrl: "https://example.com/certificates/ceh-neha",
    certificateCode: "CEH-NEH-1187",
    notes: "Waiting for updated score report."
  },
  {
    id: "cert-1003",
    userId: "user-1",
    userName: "Arjun Patel",
    title: "Scrum Master Professional",
    provider: "Scrum Institute",
    issueDate: "2022-01-20",
    expiryDate: "2025-12-20",
    status: "Expired",
    renewalStatus: "Action Required",
    reminderDays: 15,
    certificateUrl: "https://example.com/certificates/scrum-arjun",
    certificateCode: "SCR-ARJ-9904",
    notes: "Admin flagged overdue renewal."
  }
];

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target - today) / msPerDay);
}

function deriveStatus(expiryDate) {
  const remaining = daysUntil(expiryDate);

  if (remaining < 0) {
    return "Expired";
  }

  if (remaining <= 45) {
    return "Expiring Soon";
  }

  return "Active";
}

function enrichCertification(certification) {
  const daysRemaining = daysUntil(certification.expiryDate);
  return {
    ...certification,
    status: deriveStatus(certification.expiryDate),
    daysRemaining
  };
}

function getCertifications(filters = {}) {
  const { role, userId, status } = filters;

  return certifications
    .filter((certification) => {
      if (role === "user" && userId && certification.userId !== userId) {
        return false;
      }

      if (status && status !== "All" && deriveStatus(certification.expiryDate) !== status) {
        return false;
      }

      return true;
    })
    .map(enrichCertification);
}

function getCertificationById(id) {
  const certification = certifications.find((entry) => entry.id === id);
  return certification ? enrichCertification(certification) : null;
}

function createCertification(payload) {
  const certification = {
    id: `cert-${Date.now()}`,
    userId: payload.userId,
    userName: payload.userName,
    title: payload.title,
    provider: payload.provider,
    issueDate: payload.issueDate,
    expiryDate: payload.expiryDate,
    status: deriveStatus(payload.expiryDate),
    renewalStatus: payload.renewalStatus || "Not Started",
    reminderDays: Number(payload.reminderDays) || 30,
    certificateUrl: payload.certificateUrl,
    certificateCode: payload.certificateCode,
    notes: payload.notes || ""
  };

  certifications.unshift(certification);
  return enrichCertification(certification);
}

function updateCertification(id, payload) {
  const certification = certifications.find((entry) => entry.id === id);
  if (!certification) {
    return null;
  }

  Object.assign(certification, {
    title: payload.title ?? certification.title,
    provider: payload.provider ?? certification.provider,
    issueDate: payload.issueDate ?? certification.issueDate,
    expiryDate: payload.expiryDate ?? certification.expiryDate,
    renewalStatus: payload.renewalStatus ?? certification.renewalStatus,
    reminderDays: payload.reminderDays !== undefined ? Number(payload.reminderDays) : certification.reminderDays,
    certificateUrl: payload.certificateUrl ?? certification.certificateUrl,
    certificateCode: payload.certificateCode ?? certification.certificateCode,
    notes: payload.notes ?? certification.notes
  });

  return enrichCertification(certification);
}

function renewCertification(id, payload = {}) {
  const certification = certifications.find((entry) => entry.id === id);
  if (!certification) {
    return null;
  }

  certification.issueDate = payload.issueDate || new Date().toISOString().slice(0, 10);
  certification.expiryDate = payload.expiryDate;
  certification.renewalStatus = payload.renewalStatus || "Renewed";
  certification.notes = payload.notes || certification.notes;

  return enrichCertification(certification);
}

function getSummary(role, userId) {
  const scoped = getCertifications({ role, userId });

  return {
    total: scoped.length,
    active: scoped.filter((item) => item.status === "Active").length,
    expiringSoon: scoped.filter((item) => item.status === "Expiring Soon").length,
    expired: scoped.filter((item) => item.status === "Expired").length,
    renewalsInProgress: scoped.filter((item) => item.renewalStatus !== "Not Started" && item.renewalStatus !== "Renewed").length
  };
}

module.exports = {
  getCertifications,
  getCertificationById,
  createCertification,
  updateCertification,
  renewCertification,
  getSummary
};
