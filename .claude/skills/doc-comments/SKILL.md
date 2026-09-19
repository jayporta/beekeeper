---
name: doc-comments
description: >
  TSDoc standards for Beekeeper's TypeScript and React code, so VS Code shows full hover tooltips and parameter hints. Use when writing or reviewing doc comments on exported functions, types, interfaces, React components, or props.
---

# Doc comments

Doc comments describe the contract as it stands. Never narrate how the code used to work.

Use `/** ... */` TSDoc. Markdown is allowed, and so are the tags `@param`, `@returns`, `@throws`, `@remarks`, `@example`, and `@defaultValue`. Add a tag only when it tells the reader something the signature doesn't.

## Functions

A one-line summary, then a tag for each parameter. Functions take at most two parameters, so anything more goes in an options object, and each field gets documented on its interface.

````ts
/** Options for {@link estimateCost}. */
export interface EstimateCostOptions {
  /** Token counts for one API response, after deduplication. */
  usage: TokenUsage
  /** Model identifier as it appears in the transcript, e.g. `claude-sonnet-5`. */
  model: string
}

/**
 * Estimates the API-equivalent cost of one response in US dollars.
 *
 * @remarks
 * Subscription plans aren't billed per token, so this is an estimate for
 * comparison, not what the user actually paid.
 *
 * @param options - The response's token usage and model.
 * @returns The estimated cost, or `{ ok: false }` when the model has no known price.
 *
 * @example
 * ```ts
 * const result = estimateCost({ usage, model: 'claude-sonnet-5' })
 * ```
 */
export function estimateCost(options: EstimateCostOptions): Result<number, UnpricedModel> {
  // ...
}
````

## Types and interfaces

A summary on the type, and a one-line `/** ... */` on every member.

```ts
/** One agent in a session: the lead, a subagent, or a teammate. */
export interface Agent {
  /** Agent ID, taken from the transcript filename. */
  id: AgentId
  /** The agent type, e.g. `Explore` or a custom agent name. */
  type: string
  /** Team name when the agent is a teammate in an agent team. */
  teamName?: string
}
```

## React components

A summary on the component with an `@example` of typical JSX, and a one-line comment on every prop. Optional props with a default get `@defaultValue`.

````tsx
import styles from './StatusBadge.module.css'

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  /** Text shown inside the badge. */
  label: string
  /**
   * Visual weight of the badge.
   * @defaultValue `'neutral'`
   */
  tone?: 'neutral' | 'running' | 'error'
}

/**
 * Small inline label for a session or agent status.
 *
 * @example
 * ```tsx
 * <StatusBadge label="Running" tone="running" />
 * ```
 */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps): React.JSX.Element {
  return <span className={styles[tone]}>{label}</span>
}
````
