import { modelPolicyError, readProfiles } from "../shared/profile-registry.ts";

export function activeProfileModelError(
	profileName: string,
	provider: string,
	modelId: string,
	profilesPath?: string,
): string | undefined {
	const result = readProfiles(profilesPath);
	const profile = result.config.profiles[profileName];
	if (!profile) return `Profile '${profileName}' is not configured.`;
	return modelPolicyError(
		profileName,
		profile,
		{ model: `${provider}/${modelId}` },
		"Active parent",
	);
}
