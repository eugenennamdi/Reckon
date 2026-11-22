import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAgentSkillsIndex,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildMcpServerCard,
  buildPageMarkdown,
  buildSkillMd,
} from "../src/lib/agent-docs";
import { prefersMarkdown } from "../src/middleware";

describe("AI-agent discovery & Markdown negotiation", () => {
  it("matches Accept: text/markdown without hijacking browser HTML requests", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
    assert.equal(prefersMarkdown("text/markdown, */*;q=0.8"), true);
    assert.equal(prefersMarkdown("text/markdown;q=1.0, text/html;q=0.9"), true);
    assert.equal(prefersMarkdown("text/html, text/markdown"), true);

    assert.equal(
      prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
      false,
    );
    assert.equal(prefersMarkdown("text/html, text/markdown;q=0.5"), false);
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
    assert.equal(prefersMarkdown("*/*"), false);
    assert.equal(prefersMarkdown(null), false);
  });

  it("generates complete llms.txt, llms-full.txt, skill.md, and well-known discovery manifests", () => {
    const site = "https://reckon.markets";
    const llms = buildLlmsTxt(site);
    assert.match(llms, /## When to Use Reckon/);
    assert.match(llms, /0xb19c478D4378F6AffCE65a08B0eA1c6A123B257C/);
    assert.match(llms, /https:\/\/reckon\.markets\/api\/mcp/);

    const full = buildLlmsFullTxt(site);
    assert.match(full, /Lambert WSWM/);
    assert.match(full, /reckon_prepare_commit/);

    const skill = buildSkillMd(site);
    assert.match(skill, /^---\nname: reckon\n/);

    const card = buildMcpServerCard(site);
    assert.equal(card.authentication.required, false);
    assert.equal(card.tools.length, 8);
    assert.equal(card.transport.endpoint, "https://reckon.markets/api/mcp");

    const skillsIdx = buildAgentSkillsIndex(site);
    assert.equal(skillsIdx.skills.length, 1);
    assert.match(skillsIdx.skills[0].digest, /^sha256:[a-f0-9]{64}$/);
  });

  it("serves live Markdown for core routes and agent-friendly Markdown 404 for unknown paths", () => {
    const site = "https://reckon.markets";
    for (const p of ["/", "/docs", "/leaderboard", "/signals", "/security", "/about", "/contact", "/privacy"]) {
      const res = buildPageMarkdown(p, site);
      assert.equal(res.status, 200, `expected 200 for ${p}`);
      assert.ok(res.markdown.length >= 200, `expected rich markdown for ${p}`);
    }

    const missing = buildPageMarkdown("/__nonexistent-404-probe", site);
    assert.equal(missing.status, 404);
    assert.match(missing.markdown, /llms\.txt/);
    assert.match(missing.markdown, /\/docs/);
    assert.match(missing.markdown, /sitemap\.xml/);
  });
});
