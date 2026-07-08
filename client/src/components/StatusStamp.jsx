const LABELS = {
  IN_TRANSIT: "In transit",
  RECEIVED: "Received",
  COMPLETED: "Completed",
  RETURNED: "Returned",
  ARCHIVED: "Archived",
  OVERDUE: "Overdue",
};

export default function StatusStamp({ status, large }) {
  return (
    <span className={`stamp ${status} ${large ? "lg" : ""}`}>
      {LABELS[status] || status}
    </span>
  );
}
