import "server-only";

/**
 * Current OpenAI models reason before they answer. Those reasoning tokens are
 * billed and counted against `max_output_tokens`, but they never appear in
 * `output_text`. A budget sized for the visible answer alone therefore comes
 * back with status "incomplete" and nothing in it - the provider looks broken
 * when it is only under-funded. Every Responses call adds a reasoning
 * allowance on top of its answer allowance.
 *
 * Effort is pinned rather than left to the model default so that cost and
 * latency stay predictable and a model change cannot silently alter them.
 */

/**
 * The policy answer is the one output an officer may act on, so it gets the
 * larger think budget. Unused tokens are not billed; the ceiling only has to
 * be high enough that reasoning never starves the answer.
 */
export const POLICY_ANSWER_REASONING_EFFORT = "medium" as const;
export const POLICY_ANSWER_REASONING_TOKENS = 8_000;

/**
 * Drafting and extraction produce suggestions that an officer reviews and
 * rewrites before anything is filed, so they take the cheaper setting.
 */
export const DRAFTING_REASONING_EFFORT = "low" as const;
export const DRAFTING_REASONING_TOKENS = 4_000;
