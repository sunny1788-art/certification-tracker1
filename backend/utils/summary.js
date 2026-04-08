function buildSummary(certifications) {
  return certifications.reduce(
    (summary, certification) => {
      summary.total += 1;

      if (certification.status === "Active") {
        summary.active += 1;
      }

      if (certification.status === "Expiring Soon") {
        summary.expiringSoon += 1;
      }

      if (certification.status === "Expired") {
        summary.expired += 1;
      }

      if (certification.renewalStatus !== "Not Started" && certification.renewalStatus !== "Renewed") {
        summary.renewalsInProgress += 1;
      }

      return summary;
    },
    {
      total: 0,
      active: 0,
      expiringSoon: 0,
      expired: 0,
      renewalsInProgress: 0
    }
  );
}

module.exports = {
  buildSummary
};
