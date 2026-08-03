export default function TaskStatusIcon({ status, dueDate }) {

    console.log({
    status,
    dueDate,
    parsedDueDate: dueDate ? new Date(dueDate) : null,
    now: new Date(),
    overdueCheck: status === "PENDING" && dueDate && new Date(dueDate) < new Date()
  });
    
  const isOverdue =
    status === "PENDING" &&
    dueDate &&
    new Date(dueDate) < new Date();

  if (isOverdue) {
    return (
      <span title="Overdue" className="text-amber-600">
        ⚠
      </span>
    );
  }

  switch (status) {
    case "COMPLETE":
      return (
        <span title="Complete" className="text-green-600">
          ✓
        </span>
      );

    case "PENDING":
      return (
        <span title="Pending" className="text-blue-600">
          ●
        </span>
      );

    case "ARCHIVED":
      return (
        <span title="Archived" className="text-gray-400">
          —
        </span>
      );

    default:
      return null;
  }
}