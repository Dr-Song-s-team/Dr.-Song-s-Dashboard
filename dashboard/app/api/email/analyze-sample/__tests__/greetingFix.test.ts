import { describe, it, expect } from "vitest";
import { fixDraftGreeting } from "@/lib/ai/analysisPostprocess";

describe("fixDraftGreeting - human senders", () => {
  it("fixes 'Dear [unavailable]' with sender's first name", () => {
    const draft = "Dear [unavailable],\n\nThank you for your email.";
    const senderName = "John Doe";
    const senderEmail = "john.doe@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Dear John,\n\nThank you for your email.");
  });

  it("fixes 'Hello [unavailable]' with sender's first name", () => {
    const draft = "Hello [unavailable],\n\nWe received your request.";
    const senderName = "Jane Smith";
    const senderEmail = "jane.smith@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Hello Jane,\n\nWe received your request.");
  });

  it("fixes 'Hi [unavailable]' with sender's first name", () => {
    const draft = "Hi [unavailable],\n\nThanks for reaching out.";
    const senderName = "Michael Johnson";
    const senderEmail = "michael.j@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Hi Michael,\n\nThanks for reaching out.");
  });

  it("is case-insensitive for greeting words", () => {
    const draft1 = "DEAR [unavailable],\n\nThank you.";
    const draft2 = "dear [unavailable],\n\nThank you.";
    const draft3 = "Dear [unavailable],\n\nThank you.";
    const senderName = "Sarah Lee";

    expect(fixDraftGreeting(draft1, senderName, "sender@example.com")).toBe("DEAR Sarah,\n\nThank you.");
    expect(fixDraftGreeting(draft2, senderName, "sender@example.com")).toBe("dear Sarah,\n\nThank you.");
    expect(fixDraftGreeting(draft3, senderName, "sender@example.com")).toBe("Dear Sarah,\n\nThank you.");
  });

  it("extracts only first name from full name", () => {
    const draft = "Dear [unavailable],\n\nThank you.";
    const senderName = "Dr. Robert Alexander Thompson Jr.";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // Should extract "Dr." as first token (splitting on whitespace)
    expect(result).toBe("Dear Dr.,\n\nThank you.");
  });

  it("handles single-word names", () => {
    const draft = "Hello [unavailable],\n\nThank you.";
    const senderName = "Madonna";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    expect(result).toBe("Hello Madonna,\n\nThank you.");
  });

  it("does NOT fix [unavailable] in middle of draft (non-greeting)", () => {
    const draft =
      "Dear John,\n\nWe need the form from [unavailable] before proceeding.";
    const senderName = "Jane Doe";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // Should NOT change - [unavailable] is not in greeting position
    expect(result).toBe(draft);
  });

  it("does NOT fix if greeting already has a name (no [unavailable])", () => {
    const draft = "Dear Sarah,\n\nThank you for your message.";
    const senderName = "Sarah Thompson";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // Should not change - already has correct name
    expect(result).toBe(draft);
  });

  it("does NOT fix [unavailable] at start if not a recognized greeting", () => {
    const draft = "[unavailable] sent us a message yesterday.";
    const senderName = "John Doe";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // Should not change - not a greeting pattern
    expect(result).toBe(draft);
  });

  it("handles names with extra whitespace", () => {
    const draft = "Dear [unavailable],\n\nThank you.";
    const senderName = "  Alice   Johnson  ";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    expect(result).toBe("Dear Alice,\n\nThank you.");
  });

  it("handles empty sender name gracefully", () => {
    const draft = "Dear [unavailable],\n\nThank you.";
    const senderName = "";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // With empty name, split returns [""], so result is "Dear ,"
    // This is edge case but better than crashing
    expect(result).toBe("Dear ,\n\nThank you.");
  });

  it("preserves greeting capitalization in replacement", () => {
    const draft1 = "Dear [unavailable], thank you.";
    const draft2 = "dear [unavailable], thank you.";
    const draft3 = "DEAR [unavailable], thank you.";
    const senderName = "Tom Wilson";

    // The greeting word's capitalization is preserved via $1 in regex
    expect(fixDraftGreeting(draft1, senderName, "sender@example.com")).toBe("Dear Tom, thank you.");
    expect(fixDraftGreeting(draft2, senderName, "sender@example.com")).toBe("dear Tom, thank you.");
    expect(fixDraftGreeting(draft3, senderName, "sender@example.com")).toBe("DEAR Tom, thank you.");
  });

  it("only fixes greeting at the very start of draft", () => {
    const draft = "\n\nDear [unavailable],\n\nThank you.";
    const senderName = "Emily Davis";

    const result = fixDraftGreeting(draft, senderName, "sender@example.com");

    // Regex uses ^, so leading newlines prevent match
    expect(result).toBe(draft);
  });

  it("handles multiple [unavailable] but only fixes greeting one", () => {
    const draft =
      "Dear [unavailable],\n\nWe received your form. Please contact [unavailable] for more info.";
    const senderName = "Chris Martin";

    const result = fixDraftGreeting(draft, senderName, "chris.martin@example.com");

    // Only the greeting should be fixed
    expect(result).toBe(
      "Dear Chris,\n\nWe received your form. Please contact [unavailable] for more info."
    );
  });

  it("fixes greeting with raw email address using first name", () => {
    const draft = "Dear diana.textor@example.com,\n\nThank you for your inquiry.";
    const senderName = "Diana Textor";
    const senderEmail = "diana.textor@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Dear Diana,\n\nThank you for your inquiry.");
  });

  it("fixes greeting with email address + empty senderName to neutral greeting", () => {
    const draft = "Dear unknown@example.com,\n\nThank you.";
    const senderName = "";
    const senderEmail = "unknown@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Hello,\n\nThank you.");
  });

  it("regression: [unavailable] still replaced with first name (untouched)", () => {
    const draft = "Dear [unavailable],\n\nThank you for reaching out.";
    const senderName = "Jane Smith";
    const senderEmail = "jane.smith@example.com";

    const result = fixDraftGreeting(draft, senderName, senderEmail);

    expect(result).toBe("Dear Jane,\n\nThank you for reaching out.");
  });
});
