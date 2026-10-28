# Code Style & Architecture Rules (TypeScript & Next.js)

Write simple, explicit, strongly-typed, boring TypeScript and React code. Optimize for traceability and minimal abstraction.

> **Core Principle:** Validate untrusted data once at the boundary (API routes, Server Actions, webhooks, external fetches, `process.env`). Trust concrete TypeScript types everywhere else.

## 1. Type Safety & Boundary Validation
- **Zero Untyped Internal Code:** Never use `any`, `unknown`, `object`, or `Record<string, unknown>` inside internal business logic.
- **No Type Lying:** Never use `as any` or `as unknown as T`. Fix the upstream type or parse properly at the edge.
- **Parse, Don't Validate Repeatedly:** Parse incoming JSON, `FormData`, and query params once at the entry point (e.g., via Zod). Pass inferred concrete types (`z.infer<typeof Schema>`) to downstream functions.
- **Strict Required Fields:** Do not make properties optional (`?` or `| null`) unless genuinely nullable in the database or domain model.
- **No Paranoia Chaining:** Do not slap `?.`, `?? ""`, or `|| []` on required fields to appease the compiler. Narrow nullable values once at the top of the function and fail fast.
- **Unions Over Enums:** Never use TypeScript `enum`. Use string literal unions (`type Status = "pending" | "active"`) or `as const` arrays.
- **Type DB JSON:** Always apply concrete schema types to JSONB/document columns at the ORM definition level.

## 2. Anti-Slop & Anti-Overengineering
- **No Generic Conversion Helpers:** Never write `toString()`, `safeString()`, `asNumber()`, `getString(obj, key)`, or `valueOrDefault()`. Fix the source type instead.
- **No Fallback-to-Zero Programming:** Never silently return `""`, `0`, `false`, `null`, or `[]` when required data is missing or an error occurs. Throw an error, call `notFound()`, or return an explicit discriminated union error state.
- **No Enterprise OOP:** Do not create classes, `IFoo`/`FooImpl` interfaces, Builders, Factories, Managers, Processors, or DI containers (`@Injectable`). Export plain functions from ES modules.
- **No Pass-Through Layers:** Do not build `Action -> Controller -> Service -> Manager -> Repository -> DAO -> ORM` chains. Call the ORM or a single domain module (`lib/projects.ts`) directly unless a layer holds real business logic.
- **No DTO/Mapper Bloat:** Do not duplicate database models into `*DTO`, `*Entity`, `*ViewModel`, or `*Input` types with 1-to-1 mapper functions. Derive subsets from ORM or Zod types using `Pick<T, K>` or `Omit<T, K>`.
- **No Trivial Helpers:** Do not extract 2–3 lines of standard JS/TS (like `.trim().toLowerCase()`, `.map()`, or simple property access) into single-use helper functions. Inline them.
- **No Barrel Files:** Never create `index.ts` files that only re-export other files. Import directly from the target module.
- **No Vague Utility Folders:** Avoid dumping unrelated code into `utils/`, `helpers/`, or `common/`. Co-locate logic with the feature domain that owns it.

## 3. Control Flow & Error Handling
- **Guard Clauses First:** Use early returns to handle edge cases at the top of functions. Keep the happy path unindented.
- **No Silent Error Swallowing:** Never write `catch (err) { return null; }` or `catch (err) { console.error(err); }` on mutations or critical reads.
- **No Redundant Try/Catch:** Do not wrap functions in `try/catch` blocks just to log and rethrow, or re-wrap errors into generic strings that destroy stack traces. If wrapping, preserve the cause: `throw new Error("Context", { cause: err })`.
- **Expected vs. Unexpected Errors:** In Server Actions, return discriminated unions (`{ ok: true, data } | { ok: false, error: "CODE" }`) for expected UI errors, and let unexpected crashes bubble to error boundaries.
- **Typed Library Errors:** Check specific ORM/SDK error classes and codes (e.g., `err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"`), never `err.message.includes(...)`.
- **Await Serverless Work:** Never leave dangling unawaited promises in Route Handlers or Server Actions. Always `await` them, use Next.js `after()`, or push to a queue.

