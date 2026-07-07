---
name: elixir-code-quality
description: "Use when writing, editing, or reviewing Elixir code in .ex or .exs files. Enforces idiomatic Elixir: pattern matching, pipe chains, with statements, tagged tuples, precise naming, small functions, and quality rules."
---

# Elixir Code Quality

Use this skill for every Elixir file you write or modify. It keeps code idiomatic, readable, and maintainable. These rules apply to application code, scripts, and tests unless a project convention explicitly overrides them.

## RULES — Follow these with no exceptions

1. **Pattern match first.** Use function heads, `case`, and guards for control flow before `if/else`.
2. **Pipe chains for sequential transforms.** Use `|>` when two or more transformations follow in order.
3. **`with` for sequential fallible steps.** Use `with` instead of nested `case` for two or more operations that can fail.
4. **Return tagged tuples.** Fallible functions return `{:ok, result}` or `{:error, reason}`.
5. **Small, single-responsibility functions.** A function should fit on one screen without scrolling.
6. **No nested `if/else`.** Flatten with `case`, `cond`, multi-clause functions, or `with`.
7. **Name things precisely.** Predicate functions end with `?`; raising functions end with `!`.
8. **Let it crash for impossible states.** Do not write defensive `nil` checks for data the contract guarantees.
9. **Prefer explicit over clever.** Avoid macro magic, metaprogramming, and DSLs when plain functions are clearer.
10. **Reuse existing project patterns.** Match surrounding code before introducing a new style.

## Pattern matching over conditionals

Prefer matching in function heads and `case` clauses.

**Bad:**
```elixir
def process(result) do
  if result.status == :ok do
    result.data
  else
    nil
  end
end
```

**Good:**
```elixir
def process(%{status: :ok, data: data}), do: data
def process(_), do: nil
```

**Bad:**
```elixir
def handle_response(response) do
  if response.status == 200 do
    {:ok, response.body}
  else
    {:error, :unknown}
  end
end
```

**Good:**
```elixir
def handle_response(%{status: 200, body: body}), do: {:ok, body}
def handle_response(%{status: 404}), do: {:error, :not_found}
def handle_response(_), do: {:error, :unknown}
```

## Pipe operator

Chain transforms left-to-right.

**Bad:**
```elixir
String.upcase(String.trim(user_input))
```

**Good:**
```elixir
user_input
|> String.trim()
|> String.upcase()
```

**Bad:**
```elixir
def process_user(user) do
  validated = validate_user(user)
  transformed = transform_user(validated)
  save_user(transformed)
end
```

**Good:**
```elixir
def process_user(user) do
  user
  |> validate_user()
  |> transform_user()
  |> save_user()
end
```

## `with` for fallible sequences

Use `with` when several steps can each return an error.

**Bad:**
```elixir
def create_post(params) do
  case validate_params(params) do
    {:ok, valid_params} ->
      case create_changeset(valid_params) do
        {:ok, changeset} -> Repo.insert(changeset)
        error -> error
      end
    error -> error
  end
end
```

**Good:**
```elixir
def create_post(params) do
  with {:ok, valid_params} <- validate_params(params),
       {:ok, changeset} <- create_changeset(valid_params),
       {:ok, post} <- Repo.insert(changeset) do
    {:ok, post}
  end
end
```

Add an `else` clause when specific errors need distinct handling.

```elixir
def transfer_money(from_id, to_id, amount) do
  with {:ok, from_account} <- get_account(from_id),
       {:ok, to_account} <- get_account(to_id),
       :ok <- validate_balance(from_account, amount),
       {:ok, _} <- debit(from_account, amount),
       {:ok, _} <- credit(to_account, amount) do
    {:ok, :transfer_complete}
  else
    {:error, :insufficient_funds} -> {:error, "Not enough money"}
    {:error, :not_found} -> {:error, "Account not found"}
    error -> {:error, "Transfer failed: #{inspect(error)}"}
  end
end
```

## Multi-clause functions and guards

Use multiple function heads and simple guards instead of branching inside the body.

**Good:**
```elixir
def calculate(x) when is_integer(x) and x > 0, do: x * 2
def calculate(_), do: {:error, :invalid_input}
```

**Good:**
```elixir
def process_data(nil), do: {:error, :no_data}
def process_data([]), do: {:error, :empty_list}
def process_data(data) when is_list(data) do
  {:ok, Enum.map(data, &transform/1)}
end
```

## Naming

- Modules: `PascalCase`
- Functions and variables: `snake_case`
- Atoms: `:snake_case`
- Predicates: `valid?`, `empty?`, `exists?`
- Raising variants: `create!`, `fetch!`

## Error handling

Return tagged tuples from fallible functions. Raise only when the caller explicitly asks for it via a `!` function.

**Good:**
```elixir
def fetch_user(id) do
  case Repo.get(User, id) do
    nil -> {:error, :not_found}
    user -> {:ok, user}
  end
end
```

**Good:**
```elixir
def fetch_user!(id) do
  case Repo.get(User, id) do
    nil -> raise NotFoundError, "user #{id} not found"
    user -> user
  end
end
```

## Avoid defensive programming

Trust your contracts. If a value should never be `nil`, do not silently default it.

**Bad:**
```elixir
def get_username(user) do
  if user && user.name do
    user.name
  else
    "Unknown"
  end
end
```

**Good:**
```elixir
def get_username(%User{name: name}), do: name
```

If the caller passes the wrong shape, let it crash so the bug surfaces.

## Functions and modules

- One responsibility per function. If you need a comment to explain a section, extract it.
- One responsibility per module. Do not dump unrelated helpers into a context or utility module.
- Keep public APIs small. Make functions `defp` unless they are called from outside the module or are a required callback.
- Document public functions with `@doc` and modules with `@moduledoc`. Skip docs for obvious private helpers.

## Code quality

- **Duplication:** If the same logic appears twice, extract a shared function.
- **Complexity:** If a function has many branches, extract helpers. Aim for each function to do one thing.
- **Dead code:** Remove unused private functions, aliases, imports, and assigns.
- **Immutability:** Do not mutate data in place. Return new values.

**Bad:**
```elixir
def process(items) do
  result = []

  for item <- items do
    if valid?(item) do
      transformed = transform(item)
      result = [transformed | result]
    end
  end

  Enum.reverse(result)
end
```

**Good:**
```elixir
def process(items) do
  items
  |> Enum.filter(&valid?/1)
  |> Enum.map(&transform/1)
end
```

## What to avoid

- Broad `rescue` or `catch` clauses that swallow unexpected errors.
- Nested `case`/`if` more than two levels deep.
- String concatenation in loops; use IO lists or `Enum.join/2`.
- Generic names like `data`, `item`, `helper`, `manager`, `processor`.
- Comments that restate the code; explain *why*, not *what*.
- Speculative abstractions for a single call site.

## Output

When you produce Elixir code, silently run it against this checklist before returning it. If a project convention conflicts with a rule here, follow the project convention and note the override.