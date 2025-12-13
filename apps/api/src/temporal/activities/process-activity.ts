// This is intentionally empty - the process logic should be in the workflow
// using executeChild, not in an activity
export async function processActivity(): Promise<void> {
  // No-op: Child workflow execution should happen in the workflow layer
}