## 4. Next.js & React Discipline
- **No `useEffect` for Derived State:** Never sync props or state into another `useState` via `useEffect`. Compute derived values directly during render.
- **Server First:** Fetch initial data directly in `async` Server Components. Do not write `"use client"` + `useEffect` + `fetch("/api/...")` for standard data loading.
- **Server Actions Over Internal API Routes:** Use Server Actions for internal mutations instead of building single-use `app/api/...` wrapper routes.
- **No Premature Memoization:** Do not wrap variables in `useMemo` or functions in `useCallback` unless the calculation is demonstrably expensive or required for referential stability in a downstream hook/memoized subtree.
- **No Pointless Custom Hooks:** Do not create a `useX` hook if it does not call React hooks or manage component lifecycle. Write a plain function.
- **Narrow Component Props:** Pass only the specific primitives or narrow slices a component needs, not entire database graphs.

## 5. Native APIs, Comments & Testing
- **Use Modern Web/JS Built-ins:** Prefer `crypto.randomUUID()`, `structuredClone()`, `Object.groupBy()`, `Array.at()`, `URLSearchParams`, and `AbortSignal.timeout()` over custom helpers or external packages.
- **No Narrating Comments:** Never write comments that restate syntax (`// Check if user exists`). Only document *why* a non-obvious business rule, edge case, or workaround exists.
- **Boring Tests:** Test real behavior and outputs. Do not mock pure internal functions, build massive test factories, or use `as any` for test fixtures.

## Pre-Output Self-Check
Before generating or modifying code, verify:
1. Did I introduce `any`, `as`, `?.`, or `?? ""` to hide a weak upstream type? (If yes, fix the upstream type).
2. Did I create a helper, class, interface, or hook with only one caller and no real abstraction value? (If yes, inline it).
3. Can another engineer trace this feature from entry boundary to database without jumping through pass-through files?

# TypeScript & Next.js Codebase Cleanup: Remove Defensive Over-Engineering and AI Slop

Audit this TypeScript/Next.js codebase and aggressively simplify AI-generated, defensive, overly abstract, or unnecessarily generic code.

The goal is to make the code look like it was written by an experienced staff-level TypeScript and React engineer:

* simple
* explicit
* strongly typed (strict mode)
* boring
* idiomatic (modern ES/TS & Next.js App Router)
* easy to trace
* minimal abstraction
* minimal magic

Do not optimize for cleverness or enterprise OOP patterns.

Do not replace simple functions and components with generic helpers, classes, factories, adapters, builders, useless custom hooks, or excessive layering.

The primary rule is:

> **Validate untrusted data at the boundary (API routes, Server Actions, external fetches). Use concrete TypeScript types everywhere else.**

---

# 1. Remove unnecessary `any`, `unknown`, and loose Record types

Search aggressively for:

```ts
any
unknown // inside internal business logic
Record<string, any>
Record<string, unknown>
object
{}

```

Ask why the value is untyped inside trusted application code.

Bad:

```ts
function getDomain(data: Record<string, unknown>): string {
  const value = data["domain"];
  if (typeof value !== "string") {
    return "";
  }
  return value;
}

```

Prefer parsing at the boundary (e.g., with Zod) and using concrete types internally:

```ts
type DomainEvent = {
  domain: string;
};

```

Then simply access:

```ts
event.domain;

```

Do not carry generic `Record<string, unknown>` objects through the application and repeatedly run `typeof` checks on them.

---

# 2. Stop creating generic conversion helpers

Be suspicious of functions like:

```ts
toString()
asString()
safeString()
toNumber()
asNumber()
toBoolean()
toObject()
getString()
getOptionalString()
valueOrDefault()

```

Bad:

```ts
function toString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

```

Ask instead:

> What type is this value actually supposed to be?

If it is a string:

```ts
function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

```

Do not accept `unknown` or `any` in internal helpers just to make a function "flexible."

---

# 3. Remove fallback-to-empty-value programming

Search for code that silently converts invalid or broken states into:

```ts
""
0
false
null
[]
{}

```

Examples:

```ts
const id = project?.id ?? "";

```

```ts
if (!user) return {};

```

```ts
const items = data?.items || []; // when data.items is strictly required by the schema

```

Do not hide invalid states with `?? ""` or `|| []` just to appease the TypeScript compiler. If data is required, throw an error, return a proper Result/error state, or fix the upstream type.

