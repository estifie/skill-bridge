import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/frontmatter.js";

describe("parseFrontmatter", () => {
  it("tolerates community skills with annotated closing delimiters", () => {
    const parsed = parseFrontmatter(`---
name: alpha-vantage
description: Access market data.
risk: unknown
source: community
--- Unknown
metadata:
    skill-author: K-Dense Inc.
---

# Alpha Vantage
`);

    expect(parsed.attributes.name).toBe("alpha-vantage");
    expect(parsed.attributes.description).toBe("Access market data.");
    expect(parsed.body.trimStart()).toBe("# Alpha Vantage\n");
  });

  it("falls back to simple attributes when YAML values are malformed", () => {
    const parsed = parseFrontmatter(`---
name: broken-skill
description: "Unclosed quote
---

# Broken Skill
`);

    expect(parsed.attributes.name).toBe("broken-skill");
    expect(parsed.attributes.description).toBe('"Unclosed quote');
    expect(parsed.body.trimStart()).toBe("# Broken Skill\n");
  });
});
