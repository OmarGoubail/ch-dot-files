export const SessionStartPlugin = async ({ $ }) => {
  return {
    "session.created": async () => {
      await $`kb prime`
    },
  }
}