Bad:

```ts
function getProjectId(project?: Project | null): string {
  if (!project) {
    return "";
  }
  return project.id;
}

```

Prefer fixing the caller so `project` cannot be null/undefined there. Or, if absence is genuinely possible at a boundary, handle it explicitly:

```ts
if (!project) {
  notFound(); // or throw new Error("Project not found")
}

```

Validate/narrow once at the top, then continue with clean, non-nullable code.

---

# 4. Do not add optional chaining (`?.`) everywhere

Optional chaining should correspond to actual nullable states in your domain model, not compiler paranoia.

Bad:

```ts
function handleProject(project?: Project | null) {
  const domain = project?.config?.network?.domain?.toLowerCase();
  if (!domain) {
    throw new Error("Invalid project domain");
  }
  // actual logic
}

```

If those fields are required by the application model, redesign the types so they aren't optional.

Prefer:

```ts
type Project = {
  config: {
    domain: string;
  };
};

```

Then:

```ts
project.config.domain.toLowerCase();

```

Do not slap `?.` on every property access just in case. Trust your TypeScript types.

---

# 5. Stop making every property optional (`?`)

Review types and interfaces like:

```ts
type Config = {
  enabled?: boolean;
  port?: number;
  name?: string | null;
};

```

AI loves making every prop and struct field optional to avoid type errors during generation. Do not use `?` or `| null` unless the value is genuinely optional in the domain or database.

If those values are required:

```ts
type Config = {
  enabled: boolean;
  port: number;
  name: string;
};

```

Make illegal states unrepresentable in the type system.

---

# 6. Remove pointless helper extraction

Do not create a helper function for every 2–3 lines of standard JavaScript.

Be suspicious of:

```ts
getDomainId()
extractProjectId()
resolveName()
buildKey()
parseValue()
isNonEmptyArray()

```

when the helper:

* has one caller
* only accesses a property
* only does a null check
* only calls `.trim()` or `.map()`
* only forwards arguments

Bad:

```ts
function getDomainIdFromRecord(record?: DNSRecord | null): string {
  if (!record) return "";
  return String(record.domainId);
}

```

Prefer:

```ts
record.domainId;

```

provided `record` is already known to exist and typed properly. A helper should represent a real reusable domain concept, not hide standard JS methods.

---

# 7. Do not introduce OOP classes and interfaces without a real reason

In TypeScript and Next.js, plain functions and modules are almost always better than classes and Java-style interfaces.

Be suspicious of:

```ts
export interface IProjectService {
  createProject(...): Promise<Project>;
  getProject(...): Promise<Project>;
  updateProject(...): Promise<Project>;
  deleteProject(...): Promise<void>;
}

export class ProjectServiceImpl implements IProjectService { ... }

```

especially when there is only one implementation.

Prefer exported plain functions in a module:

```ts
// lib/projects.ts
export async function getProject(id: string): Promise<Project | null> { ... }
export async function createProject(data: CreateProjectInput): Promise<Project> { ... }

```

Do not build `IFoo` / `FooImpl` class hierarchies in TypeScript unless you are genuinely swapping runtime adapters (e.g., `StorageProvider` for S3 vs. Local Disk).

---

# 8. Keep types and component props narrow

Do not pass massive objects or database models into components or functions that only need one or two fields.

Bad:

```tsx
type ProjectHeaderProps = {
  project: PrismaProjectWithRelationsAndMetadata;
  user: FullUserSession;
};

```

when the component only renders the title:

```tsx
type ProjectHeaderProps = {
  name: string;
  status: ProjectStatus;
};

```

Keep boundaries narrow so components and functions are easy to call and test.

---

# 9. Remove unnecessary abstraction layers

Look for enterprise chains inside a Next.js app like:

```txt
Server Action / Route Handler
↓
Controller
↓
Service
↓
Manager
↓
UseCase
↓
Repository
↓
DAO
↓
Prisma / Drizzle Client

```

where most layers simply forward arguments.

Bad:

```ts
// service.ts
export async function getProject(id: string) {
  return projectManager.getProject(id);
}

// manager.ts
export async function getProject(id: string) {
  return projectRepository.findById(id);
}

// repository.ts
export async function findById(id: string) {
  return db.project.findUnique({ where: { id } });
}

```

