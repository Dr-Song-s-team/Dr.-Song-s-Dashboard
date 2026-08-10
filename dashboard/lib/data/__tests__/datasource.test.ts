import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockDataSource } from "../MockDataSource";
import { PracticeQDataSource } from "../PracticeQDataSource";
import type { ClinicDataSource } from "../ClinicDataSource";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    email: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("ClinicDataSource", () => {
  describe("MockDataSource", () => {
    it("satisfies ClinicDataSource interface", () => {
      const source: ClinicDataSource = new MockDataSource();
      expect(source).toBeDefined();
      expect(typeof source.listPatients).toBe("function");
      expect(typeof source.getPatient).toBe("function");
      expect(typeof source.createPatient).toBe("function");
      expect(typeof source.updatePatient).toBe("function");
      expect(typeof source.listEmails).toBe("function");
      expect(typeof source.getEmail).toBe("function");
      expect(typeof source.updateEmailStatus).toBe("function");
      expect(typeof source.listInsurerLabels).toBe("function");
      expect(typeof source.listTasks).toBe("function");
      expect(typeof source.getTask).toBe("function");
      expect(typeof source.findTaskByEmailAndTitle).toBe("function");
      expect(typeof source.createTask).toBe("function");
      expect(typeof source.updateTask).toBe("function");
      expect(typeof source.deleteTask).toBe("function");
      expect(typeof source.setTaskStatus).toBe("function");
    });
  });

  describe("PracticeQDataSource", () => {
    let source: PracticeQDataSource;

    beforeEach(() => {
      source = new PracticeQDataSource();
    });

    it("satisfies ClinicDataSource interface", () => {
      const typed: ClinicDataSource = source;
      expect(typed).toBeDefined();
    });

    it("listPatients throws not implemented error", async () => {
      await expect(source.listPatients()).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("getPatient throws not implemented error", async () => {
      await expect(source.getPatient("test-id")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("createPatient throws not implemented error", async () => {
      await expect(
        source.createPatient({
          firstName: "John",
          lastName: "Doe",
          dob: new Date("1990-01-01"),
          phone: "555-1234",
          email: "john@example.com",
          address: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
          insurer: "Aetna",
          memberId: "ABC123",
          authLimit: 20,
        }),
      ).rejects.toThrow("PracticeQDataSource not implemented — pending API access + BAA");
    });

    it("updatePatient throws not implemented error", async () => {
      await expect(
        source.updatePatient("test-id", { firstName: "Jane" }),
      ).rejects.toThrow("PracticeQDataSource not implemented — pending API access + BAA");
    });

    it("listEmails throws not implemented error", async () => {
      await expect(source.listEmails()).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("getEmail throws not implemented error", async () => {
      await expect(source.getEmail("test-id")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("updateEmailStatus throws not implemented error", async () => {
      await expect(source.updateEmailStatus("test-id", "READ")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("listInsurerLabels throws not implemented error", async () => {
      await expect(source.listInsurerLabels()).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("listTasks throws not implemented error", async () => {
      await expect(source.listTasks()).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("getTask throws not implemented error", async () => {
      await expect(source.getTask("test-id")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("findTaskByEmailAndTitle throws not implemented error", async () => {
      await expect(source.findTaskByEmailAndTitle("email-id", "Test Task")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("createTask throws not implemented error", async () => {
      await expect(
        source.createTask({
          title: "Test Task",
          description: "Test description",
          dueDate: new Date(),
        }),
      ).rejects.toThrow("PracticeQDataSource not implemented — pending API access + BAA");
    });

    it("updateTask throws not implemented error", async () => {
      await expect(source.updateTask("test-id", { title: "Updated" })).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("deleteTask throws not implemented error", async () => {
      await expect(source.deleteTask("test-id")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });

    it("setTaskStatus throws not implemented error", async () => {
      await expect(source.setTaskStatus("test-id", "COMPLETE")).rejects.toThrow(
        "PracticeQDataSource not implemented — pending API access + BAA",
      );
    });
  });
});
