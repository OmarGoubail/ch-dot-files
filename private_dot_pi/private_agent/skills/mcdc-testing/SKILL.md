---
name: mcdc-testing
description: Apply unique-cause Modified Condition/Decision Coverage to important compound decisions and produce justified, readable executable tests.
license: MIT
---

# MC/DC Testing

Use Modified Condition/Decision Coverage when testing important compound decisions.

## Goal

Show that every atomic condition can independently change the decision’s result.

For each condition, find two test cases where:

1. The target condition changes.
2. The overall decision changes.
3. All other conditions stay the same.

This is **unique-cause MC/DC**, which should be the default.

## Procedure

### 1. Extract the decision

Identify the complete Boolean expression, including language-specific precedence, negation, short-circuiting, and evaluation semantics.

Example:

```text
active AND (admin OR owner)
```

### 2. Name the atomic conditions

```text
A = active
B = admin
C = owner
```

Normalized expression:

```text
A AND (B OR C)
```

Do not treat a compound subexpression as one condition when its atomic terms can be tested independently.

### 3. Find an independence pair for each condition

A valid test set is:

| Test |  A |  B |  C | Result |
| ---- | -: | -: | -: | -----: |
| T1   |  0 |  1 |  0 |      0 |
| T2   |  1 |  1 |  0 |      1 |
| T3   |  1 |  0 |  0 |      0 |
| T4   |  1 |  0 |  1 |      1 |

Independence evidence:

```text
A: T1 ↔ T2
B: T2 ↔ T3
C: T3 ↔ T4
```

For every pair, verify that only the named condition changes and that the decision result flips.

### 4. Convert the rows into readable tests

Use domain values rather than abstract booleans where possible.

Prefer:

```text
inactive admin → denied
active admin   → allowed
```

over:

```text
A=0, B=1, C=0
A=1, B=1, C=0
```

Each test should clearly identify the rule it proves. Test through the project’s public seam and use the project’s language and test framework.

### 5. Report the result

When analyzing code, return:

1. The decision under test.
2. Its atomic conditions.
3. The normalized expression.
4. A compact test matrix.
5. The independence pair for each condition.
6. Executable tests in the project’s language and framework.

## Bitmasks

Treat every relevant bit check as a Boolean condition.

Example:

```text
READ AND (WRITE OR ADMIN)
```

To prove that `READ` matters, compare two inputs that differ only in the read bit:

```text
010 → denied
011 → allowed
```

Also test separately that:

- Relevant bits affect the intended behavior.
- Unrelated bits do not grant unintended behavior.
- Unknown bits are rejected or ignored according to the specification.

Do not require every bit to affect every decision. Only bits participating in that decision must demonstrate independent influence.

## Important rules

- Branch coverage alone is not MC/DC.
- Testing everything true and everything false is not MC/DC.
- A pair is invalid if multiple conditions change.
- A pair is invalid if the final result does not change.
- Select values that prevent other conditions from masking the target condition.
- Do not confuse MC/DC with boundary-value testing; apply both when conditions contain comparisons.
- Do not claim strict MC/DC when conditions cannot vary independently.
- When unique-cause MC/DC is impossible because conditions are logically coupled, explain the limitation. Use a masking MC/DC pair only when explicitly identified and justified.
- Do not assume that `N + 1` tests are always sufficient. Minimize the test set when practical, but correctness of the independence evidence is more important than reaching a theoretical minimum.

## Review checklist

Before claiming MC/DC coverage, verify:

- The complete decision was extracted without dropping implicit conditions.
- Conditions are atomic and named consistently.
- Every independence pair changes exactly one condition.
- Every independence pair flips the decision result.
- The tests use domain values and the correct public seam.
- Coupled conditions, short-circuit behavior, unknown bits, and boundary cases are reported honestly.
