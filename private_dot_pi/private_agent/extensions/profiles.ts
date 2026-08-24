/**
 * Pi account profiles.
 *
 * profiles.json is the account-policy source of truth. Parent model choices may
 * be remembered per profile; subagent routing is always read directly from the
 * profile registry and is never synchronized into settings.json.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
 getProfileRegistry,
 modelPolicyError,
 parseModelSpec,
 PROFILE_SELECTION_ENTRY_TYPE,
 profileSelectionFromEntries,
 readParentProfileState,
 writeParentProfileState,
 type ModelPolicy,
 type ParentProfileState,
 type Profile,
 type ThinkingLevel,
} from "./shared/profile-registry.ts";


const registry = getProfileRegistry();
const THINKING_LEVELS = new Set<ThinkingLevel>([
 "off",
 "minimal",
 "low",
 "medium",
 "high",
 "xhigh",
 "max",
]);


function modelLabel(policy: ModelPolicy | undefined): string {
 if (!policy?.model) return "no model";
 return policy.thinking ? `${policy.model}:${policy.thinking}` : policy.model;
}

function notify(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info"): void {
 if (ctx.hasUI) ctx.ui.notify(message, type);
}

function policyDiagnostic(profileName: string, profile: Profile, policy: ModelPolicy, label: string, ctx: ExtensionContext): string {
 const policyIssue = modelPolicyError(profileName, profile, policy, label);
 if (policyIssue) return policyIssue;
 const spec = parseModelSpec(policy.model!);
 const model = spec ? ctx.modelRegistry.find(spec.provider, spec.id) : undefined;
 if (!model) return `${policy.model} — unavailable (provider/model not in registry)`;
 try {
  if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
   return `${policy.model} — unauthenticated (run /login ${spec!.provider} or configure its API key)`;
  }
 } catch {
  // pi.setModel remains the definitive auth check.
 }
 return `${policy.model} — ready`;
}

export default function profiles(pi: ExtensionAPI): void {
 if (process.env.HERDR_SUBAGENT_CHILD === "1") return;

 pi.registerFlag("profile", {
  description: "Initial account profile (for example, work or personal)",
  type: "string",
 });

 let currentProfile = "";
 let state: ParentProfileState = {};
 let applyingProfile = false;
 let appliedModel: string | undefined;

 function load(preferred?: string, preserveSelection = false): string | undefined {
  state = readParentProfileState();
  registry.reload({ preferred, preserveSelection });
  currentProfile = registry.selectedName() ?? "";
  return currentProfile || undefined;
 }

 async function trySetModel(
  modelSpec: string,
  profileName: string,
  profile: Profile,
  label: string,
  ctx: ExtensionContext,
  issues: string[],
): Promise<boolean> {
  const policyIssue = modelPolicyError(profileName, profile, { model: modelSpec }, label);
  if (policyIssue) {
   issues.push(policyIssue);
   return false;
  }
  const spec = parseModelSpec(modelSpec)!;
  const model = ctx.modelRegistry.find(spec.provider, spec.id);
  if (!model) {
   issues.push(`${modelSpec} is unavailable (provider/model not in registry)`);
   return false;
  }
  try {
   if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
    issues.push(`${modelSpec} is unauthenticated (run /login ${spec.provider} or configure its API key)`);
   }
  } catch {
   // pi.setModel below provides the definitive check.
  }
  const switched = await pi.setModel(model);
  if (!switched) {
   issues.push(`${modelSpec} is unauthenticated or unavailable; session model was not changed`);
   return false;
  }
  appliedModel = modelSpec;
  return true;
 }

 async function applyProfile(profileName: string, ctx: ExtensionContext, reason: "startup" | "switch" | "reload"): Promise<void> {
  const resolved = registry.resolveParent(profileName);
  if (!resolved) {
   notify(ctx, `Unknown profile: ${profileName}`, "error");
   return;
  }
  pi.appendEntry(PROFILE_SELECTION_ENTRY_TYPE, { profile: profileName });
  currentProfile = profileName;
  registry.select(profileName);
  ctx.ui.setStatus("profile", `Profile: ${profileName}`);

  const sticky = state[profileName];
  let policy: ModelPolicy = {
   model: sticky?.model ?? resolved.policy.model,
   thinking: sticky?.thinking ?? resolved.policy.thinking,
  };
  let usingSticky = sticky?.model !== undefined && sticky.model !== resolved.policy.model;
  if (sticky?.model && modelPolicyError(profileName, resolved.profile, { model: sticky.model }, "Remembered parent")) {
   delete state[profileName];
   writeParentProfileState(state);
   policy = resolved.policy;
   usingSticky = false;
  }

  const issues: string[] = [];
  applyingProfile = true;
  try {
   if (policy.model) {
    const applied = await trySetModel(policy.model, profileName, resolved.profile, "Parent", ctx, issues);
    if (!applied && usingSticky && resolved.policy.model) {
     issues.push(`Fell back to profile default ${resolved.policy.model}`);
     await trySetModel(resolved.policy.model, profileName, resolved.profile, "Parent", ctx, issues);
     policy = resolved.policy;
     usingSticky = false;
    }
   } else {
    issues.push(`Profile '${profileName}' has no parent model.`);
   }
   if (policy.thinking) pi.setThinkingLevel(policy.thinking);
  } finally {
   applyingProfile = false;
  }

  const prefix = reason === "startup" ? "Profile" : reason === "switch" ? "Switched profile" : "Reloaded profile";
  const summary = `${prefix}: ${profileName} • ${modelLabel(policy)}${usingSticky ? " (last used)" : ""}`;
  notify(ctx, issues.length ? `${summary}\n${issues.join("\n")}` : summary, issues.length ? "warning" : "info");
  for (const warning of registry.warnings()) notify(ctx, warning, "warning");
 }

 function profileStatus(ctx: ExtensionContext): string {
  const resolved = registry.resolveParent(currentProfile);
  if (!resolved) return "No profile loaded.";
  const lines = [
   `Profile: ${currentProfile}`,
   `Allowed providers: ${resolved.profile.allowedProviders.join(", ") || "none"}`,
   `Parent: ${policyDiagnostic(currentProfile, resolved.profile, resolved.policy, "Parent", ctx)}`,
   ...(state[currentProfile]?.model ? [`Last used parent: ${modelLabel(state[currentProfile])}`] : []),
   "Agents:",
  ];
  for (const role of Object.keys(resolved.profile.subagents).sort()) {
   const policy = resolved.profile.subagents[role];
   lines.push(`  ${role}: ${policyDiagnostic(currentProfile, resolved.profile, policy, `Agent '${role}'`, ctx)}${policy.thinking ? `; thinking ${policy.thinking}` : ""}`);
  }
  for (const warning of registry.warnings()) lines.push(`Warning: ${warning}`);
  return lines.join("\n");
 }

 function currentModelPolicyError(ctx: ExtensionContext): string | undefined {
  const profile = registry.profile(currentProfile);
  const model = ctx.model;
  if (!profile || !model) return `Profile '${currentProfile}' has no active model.`;
  return modelPolicyError(
   currentProfile,
   profile,
   { model: `${model.provider}/${model.id}` },
   "Active parent",
  );
 }

 pi.on("session_start", async (_event, ctx) => {
  const requested = pi.getFlag("profile");
  const sessionProfile = profileSelectionFromEntries(ctx.sessionManager.getBranch());
  load(typeof requested === "string" ? requested : sessionProfile);
  if (!currentProfile) {
   notify(ctx, "No profiles configured.", "error");
   return;
  }
  await applyProfile(currentProfile, ctx, "startup");
 });

 pi.on("agent_start", (_event, ctx) => {
  const issue = currentModelPolicyError(ctx);
  if (!issue) return;
  notify(ctx, issue, "error");
  ctx.abort();
 });

 pi.on("model_select", async (event, ctx) => {
  const spec = `${event.model.provider}/${event.model.id}`;
  if (spec === appliedModel) {
   appliedModel = undefined;
   return;
  }
  if (applyingProfile || !currentProfile || event.source === "restore") return;

  const profile = registry.profile(currentProfile);
  const issue = profile ? modelPolicyError(currentProfile, profile, { model: spec }, "Selected parent") : `Unknown profile '${currentProfile}'.`;
  if (issue) {
   notify(ctx, issue, "error");
   const fallback = event.previousModel && profile?.allowedProviders.includes(event.previousModel.provider)
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : profile?.model;
   if (profile && fallback) {
    applyingProfile = true;
    try {
     await trySetModel(fallback, currentProfile, profile, "Parent", ctx, []);
    } finally {
     applyingProfile = false;
    }
   }
   return;
  }

  const thinking = ctx.thinkingLevel && THINKING_LEVELS.has(ctx.thinkingLevel as ThinkingLevel)
   ? (ctx.thinkingLevel as ThinkingLevel)
   : undefined;
  state[currentProfile] = { model: spec, thinking };
  writeParentProfileState(state);
 });

 pi.on("thinking_level_select", (event) => {
  if (applyingProfile || !currentProfile || !THINKING_LEVELS.has(event.level as ThinkingLevel)) return;
  state[currentProfile] = { ...state[currentProfile], thinking: event.level as ThinkingLevel };
  writeParentProfileState(state);
 });

 pi.registerCommand("profile", {
  description: "Switch account profile, inspect status, or reload profiles.json",
  getArgumentCompletions: (prefix: string) => {
   const items = ["status", "reload", "reset", ...registry.profileNames()];
   const trimmed = prefix.trim();
   return items.filter((value) => value.startsWith(trimmed)).map((value) => ({ value, label: value }));
  },
  handler: async (args, ctx) => {
   const arg = args.trim();
   if (arg === "status") {
    notify(ctx, profileStatus(ctx));
    return;
   }
   if (arg === "reload") {
    load(currentProfile, true);
    if (currentProfile) await applyProfile(currentProfile, ctx, "reload");
    return;
   }
   if (arg === "reset") {
    if (!currentProfile) return;
    delete state[currentProfile];
    writeParentProfileState(state);
    await applyProfile(currentProfile, ctx, "reload");
    return;
   }

   registry.reload({ preserveSelection: true });
   let profileName = arg;
   if (!profileName) {
    const names = registry.profileNames();
    if (names.length === 0) {
     notify(ctx, "No profiles configured.", "error");
     return;
    }
    const choice = await ctx.ui.select("Select Profile", names);
    if (choice === undefined) return;
    profileName = choice;
   }
   if (!registry.select(profileName)) {
    notify(ctx, `Unknown profile: ${profileName}. Available: ${registry.profileNames().join(", ")}`, "error");
    return;
   }
   await applyProfile(profileName, ctx, "switch");
  },
 });
}