If these layers do not contain meaningful business logic, delete them. Calling `db.project.findUnique` directly inside a Server Component, Server Action, or a single `lib/projects.ts` domain file is completely fine and much easier to trace.

---

# 10. Remove pass-through wrappers and useless `async/await`

Search for functions whose entire body is:

```ts
export async function doSomething(input: Input) {
  return await dependency.do(input);
}

```

or:

```ts
export async function getProject(id: string) {
  try {
    const res = await db.project.findUnique({ where: { id } });
    return res;
  } catch (err) {
    throw err;
  }
}

```

Simplify: call the underlying function directly, or return the promise directly without redundant `try/catch` blocks that just rethrow.

---

# 11. Simplify redundant error handling

Bad:

```ts
try {
  const result = await getProject(id);
  return result;
} catch (error) {
  throw new Error(`Error: ${error instanceof Error ? error.message : String(error)}`);
}

```

This destroys the original stack trace and adds zero useful context.

If you catch an error to wrap it, add meaningful domain context and preserve the `cause`:

```ts
try {
  return await deployContainer(projectId);
} catch (err) {
  throw new Error(`Failed to deploy container for project ${projectId}`, { cause: err });
}

```

Do not wrap every single function in a `try/catch`. Let errors bubble up to the boundary (e.g., `error.tsx`, an API Route wrapper, or a top-level Server Action handler) unless you can actually recover from the error right there.

---

# 12. Do not swallow errors

Find:

```ts
try {
  await doSomething();
} catch (err) {
  return null;
}

```

or:

```ts
try {
  await updateUser(data);
} catch (err) {
  console.error(err);
  // returns undefined as if it succeeded!
}

```

or:

```ts
doSomethingAsync().catch(() => {});

```

Do not turn bugs and failed mutations into silent successes. If an operation fails, the caller or UI needs to know.

If an error can genuinely be ignored (like a non-critical analytics ping or cache warm-up), make the reasoning explicit:

```ts
try {
  await redis.del(cacheKey);
} catch (err) {
  logger.warn({ err, cacheKey }, "Failed to invalidate cache; continuing");
}

```

---

# 13. Avoid unnecessary custom Error classes

Be suspicious of massive custom error hierarchies:

```ts
export class ValidationError extends AppError {}
export class RepositoryError extends AppError {}
export class ServiceError extends AppError {}
export class DomainError extends AppError {}
export class InternalError extends AppError {}

```

unless the caller or boundary handler genuinely switches behavior based on `instanceof`.

In Next.js Server Actions, throwing custom error classes across the network boundary strips them down anyway. Prefer simple discriminated unions for expected UI errors:

```ts
type ActionResult = 
  | { ok: true; projectId: string }
  | { ok: false; error: "DOMAIN_TAKEN" | "UNAUTHORIZED" };

```

and standard `Error` throws for unexpected crashes.

---

# 14. Handle library errors idiomatically

Do not manually inspect error message strings when libraries provide error codes or type guards.

Bad:

```ts
catch (err: any) {
  if (err.message?.includes("Unique constraint failed")) { ... }
}

```

Prefer the underlying library's typed error check:

```ts
catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { ok: false, error: "DUPLICATE_DOMAIN" };
  }
  throw err;
}

```

---

# 15. Avoid dynamic object gymnastics (`Object.keys` / `Reflect`) for static shapes

Be suspicious of `Reflect.*`, `Proxy`, or complex `Object.entries().reduce()` chains used on objects whose keys are already known at compile time.

Bad:

```ts
function isEmpty(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  return Reflect.ownKeys(value).length === 0;
}

```

Prefer explicit, boring typed checks (`!project.name`). Keep dynamic metaprogramming out of ordinary business logic and React components.

---

# 16. Do not abuse TypeScript generics where concrete types are clearer

TypeScript generics are powerful, which means AI frequently writes unreadable type-level gymnastics for trivial tasks.

Be suspicious of:

```ts
function extractProperty<T extends Record<string, any>, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

function safeMap<T, R>(items: T[] | null | undefined, fn: (item: T) => R): R[] {
  return (items ?? []).map(fn);
}

```

