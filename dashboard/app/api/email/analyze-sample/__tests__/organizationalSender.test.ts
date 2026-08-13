import { describe, it, expect } from "vitest";
import { isOrganizationalSender, fixDraftGreeting } from "../route";

describe("isOrganizationalSender", () => {
  describe("organizational keyword detection", () => {
    it("detects 'Claims' as organizational", () => {
      expect(isOrganizationalSender("Claims", "claims@insurance.com")).toBe(true);
    });

    it("detects 'Billing' as organizational", () => {
      expect(isOrganizationalSender("Billing", "billing@company.com")).toBe(true);
    });

    it("detects 'Support' as organizational", () => {
      expect(isOrganizationalSender("Support", "support@company.com")).toBe(true);
    });

    it("detects 'NoReply' as organizational", () => {
      expect(isOrganizationalSender("NoReply", "noreply@company.com")).toBe(true);
    });

    it("detects 'Customer Service' as organizational", () => {
      expect(isOrganizationalSender("Customer Service", "cs@company.com")).toBe(true);
    });

    it("is case-insensitive for keywords", () => {
      expect(isOrganizationalSender("CLAIMS", "info@insurance.com")).toBe(true);
      expect(isOrganizationalSender("billing", "info@company.com")).toBe(true);
      expect(isOrganizationalSender("SuPpOrT", "info@company.com")).toBe(true);
    });

    it("detects keywords within longer names", () => {
      expect(isOrganizationalSender("ABC Claims Department", "info@insurance.com")).toBe(
        true
      );
      expect(isOrganizationalSender("Billing Team", "info@company.com")).toBe(true);
    });
  });

  describe("email local-part matching", () => {
    it("detects when fromName matches email local-part", () => {
      expect(isOrganizationalSender("noreply", "noreply@company.com")).toBe(true);
      expect(isOrganizationalSender("info", "info@company.com")).toBe(true);
    });

    it("detects when fromName contains email local-part", () => {
      expect(isOrganizationalSender("NoReply System", "noreply@company.com")).toBe(true);
    });

    it("detects organizational keywords in email local-part", () => {
      expect(isOrganizationalSender("Acme Corp", "support@acme.com")).toBe(true);
      expect(isOrganizationalSender("Team", "billing@company.com")).toBe(true);
    });
  });

  describe("human names", () => {
    it("recognizes typical human names as non-organizational", () => {
      expect(isOrganizationalSender("John Doe", "john.doe@company.com")).toBe(false);
      expect(isOrganizationalSender("Jane Smith", "jane@company.com")).toBe(false);
      expect(isOrganizationalSender("Dr. Robert Wilson", "rwilson@clinic.com")).toBe(false);
    });

    it("recognizes single proper names as non-organizational", () => {
      expect(isOrganizationalSender("Madonna", "madonna@company.com")).toBe(false);
      expect(isOrganizationalSender("Alice", "alice@company.com")).toBe(false);
    });

    it("detects single non-proper words as organizational", () => {
      // "CLAIMS" is all caps, not proper name format
      expect(isOrganizationalSender("CLAIMS", "claims@company.com")).toBe(true);
      // "claims" is all lowercase, not proper name format
      expect(isOrganizationalSender("claims", "claims@company.com")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty strings gracefully", () => {
      expect(isOrganizationalSender("", "test@company.com")).toBe(false);
    });

    it("handles names with extra whitespace", () => {
      expect(isOrganizationalSender("  Claims  ", "claims@company.com")).toBe(true);
      expect(isOrganizationalSender("  John Doe  ", "john@company.com")).toBe(false);
    });

    it("handles mixed case organizational names", () => {
      expect(isOrganizationalSender("No-Reply", "noreply@company.com")).toBe(true);
    });
  });
});

describe("fixDraftGreeting - organizational vs human senders", () => {
  describe("organizational senders get neutral greetings", () => {
    it("replaces 'Dear Claims' with 'Hello,'", () => {
      const draft = "Dear Claims,\n\nWe received your claim.";
      const result = fixDraftGreeting(draft, "Claims", "claims@insurance.com");
      expect(result).toBe("Hello,\n\nWe received your claim.");
    });

    it("replaces 'Hello Billing' with 'Hello,'", () => {
      const draft = "Hello Billing,\n\nThank you for the invoice.";
      const result = fixDraftGreeting(draft, "Billing", "billing@company.com");
      expect(result).toBe("Hello,\n\nThank you for the invoice.");
    });

    it("replaces 'Hi Support' with 'Hello,'", () => {
      const draft = "Hi Support,\n\nThanks for reaching out.";
      const result = fixDraftGreeting(draft, "Support", "support@company.com");
      expect(result).toBe("Hello,\n\nThanks for reaching out.");
    });

    it("replaces 'Dear [unavailable]' for organizational sender with 'Hello,'", () => {
      const draft = "Dear [unavailable],\n\nThank you.";
      const result = fixDraftGreeting(draft, "NoReply", "noreply@company.com");
      expect(result).toBe("Hello,\n\nThank you.");
    });

    it("handles case variations in greetings", () => {
      const draft1 = "DEAR Claims,\n\nThank you.";
      const draft2 = "dear Billing,\n\nThank you.";

      expect(fixDraftGreeting(draft1, "Claims", "claims@insurance.com")).toBe(
        "Hello,\n\nThank you."
      );
      expect(fixDraftGreeting(draft2, "Billing", "billing@company.com")).toBe(
        "Hello,\n\nThank you."
      );
    });
  });

  describe("human senders get personalized greetings", () => {
    it("fixes 'Dear [unavailable]' with first name for human sender", () => {
      const draft = "Dear [unavailable],\n\nThank you for your email.";
      const result = fixDraftGreeting(draft, "John Doe", "john.doe@company.com");
      expect(result).toBe("Dear John,\n\nThank you for your email.");
    });

    it("does NOT modify 'Dear John' for human sender", () => {
      const draft = "Dear John,\n\nThank you for your email.";
      const result = fixDraftGreeting(draft, "John Doe", "john.doe@company.com");
      // Already has correct name, should not change
      expect(result).toBe("Dear John,\n\nThank you for your email.");
    });

    it("preserves greeting word for human senders", () => {
      const draft1 = "Hello [unavailable],\n\nThank you.";
      const draft2 = "Hi [unavailable],\n\nThank you.";
      const name = "Jane Smith";
      const email = "jane@company.com";

      expect(fixDraftGreeting(draft1, name, email)).toBe("Hello Jane,\n\nThank you.");
      expect(fixDraftGreeting(draft2, name, email)).toBe("Hi Jane,\n\nThank you.");
    });

    it("extracts first name from full name for humans", () => {
      const draft = "Dear [unavailable],\n\nThank you.";
      const result = fixDraftGreeting(
        draft,
        "Dr. Robert Alexander Thompson",
        "rthompson@clinic.com"
      );
      expect(result).toBe("Dear Dr.,\n\nThank you.");
    });
  });

  describe("edge cases and mixed scenarios", () => {
    it("does NOT modify greetings in middle of draft", () => {
      const draft =
        "Hello,\n\nPlease contact Claims department. Dear Claims representative will help you.";
      const result = fixDraftGreeting(draft, "Claims", "claims@insurance.com");
      // Only first greeting should be affected
      expect(result).toBe(
        "Hello,\n\nPlease contact Claims department. Dear Claims representative will help you."
      );
    });

    it("handles drafts without greetings", () => {
      const draft = "Thank you for your message.\n\nWe will respond soon.";
      const result = fixDraftGreeting(draft, "Claims", "claims@insurance.com");
      expect(result).toBe(draft);
    });

    it("handles organizational sender with [unavailable]", () => {
      const draft = "Dear [unavailable],\n\nThank you.";
      const result = fixDraftGreeting(draft, "Customer Service", "cs@company.com");
      expect(result).toBe("Hello,\n\nThank you.");
    });

    it("preserves rest of draft after greeting replacement", () => {
      const draft =
        "Dear Claims,\n\nThank you for your claim submission.\n\nWe will review it shortly.\n\nBest regards,\nDr. Song's Office";
      const result = fixDraftGreeting(draft, "Claims", "claims@insurance.com");
      expect(result).toBe(
        "Hello,\n\nThank you for your claim submission.\n\nWe will review it shortly.\n\nBest regards,\nDr. Song's Office"
      );
    });

    it("handles single-word human names correctly", () => {
      const draft = "Hello [unavailable],\n\nThank you.";
      const result = fixDraftGreeting(draft, "Madonna", "madonna@music.com");
      // "Madonna" is a proper name, not organizational
      expect(result).toBe("Hello Madonna,\n\nThank you.");
    });

    it("handles noreply correctly", () => {
      const draft = "Dear [unavailable],\n\nThank you.";
      const result = fixDraftGreeting(draft, "no-reply", "no-reply@company.com");
      // "no-reply" is organizational
      expect(result).toBe("Hello,\n\nThank you.");
    });
  });
});
