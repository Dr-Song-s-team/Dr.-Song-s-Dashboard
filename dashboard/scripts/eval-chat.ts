/**
 * Layer 2: Chat evaluation script.
 * Tests real Groq + real dev DB with predefined eval cases.
 * Run manually: npm run eval:chat
 *
 * NOT part of automated test suite - requires real API key and DB.
 */

type EvalCase = {
  question: string;
  mustContain: string[];
  mustNotContain: string[];
};

const EVAL_CASES: EvalCase[] = [
  // Test 1: Action-required emails
  {
    question: "What emails need action?",
    mustContain: ["action"],
    mustNotContain: ["{{", "[unavailable]"],
  },

  // Test 2: Alice Vance (mentioned in emails, not a patient)
  {
    question: "What's the status of Alice Vance?",
    mustContain: ["Alice", "Vance"],
    mustNotContain: ["don't have that information", "{{", "[unavailable]"],
  },

  // Test 3: Alice Vance insurer (follow-up question - softened behavior)
  {
    question: "What insurer does Alice Vance have?",
    mustContain: ["Alice"],
    mustNotContain: ["{{", "[unavailable]"],
  },

  // Test 4: Maria Santos (actual patient)
  {
    question: "What's Maria Santos's insurer?",
    mustContain: ["Maria", "Santos", "Blue Cross"],
    mustNotContain: ["don't have that information", "{{", "[unavailable]"],
  },

  // Test 5: Recent claims emails
  {
    question: "Summarize recent claims emails",
    mustContain: ["claim"],
    mustNotContain: ["{{", "[unavailable]"],
  },

  // Test 6: General knowledge (should refuse - no clinic data)
  {
    question: "What's the weather today?",
    mustContain: ["weather"],
    mustNotContain: ["{{", "[unavailable]", "sunny", "degrees"],
  },

  // Test 7: Authorization deadlines
  {
    question: "Are there any authorization deadlines coming up?",
    mustContain: ["authorization"],
    mustNotContain: ["{{", "[unavailable]"],
  },

  // Test 8: Patient count or list
  {
    question: "How many patients do we have?",
    mustContain: [], // Any answer is acceptable
    mustNotContain: ["{{", "[unavailable]"],
  },
];

const DELAY_MS = 15000; // 15 seconds between requests (Groq free tier: 12000 TPM, ~2 calls per question)

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runEval(evalCase: EvalCase, index: number, retryCount = 0): Promise<{
  pass: boolean;
  answer: string;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Call the chat API
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: evalCase.question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle 429 rate limit with retry
      if (response.status === 429 && retryCount === 0) {
        console.log(`    ⚠ Rate limited, attempting retry...`);

        // Try to parse "try again in X seconds" from error message
        let waitTime = 2000; // default 2 seconds
        if (typeof errorData.error === 'string') {
          const match = errorData.error.match(/try again in (\d+(?:\.\d+)?)\s*seconds?/i);
          if (match) {
            waitTime = (parseFloat(match[1]) + 2) * 1000; // Add 2 extra seconds
          }
        }

        console.log(`    ⏱ Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);

        // Retry once
        return runEval(evalCase, index, retryCount + 1);
      }

      errors.push(`HTTP ${response.status}: ${errorData.error || "Unknown error"}`);
      return { pass: false, answer: "", errors };
    }

    const data = await response.json();
    const answer = data.answer || "";

    // Check mustContain
    for (const term of evalCase.mustContain) {
      if (!answer.toLowerCase().includes(term.toLowerCase())) {
        errors.push(`Missing required term: "${term}"`);
      }
    }

    // Check mustNotContain
    for (const term of evalCase.mustNotContain) {
      if (answer.toLowerCase().includes(term.toLowerCase())) {
        errors.push(`Contains forbidden term: "${term}"`);
      }
    }

    return {
      pass: errors.length === 0,
      answer,
      errors,
    };
  } catch (error) {
    errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`);
    return { pass: false, answer: "", errors };
  }
}

async function main() {
  console.log("=== Chat Evaluation Suite ===\n");
  console.log(`Running ${EVAL_CASES.length} eval cases with ${DELAY_MS}ms delay between requests...\n`);

  const results: Array<{
    index: number;
    question: string;
    pass: boolean;
    answer: string;
    errors: string[];
  }> = [];

  for (let i = 0; i < EVAL_CASES.length; i++) {
    const evalCase = EVAL_CASES[i];
    console.log(`[${i + 1}/${EVAL_CASES.length}] Evaluating: "${evalCase.question}"`);

    const result = await runEval(evalCase, i);
    results.push({
      index: i + 1,
      question: evalCase.question,
      ...result,
    });

    console.log(`    → ${result.pass ? "✓ PASS" : "✗ FAIL"}`);
    if (!result.pass) {
      result.errors.forEach((err) => console.log(`      - ${err}`));
    }

    // Delay between requests (except after last one)
    if (i < EVAL_CASES.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Print summary table
  console.log("\n=== Results Summary ===\n");

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;

  console.log("┌──────┬────────┬─────────────────────────────────────────────────┐");
  console.log("│ Case │ Result │ Question                                        │");
  console.log("├──────┼────────┼─────────────────────────────────────────────────┤");

  results.forEach((r) => {
    const result = r.pass ? " PASS " : " FAIL ";
    const question = r.question.slice(0, 45).padEnd(45);
    const caseNum = r.index.toString().padStart(4);
    console.log(`│ ${caseNum} │ ${result} │ ${question}    │`);
  });

  console.log("└──────┴────────┴─────────────────────────────────────────────────┘");

  console.log(`\nTotal: ${passCount} passed, ${failCount} failed\n`);

  // Print failed cases with full details
  if (failCount > 0) {
    console.log("=== Failed Cases Details ===\n");

    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        console.log(`Case ${r.index}: "${r.question}"`);
        console.log(`Errors:`);
        r.errors.forEach((err) => console.log(`  - ${err}`));
        console.log(`Answer (first 200 chars):`);
        console.log(`  ${r.answer.slice(0, 200)}${r.answer.length > 200 ? "..." : ""}`);
        console.log();
      });
  }

  // Exit with error code if any failed
  if (failCount > 0) {
    process.exit(1);
  }

  console.log("All evaluations passed! ✓");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