Just write `obj.key` or `items.map(fn)`. Do not build generic utility types or functions just because two lines of code look similar.

---

# 17. Remove generic map/object accessor utilities

Bad:

```ts
function getString(data: Record<string, unknown>, key: string): string
function getNumber(data: Record<string, unknown>, key: string): number

```

This is proof that untrusted JSON or `FormData` was never properly parsed at the boundary.

Prefer a schema at the boundary:

```ts
const DeploymentEventSchema = z.object({
  projectId: z.string(),
  port: z.number(),
  enabled: z.boolean(),
});

const event = DeploymentEventSchema.parse(rawPayload);

```

Then just use `event.projectId`, `event.port`, and `event.enabled`.

---

# 18. Validate JSON and `FormData` once at the boundary

Bad (inside a route handler or server action):

```ts
const body = await req.json();
const event = typeof body?.event === "string" ? body.event : "";
const data = typeof body?.data === "object" && body?.data !== null ? body.data : {};
const projectId = typeof data?.project_id === "string" ? data.project_id : "";

```

Prefer parsing once at the edge:

```ts
const ProjectSyncSchema = z.object({
  event: z.literal("project.sync"),
  data: z.object({
    project_id: z.string().min(1),
  }),
});

const payload = ProjectSyncSchema.parse(await req.json());

```

After parsing at the API route or Server Action entry point, every downstream function should accept the inferred concrete type (`z.infer<typeof ProjectSyncSchema>`).

---

# 19. Avoid untyped JSON blobs in database models

If Postgres `jsonb`, MongoDB, or Redis stores a known document shape, type it at the ORM/query boundary (e.g., using Drizzle's `.$type<T>()` or Prisma typed JSON).

Bad:

```ts
const doc = await db.query.dnsRecords.findFirst();
const metadata = doc.metadata as Record<string, any>;
const ttl = typeof metadata?.ttl === "number" ? metadata.ttl : 3600;

```

Prefer typing the schema column properly so `doc.metadata.ttl` is already a `number`.

---

# 20. Remove fake defensive type assertions (`as`)

Search for:

```ts
as any
as unknown as SomeType
as string

```

Bad:

```ts
function processData(data: unknown) {
  const map = data as Record<string, unknown>;
  if (!map) return;
  const domain = map["domain"] as string;
}

```

If the data came from an internal contract already controlled by your app, pass the real type instead of `unknown`. If it came from an external API, validate it properly rather than lying to the compiler with `as`.

---

# 21. Avoid excessive DTO / ViewModel / Entity duplication

Be suspicious when a single database table spawns 8 nearly identical types:

```ts
ProjectRequest
ProjectDTO
ProjectInput
ProjectParams
ProjectData
ProjectModel
ProjectEntity
ProjectResponse
ProjectCardProps

```

In TypeScript, you do not need separate classes/interfaces for every layer. Derive types directly from your ORM/validator or use built-in utility types when subsets are needed:

```ts
import type { Project } from "@prisma/client"; // or typeof projects.$inferSelect

type ProjectSummary = Pick<Project, "id" | "name" | "status">;

```

Separate types only when the contracts are genuinely different.

---

# 22. Remove mapper slop

Look for functions like:

```ts
function mapProjectToDTO(project: Project): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
  };
}

```

when `ProjectDTO` and `Project` are identical and no security boundary requires stripping fields. Do not maintain fleets of `toDTO`, `fromDTO`, `toModel`, `toViewModel` functions that just copy properties 1-to-1.

---

# 23. Avoid factory functions and classes that do nothing useful

Bad:

```ts
export function createDomainObject(name: string): Domain {
  return { name };
}

```

when an object literal `{ name }` is clearer.

---

# 24. Remove builder-pattern slop

Do not introduce Java-style builders in TypeScript. JavaScript has native object literals and spread syntax.

Bad:

```ts
const deployment = new DeploymentBuilder()
  .withProjectId(projectId)
  .withRegion(region)
  .withPort(port)
  .withImage(image)
  .build();

```

Prefer a plain object literal:

```ts
const deployment: Deployment = {
  projectId,
  region,
  port,
  image,
};

```

---

# 25. Do not overuse configuration / options objects for simple functions

Avoid:

```ts
createService({
  withRepository: repo,
  withLogger: logger,
  withMetrics: metrics,
});

```

or wrapping a single parameter in an options object:

```ts
getProject({ id: projectId });

```

Prefer direct arguments when there are 1–3 clear parameters:

```ts
getProject(projectId);

```

Use an options object when a function takes multiple optional parameters or booleans that would be ambiguous at the call site.

---

# 26. Avoid unnecessary Factory classes

Bad:

```ts
export class NotificationFactory {
  static create(type: string): NotificationService { ... }
}

```

when the app only sends emails, or when a simple `switch` statement or plain function would suffice.

---

# 27. Avoid DI containers in TypeScript/Next.js

Normal dependency management in TypeScript/Next.js is just ES module `import` statements, or passing a parameter to a function when testability requires it.

Do not introduce:

* `tsyringe` / `InversifyJS`
* Service locators
* `Registry` classes
* Provider classes (outside of genuine React Context needs)
* Decorator-based injection (`@Injectable()`)

Explicit imports and plain function arguments are vastly easier to bundle, tree-shake, and trace in Next.js.

---

# 28. Prefer straightforward control flow & early returns

Bad:

```ts
let shouldProcess = false;

if (project !== null && project !== undefined) {
  if (project.enabled === true) {
    if (project.status === "active") {
      shouldProcess = true;
    }
  }
}

```

Prefer guard clauses (early returns):

```ts
if (!project?.enabled || project.status !== "active") {
  return;
}

// actual work

```

Keep the happy path unindented and visually obvious.

---

# 29. Simplify Next.js / React specific AI Slop

AI models frequently write outdated or over-engineered React and Next.js patterns. Audit and remove:

### A. `useEffect` + `useState` for derived state

Bad:

```tsx
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`);
}, [user.firstName, user.lastName]);

