"use client";

import { useState } from "react";
import {
  X,
  Mail,
  Pencil,
  Check,
  Ban,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "./NeedsReviewModal.css";

export interface RecommendedAction {
  id: string;
  emailId?: string | null;
  title: string;
  summary?: string | null;
  patientName?: string | null;
  dueDate?: string | null;
  recommendedActions?: string[];

  email?: {
    id: string;
    gmailMessageId: string | null;
    gmailThreadId?: string | null;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: string;
  } | null;
}

interface EditUpdates {
  title: string;
  summary: string;
  dueDate: string | null;
  patientName: string | null;
}

interface NeedsReviewModalProps {
  isOpen: boolean;
  actions: RecommendedAction[];

  onClose: () => void;

  onAccept: (
    action: RecommendedAction
  ) => void | Promise<void>;

  onReject: (
    action: RecommendedAction
  ) => void | Promise<void>;

  onEdit: (
    action: RecommendedAction,
    updates: EditUpdates
  ) => void | Promise<void>;

  onViewEmail: (action: RecommendedAction) => void;
}

export default function NeedsReviewModal({
  isOpen,
  actions,
  onClose,
  onAccept,
  onReject,
  onEdit,
  onViewEmail,
}: NeedsReviewModalProps) {
  const [expandedId, setExpandedId] =
    useState<string | null>(null);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [viewingEmail, setViewingEmail] =
    useState<RecommendedAction | null>(null);

  const [editingAction, setEditingAction] =
    useState<RecommendedAction | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleAccept = async (
    action: RecommendedAction
  ): Promise<void> => {
    try {
      setProcessingId(action.id);
      await onAccept(action);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (
    action: RecommendedAction
  ): Promise<void> => {
    try {
      setProcessingId(action.id);
      await onReject(action);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpanded = (id: string): void => {
    setExpandedId((current) =>
      current === id ? null : id
    );
  };

  const handleViewEmail = (
    action: RecommendedAction
  ): void => {
    setViewingEmail(action);
    onViewEmail(action);
  };

  const handleEditSave = async (): Promise<void> => {
    if (!editingAction) {
      return;
    }

    try {
      setProcessingId(editingAction.id);

      await onEdit(editingAction, {
        title: editingAction.title,
        summary: editingAction.summary ?? "",
        dueDate: editingAction.dueDate ?? null,
        patientName: editingAction.patientName ?? null,
      });

      // Close only the edit panel.
      // Needs Review stays open.
      setEditingAction(null);
    } catch (error) {
      console.error(
        "Failed to save edited task:",
        error
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="needs-review-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Needs Review Modal */}
      <div className="needs-review-modal">
        {/* Header */}
        <div className="needs-review-header">
          <div>
            <div className="needs-review-title">
              <h2>Needs Review</h2>

              {actions.length > 0 && (
                <span className="needs-review-count">
                  {actions.length}
                </span>
              )}
            </div>

            <p>
              Review AI-recommended tasks before they
              are added to your calendar.
            </p>
          </div>

          <button
            type="button"
            className="needs-review-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className="needs-review-content">
          {actions.length === 0 ? (
            <div className="needs-review-empty">
              <Check size={32} />

              <h3>Nothing needs review</h3>

              <p>
                New recommended tasks from your emails
                will appear here.
              </p>
            </div>
          ) : (
            actions.map((action) => {
              const expanded =
                expandedId === action.id;

              const processing =
                processingId === action.id;

              return (
                <div
                  key={action.id}
                  className={`review-card ${
                    expanded
                      ? "review-card-expanded"
                      : ""
                  }`}
                >
                  <div className="review-card-main">
                    <div className="review-card-info">
                      <h3>{action.title}</h3>

                      {action.patientName && (
                        <div className="review-patient">
                          Patient:{" "}
                          {action.patientName}
                        </div>
                      )}

                      {action.dueDate && (
                        <div className="review-due-date">
                          {new Date(
                            action.dueDate
                          ).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}

                      {action.summary && (
                        <p className="review-summary">
                          {action.summary}
                        </p>
                      )}

                      {expanded &&
                        action.recommendedActions &&
                        action.recommendedActions
                          .length > 0 && (
                          <div className="recommended-actions">
                            <h4>
                              Recommended actions
                            </h4>

                            <ul>
                              {action.recommendedActions.map(
                                (
                                  recommendedAction,
                                  index
                                ) => (
                                  <li key={index}>
                                    {
                                      recommendedAction
                                    }
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>

                    <button
                      type="button"
                      className="review-expand-button"
                      onClick={() =>
                        toggleExpanded(action.id)
                      }
                      aria-label={
                        expanded
                          ? "Show less"
                          : "Show more"
                      }
                    >
                      {expanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="review-card-actions">
                    {action.email && (
                      <button
                        type="button"
                        className="review-button secondary"
                        onClick={() =>
                          handleViewEmail(action)
                        }
                        disabled={processing}
                      >
                        <Mail size={16} />
                        View Source Email
                      </button>
                    )}

                    <button
                      type="button"
                      className="review-button secondary"
                      onClick={() =>
                        setEditingAction(action)
                      }
                      disabled={processing}
                    >
                      <Pencil size={16} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="review-button reject"
                      onClick={() =>
                        handleReject(action)
                      }
                      disabled={processing}
                    >
                      <Ban size={16} />
                      Reject
                    </button>

                    <button
                      type="button"
                      className="review-button accept"
                      onClick={() =>
                        handleAccept(action)
                      }
                      disabled={processing}
                    >
                      <Check size={16} />

                      {processing
                        ? "Processing..."
                        : "Accept"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Edit panel */}
        {editingAction && (
          <div className="source-email-panel">
            <div className="source-email-header">
              <div className="source-email-title">
                <Pencil size={18} />
                <h3>Edit Recommended Task</h3>
              </div>

              <button
                type="button"
                className="source-email-close"
                onClick={() =>
                  setEditingAction(null)
                }
                aria-label="Close edit"
              >
                <X size={20} />
              </button>
            </div>

            <div className="source-email-content">
              <div className="edit-field">
                <label htmlFor="edit-title">
                  Title
                </label>

                <input
                  id="edit-title"
                  type="text"
                  value={editingAction.title}
                  onChange={(event) =>
                    setEditingAction((current) =>
                      current
                        ? {
                            ...current,
                            title: event.target.value,
                          }
                        : null
                    )
                  }
                />
              </div>

              <div className="edit-field">
                <label htmlFor="edit-patient">
                  Patient
                </label>

                <input
                  id="edit-patient"
                  type="text"
                  value={
                    editingAction.patientName ?? ""
                  }
                  onChange={(event) =>
                    setEditingAction((current) =>
                      current
                        ? {
                            ...current,
                            patientName:
                              event.target.value,
                          }
                        : null
                    )
                  }
                />
              </div>

              <div className="edit-field">
                <label htmlFor="edit-due-date">
                  Due Date
                </label>

                <input
                  id="edit-due-date"
                  type="datetime-local"
                  value={
                    editingAction.dueDate
                      ? new Date(
                          editingAction.dueDate
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(event) =>
                    setEditingAction((current) =>
                      current
                        ? {
                            ...current,
                            dueDate:
                              event.target.value
                                ? new Date(
                                    event.target.value
                                  ).toISOString()
                                : null,
                          }
                        : null
                    )
                  }
                />
              </div>

              <div className="edit-field">
                <label htmlFor="edit-summary">
                  Summary
                </label>

                <textarea
                  id="edit-summary"
                  value={
                    editingAction.summary ?? ""
                  }
                  onChange={(event) =>
                    setEditingAction((current) =>
                      current
                        ? {
                            ...current,
                            summary:
                              event.target.value,
                          }
                        : null
                    )
                  }
                  rows={5}
                />
              </div>
            </div>

            <div className="source-email-footer">
              <button
                type="button"
                onClick={() =>
                  setEditingAction(null)
                }
                className="review-button secondary"
                disabled={
                  processingId === editingAction.id
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="review-button accept"
                onClick={handleEditSave}
                disabled={
                  processingId === editingAction.id
                }
              >
                <Check size={16} />

                {processingId === editingAction.id
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Source email panel */}
        {viewingEmail?.email && (
          <div className="source-email-panel">
            <div className="source-email-header">
              <div className="source-email-title">
                <Mail size={18} />
                <h3>Source Email</h3>
              </div>

              <button
                type="button"
                className="source-email-close"
                onClick={() =>
                  setViewingEmail(null)
                }
                aria-label="Close source email"
              >
                <X size={20} />
              </button>
            </div>

            <div className="source-email-subject">
              <strong>
                {viewingEmail.email.subject}
              </strong>
            </div>

            <div className="source-email-meta">
              <div>
                <strong>From:</strong>{" "}
                {viewingEmail.email.fromName} (
                {viewingEmail.email.fromEmail})
              </div>

              <div>
                <strong>Received:</strong>{" "}
                {new Date(
                  viewingEmail.email.receivedAt
                ).toLocaleString()}
              </div>
            </div>

            <div className="source-email-body">
              {viewingEmail.email.body
                .split("\n")
                .map((line, index) =>
                  line.trim() === "" ? (
                    <br key={index} />
                  ) : (
                    <p key={index}>{line}</p>
                  )
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}