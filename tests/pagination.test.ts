import { describe, expect, it } from "vitest";
import { collectPaginated } from "../src/jira/pagination.js";

describe("collectPaginated", () => {
  it("collects issue pages until total is reached", async () => {
    const pages = [
      { startAt: 0, total: 3, issues: [{ key: "A-1" }, { key: "A-2" }] },
      { startAt: 2, total: 3, issues: [{ key: "A-3" }] },
    ];

    const result = await collectPaginated(async (startAt) => {
      return (startAt === 0 ? pages[0] : pages[1])!;
    }, {
      pageSize: 2,
      maxItems: 10,
    });

    expect(result.items).toHaveLength(3);
    expect(result.pages).toBe(2);
    expect(result.total).toBe(3);
  });
});