```

Prefer computing during render:

```tsx
const fullName = `${user.firstName} ${user.lastName}`;

```

### B. Client-side fetching where a Server Component suffices

Do not write a `"use client"` component with `useEffect` + `fetch("/api/projects")` + loading/error state just to render initial page data that could be awaited directly in an `async` Server Component.

### C. Pointless API routes that wrap single functions for internal use

Do not create `app/api/projects/create/route.ts` only to call it from a Client Component in the same app when a direct Server Action would be simpler and end-to-end typed.

### D. Premature `useMemo` and `useCallback` everywhere

AI wraps every single variable in `useMemo` and every click handler in `useCallback`. Remove them unless:

* The computation is genuinely expensive.
* Referential equality is required for a downstream dependency array or memoized heavy subtree.

### E. Useless custom hooks and Context providers

Bad:

```tsx
function useProjectName(project: Project) {
  return useMemo(() => project.name.trim(), [project.name]);
}

```

Do not create a `useX` hook for logic that doesn't use React hooks or manage lifecycle/state. And do not create a `<FooContextProvider>` when passing props down 1–2 levels works fine.

---

# 30. Remove useless temporary variables

Bad:

```ts
const rawDomain = event.domain;
const trimmedDomain = rawDomain.trim();
const domain = trimmedDomain.toLowerCase();

```

Prefer:

```ts
const domain = event.domain.trim().toLowerCase();

```

Intermediate variables should clarify complex expressions, not narrate method chaining.

---

# 31. Remove pointless boolean comparisons

Clean up:

```ts
if (enabled === true)
if (enabled === false)
const isValid = Boolean(x === y ? true : false);

```

Prefer:

```ts
if (enabled)
if (!enabled)
const isValid = x === y;

```

---

# 32. Avoid unnecessary array/object cloning

Be suspicious of defensive cloning everywhere when no mutation happens:

```ts
const itemsCopy = [...items].map(x => ({ ...x }));
const deepCopy = structuredClone(config);

```

In React, you only need a new reference when mutating state (e.g., sorting an array before rendering). You do not need to clone an array right before calling `.map()` or `.filter()`—those methods already return a new array.

---

# 33. Avoid premature performance and caching tricks

Do not introduce:

* Custom in-memory `Map` LRU caches inside serverless functions (which have unpredictable lifetimes across invocations)
* Web Workers for trivial array filtering
* Complex custom debounce/throttle classes when none are needed

Write simple, correct code first. Use Next.js / React's built-in caching (`React.cache`, `unstable_cache` / `"use cache"`) only where measured bottlenecks exist.

---

# 34. Do not fire-and-forget promises carelessly

Be suspicious of unawaited promises inside Server Actions or API routes:

```ts
export async function POST(req: Request) {
  processHeavyWebhook(req); // missing await!
  return Response.json({ ok: true });
}

```

In serverless environments (like Vercel/AWS Lambda), the execution context freezes or terminates as soon as the response is returned, killing unawaited promises mid-flight. Either `await` the work, use Next.js `after()`, or push to a real background queue.

---

# 35. Use `AbortSignal` and timeouts cleanly

Do not thread `AbortSignal` into synchronous pure functions where cancellation is meaningless. Pass it to actual I/O boundaries (`fetch`). And prefer modern `AbortSignal.timeout(5000)` over manual `AbortController` + `setTimeout` + `clearTimeout` boilerplate.

---

# 36. Keep logging simple

Avoid logs that narrate every line of execution:

```ts
console.log("Entering createProject...");
console.log("Validating input...");
console.log("Calling prisma.project.create...");
console.log("Leaving createProject...");

```

Log meaningful operational events, state transitions, and unexpected boundary failures. And do not `console.error(err)` *and* rethrow `err` at every single layer, which results in the same stack trace printing 5 times per failed request.

---

# 37. Remove obvious AI comments

Delete comments like:

```ts
// Check if project exists
if (!project) { ... }

// Update the state with the new value
setCount(newValue);

// Return the formatted string
return formatted;

```

Keep comments for:

* Business rules and edge cases
* Non-obvious Next.js caching/rendering quirks
* Third-party API weirdness
* Why an alternative approach was rejected

Comments should explain **why**, never **what** the syntax is doing.

---

# 38. Avoid over-modularization and barrel file (`index.ts`) hell

Bad:

```txt
src/
  utils/
    stringUtils/
      trimString.ts
      lowercaseString.ts
      index.ts
    arrayUtils/
      index.ts

```

1. **Stop creating barrel files (`index.ts` that just re-export everything).** They destroy Next.js bundling performance, break tree-shaking, and cause circular dependency bugs. Import directly from the source file.
2. **Audit vague folders** like `utils/`, `helpers/`, `common/`, `shared/`, `misc/`. Move domain-specific logic next to the feature that uses it, and delete trivial 2-line helpers.

---

# 39. Prefer union types over TypeScript `enum`

Bad:

```ts
export enum DeploymentStatus {
  Pending = "pending",
  Running = "running",
  Failed = "failed",
}

```

TypeScript `enum` emits runtime IIFE objects and creates nominal typing headaches. Prefer string literal unions (or `as const` arrays if you need to iterate over values at runtime):

```ts
export type DeploymentStatus = "pending" | "running" | "failed";

```

And do not create union types for arbitrary strings that aren't a closed set.

---

# 40. Do not duplicate standard Web / JS APIs

Before keeping a helper or installing a package, check if modern JS/Node already does it natively:

* Use `crypto.randomUUID()` instead of custom ID generators or `uuid` packages.
* Use `structuredClone()` instead of custom deep-clone loops.
* Use `Array.prototype.at(-1)`, `Object.groupBy()`, `Set`, `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `URLSearchParams`.

---

# 41. Keep boundary validation, delete internal re-validation

Bad:

```ts
// Called inside 4 different internal helper functions:
function validateProject(project: Project) {
  if (!project || typeof project.id !== "string") {
    throw new Error("Invalid project");
  }
}

```

If `Project` was parsed at the API/Server Action boundary or fetched from your typed database schema, **trust the type**.

Validate at the edges:

* Incoming `Request` bodies, searchParams, route params
* `FormData` in Server Actions
* Webhooks & message queues
* `process.env` (validate once at startup in an `env.ts` file)
* External third-party `fetch()` responses

> **Defend against external uncertainty, not against your own TypeScript compiler.**

---

# 42. Prefer readable `switch` or early returns over Strategy Pattern classes

Bad:

```ts
const handlers: Record<string, EventStrategy> = {
  insert: new InsertStrategy(),
  delete: new DeleteStrategy(),
};
await handlers[event.type]?.execute(event);

```

when a simple `switch` is completely clear and exhaustively type-checked by TypeScript:

```ts
switch (event.type) {
  case "insert":
    return handleInsert(event);
  case "delete":
    return handleDelete(event);
}

```

---

# 43. Keep tests simple too

Apply the cleanup to Vitest / Jest / Playwright tests.

Remove:

* Enormous test builder classes
* Mocking internal pure functions
* `as any` casts on huge fake objects when the function under test only reads 2 fields
* Testing implementation details (e.g., asserting that `useState` or a mock Prisma method was called with exact arguments instead of testing the output/behavior)

---

# 44. Search patterns to audit

Search the repository for these common AI slop indicators:

```txt
: any
as any
as unknown
Record<string, any>
Record<string, unknown>
try {
catch (
?.
?? ""
|| ""
|| []
new Promise(
useEffect(
useMemo(
useCallback(
interface I
Impl
Factory
Builder
Manager
Processor
Helper
Utils
Mapper
Converter
Validator
DTO
Entity
safe
normalize
extract
resolve
toString(
asString(
index.ts

```

Do not blindly delete every match—use them as hotspots to inspect for unnecessary complexity.

---

# 45. Apply the "De-Slop Test" to every file

Before keeping a piece of code, ask:

1. **Does this handle a runtime state that can genuinely happen?** If no, delete it.
2. **Is this defensive check (`?.`, `typeof`, `?? ""`) caused by weak typing upstream?** If yes, fix the upstream type or boundary parser.
3. **Does this class/interface/hook have more than one meaningful consumer or implementation?** If no, inline it or use a plain function.
4. **Does this helper express a real domain concept?** If no, inline the standard JS/TS code.
5. **Is this Client Component doing work that belongs on the Server (or vice versa)?** If yes, move it to the right boundary.

---

# 46. Desired Style Comparison

Prefer code like this:

```ts
// app/actions/domain.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const MapDomainSchema = z.object({
  projectId: z.string().uuid(),
  domain: z.string().trim().toLowerCase().min(3),
});

export async function mapDomainAction(input: z.infer<typeof MapDomainSchema>) {
  const { projectId, domain } = MapDomainSchema.parse(input);

  await db.domain.create({
    data: { projectId, domain },
  });
}

```

Over AI-generated slop like this:

```ts
// app/actions/domain.ts
"use server";

export async function mapDomainAction(rawInput: unknown): Promise<ActionResponse<boolean>> {
  try {
    const event = DomainConverter.toDomainMapDTO(rawInput);
    if (!event) {
      throw new ValidationError("Failed converting domain event");
    }

    const projectId = StringUtils.safeString(event?.projectId);
    if (!projectId || projectId === "") {
      return ResponseBuilder.ok(false);
    }

    const domain = DomainNormalizer.normalizeStringValue(event?.domain);
    if (!domain || domain === "") {
      return ResponseBuilder.ok(false);
    }

    const manager = DomainManagerFactory.getInstance();
    await manager.processDomainMapping(
      new DomainMappingParamsBuilder()
        .withProjectId(projectId)
        .withDomain(domain)
        .build()
    );

    return ResponseBuilder.ok(true);
  } catch (error: any) {
    Logger.error("Error in mapDomainAction", error);
    return ResponseBuilder.error(error?.message ?? "Unknown error");
  }
}

```

---

# 47. Refactoring Process

Work feature-by-feature (or route-by-route):

1. **Find the boundary** where untrusted data enters (Route Handler, Server Action, Page `params`/`searchParams`, external `fetch`, Webhook).
2. **Parse and validate once** at that entry point into a strict TypeScript type.
3. **Trace the data flow inward.** Delete every redundant `?.`, `typeof` check, `?? ""`, `as any`, converter, mapper, and duplicate DTO along the path.
4. **Collapse pass-through layers** (Service → Manager → Repository → ORM) into direct, readable functions.
5. **Simplify React components** by deleting derived-state `useEffect`s, unnecessary `useMemo`/`useCallback` wrappers, and useless 3-line custom hooks.
6. **Verify with tooling:**

```bash
tsc --noEmit
next lint # or biome check / eslint
vitest run

```

> **Make untrusted input safe at the edge. Keep trusted TypeScript and React code boring everywhere else.**